from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Optional, List, Union, Any
import json
import os
import uuid
from datetime import datetime, timedelta
import shutil
from pathlib import Path
from langchain.tools import Tool  # If tools are needed for manager/agents

DISABLE_RUN = True

if DISABLE_RUN:
    from task_executor import TaskExecutor
    from multi_agent_executor import MultiAgentExecutor
    import psycopg2
    from psycopg2 import Error as PostgresError
    from google.oauth2 import service_account
    from google.cloud import bigquery

import logging
# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware to handle cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Data model for Agent
class AgentFeatures(BaseModel):
    knowledgeBase: bool = False
    dataQuery: bool = False

class Agent(BaseModel):
    id: str
    name: str
    description: str
    llmProvider: str
    llmModel: str
    apiKey: str
    role: str
    goal: str = ""
    expectedOutput: str = ""
    backstory: str = ""
    instructions: str
    verbose: bool = False
    features: AgentFeatures
    tools: List[str] = []  # List of tool IDs
    advanced_tools: List[str] = []  # List of advanced tool IDs

class AgentCreate(BaseModel):
    name: str
    description: str
    llmProvider: str
    llmModel: str
    apiKey: str
    role: str
    goal: str = ""
    expectedOutput: str = ""
    backstory: str = ""
    instructions: str
    verbose: bool = False
    features: AgentFeatures
    tools: List[str] = []  # List of tool IDs
    advanced_tools: List[str] = []

class Tool(BaseModel):
    id: str
    name: str
    description: str
    tags: List[str]
    is_added: bool = False

class OpenAPIServer(BaseModel):
    url: str
    description: str

class OpenAPIInfo(BaseModel):
    title: str
    version: str
    description: str = ""

class OpenAPISchema(BaseModel):
    openapi: str
    info: OpenAPIInfo
    servers: List[OpenAPIServer]
    paths: Dict[str, dict]

class CustomTool(BaseModel):
    name: str
    description: str
    tags: List[str]
    schema: Dict[str, Any]
    is_custom: bool = True
    data_connector_id: Optional[str] = None

# Tool Authentication Models
class ToolAuth(BaseModel):
    type: str  # "api_key", "oauth", "basic", etc.
    headers: Dict[str, str] = {}
    params: Dict[str, str] = {}

class ToolConfig(BaseModel):
    id: str
    schema: Dict[str, Any]
    auth: Optional[ToolAuth] = None

# Notification Models
class Notification(BaseModel):
    id: str
    type: str  # info, success, warning, error
    message: str
    timestamp: str
    read: bool = False

class NotificationUpdate(BaseModel):
    read: bool

# Helper function to load notifications
def load_notifications() -> List[dict]:
    try:
        with open('static/data/notifications.json', 'r') as f:
            data = json.load(f)
            return data.get('notifications', [])
    except FileNotFoundError:
        return []

# Helper function to save notifications
def save_notifications(notifications: List[dict]):
    with open('static/data/notifications.json', 'w') as f:
        json.dump({'notifications': notifications}, f, indent=4)

# File to store agents
AGENTS_FILE = "agents.json"
MULTIAGENTS_FILE = "data/multiagents.json"
CONNECTORS_FILE = "data/connectors.json"

def load_agents():
    if os.path.exists(AGENTS_FILE):
        with open(AGENTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_agents(agents):
    with open(AGENTS_FILE, 'w') as f:
        json.dump(agents, f)

def load_multi_agents():
    logger.info(f"Attempting to load multi-agents from: {MULTIAGENTS_FILE}")
    if os.path.exists(MULTIAGENTS_FILE):
        try:
            with open(MULTIAGENTS_FILE, 'r') as f:
                data = json.load(f)
                logger.info(f"Successfully loaded and parsed JSON data: {data}")
                return data
        except json.JSONDecodeError as e:
            logger.error(f"Error decoding JSON from {MULTIAGENTS_FILE}: {e}")
            return []
        except Exception as e:
            logger.error(f"An unexpected error occurred while reading {MULTIAGENTS_FILE}: {e}")
            return []
    else:
        logger.info(f"File not found: {MULTIAGENTS_FILE}")
        return []

def save_multi_agents(multi_agents):
    with open(MULTIAGENTS_FILE, 'w') as f:
        json.dump(multi_agents, f, indent=4)

def load_connectors():
    connectors_dir = Path("data")
    connectors_dir.mkdir(parents=True, exist_ok=True)
    connectors_file = connectors_dir / "connectors.json"
    if connectors_file.exists():
        try:
            with open(connectors_file, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON from {connectors_file}")
            return []
    return []

def save_connectors(connectors):
    connectors_dir = Path("data")
    connectors_dir.mkdir(parents=True, exist_ok=True)
    connectors_file = connectors_dir / "connectors.json"
    with open(connectors_file, 'w') as f:
        json.dump(connectors, f, indent=4)

def load_tools() -> List[Tool]:
    try:
        with open('tools.json', 'r') as f:
            tools_data = json.load(f)
            return [Tool(**tool) for tool in tools_data]
    except FileNotFoundError:
        return [
            Tool(
                id="github",
                name="GitHub",
                description="Connect your GitHub repositories to automate code analysis, PR reviews, and issue management.",
                tags=["Code", "Version Control", "Automation"]
            ),
            Tool(
                id="slack",
                name="Slack",
                description="Integrate with Slack to receive notifications and interact with your workspace through chat commands.",
                tags=["Communication", "Notifications", "Chat"]
            ),
            Tool(
                id="discord",
                name="Discord",
                description="Connect your Discord server to manage community interactions and automate moderation tasks.",
                tags=["Community", "Chat", "Gaming"]
            ),
            Tool(
                id="clickup",
                name="ClickUp",
                description="Integrate with ClickUp to manage tasks, track progress, and automate project workflows.",
                tags=["Project Management", "Tasks", "Productivity"]
            ),
            Tool(
                id="spotify",
                name="Spotify",
                description="Control Spotify playback and manage playlists through automated commands.",
                tags=["Music", "Entertainment", "Media"]
            ),
            Tool(
                id="twitter",
                name="Twitter",
                description="Automate tweet scheduling, monitoring, and engagement with your Twitter audience.",
                tags=["Social Media", "Marketing", "Automation"]
            ),
            Tool(
                id="notion",
                name="Notion",
                description="Connect with Notion to manage documents, databases, and knowledge bases automatically.",
                tags=["Knowledge Base", "Documentation", "Organization"]
            ),
            Tool(
                id="outlook",
                name="Outlook",
                description="Integrate with Outlook to manage emails, calendar events, and contacts programmatically.",
                tags=["Email", "Calendar", "Communication"]
            )
        ]

def save_tools(tools: List[Tool]):
    with open('tools.json', 'w') as f:
        json.dump([tool.dict() for tool in tools], f, indent=2)

def load_custom_tools() -> List[Tool]:
    try:
        with open('custom_tools.json', 'r') as f:
            tools_data = json.load(f)
            return [Tool(**tool) for tool in tools_data]
    except FileNotFoundError:
        return []

def save_custom_tools(tools: List[Tool]):
    with open('custom_tools.json', 'w') as f:
        json.dump([tool.dict() for tool in tools], f, indent=2)

# --- Data Connector Models and APIs ---

class PostgresConnectionConfig(BaseModel):
    uniqueName: str
    vectorStoreUser: str
    vectorStoreHost: str
    vectorStorePassword: str
    vectorStorePort: str
    vectorStoreDBName: str
    connectorType: str = 'postgres'
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class BigQueryConnectionConfig(BaseModel):
    uniqueName: str
    projectId: str
    datasetId: str
    serviceAccountKey: str
    connectorType: str = 'bigquery'
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class PostgresConnectionTest(BaseModel):
    type: str
    config: Dict[str, Any]

@app.post("/api/data-connectors", status_code=201)
async def save_data_connector(connector_config: Union[PostgresConnectionConfig, BigQueryConnectionConfig]):
    if connector_config.connectorType not in ['postgres', 'bigquery']:
        raise HTTPException(status_code=400, detail="Only postgres and bigquery connectors are supported currently.")
        
    connectors = load_connectors()
    
    if any(c.get('uniqueName') == connector_config.uniqueName for c in connectors):
        raise HTTPException(status_code=409, detail=f"Connector with name '{connector_config.uniqueName}' already exists.")

    new_connector_dict = connector_config.dict()
    new_connector_dict['id'] = str(uuid.uuid4())
    new_connector_dict['createdAt'] = datetime.utcnow().isoformat()
    
    connectors.append(new_connector_dict)
    save_connectors(connectors)
    
    return new_connector_dict

@app.get("/api/data-connectors", response_model=List[Union[PostgresConnectionConfig, BigQueryConnectionConfig]])
async def get_data_connectors():
    connectors = load_connectors()
    return connectors

@app.put("/api/data-connectors/{connector_id}", response_model=Union[PostgresConnectionConfig, BigQueryConnectionConfig])
async def update_data_connector(connector_id: str, connector_config: Union[PostgresConnectionConfig, BigQueryConnectionConfig]):
    if not connector_id:
        raise HTTPException(status_code=400, detail="Connector ID is required")

    connectors = load_connectors()
    
    connector_index = None
    for i, connector in enumerate(connectors):
        if connector.get('id') == connector_id:
            connector_index = i
            break
    
    if connector_index is None:
        raise HTTPException(status_code=404, detail=f"Connector with ID '{connector_id}' not found.")

    name_conflict = any(
        c['uniqueName'] == connector_config.uniqueName and c['id'] != connector_id 
        for c in connectors
    )
    if name_conflict:
        raise HTTPException(
            status_code=409, 
            detail=f"Connector with name '{connector_config.uniqueName}' already exists."
        )

    existing_connector = connectors[connector_index]
    updated_connector = connector_config.dict()
    updated_connector['id'] = connector_id
    updated_connector['createdAt'] = existing_connector.get('createdAt')

    # For Postgres, preserve password if not provided
    if connector_config.connectorType == 'postgres' and not updated_connector.get('vectorStorePassword'):
        updated_connector['vectorStorePassword'] = existing_connector.get('vectorStorePassword', '')
    # For BigQuery, preserve service account key if not provided
    elif connector_config.connectorType == 'bigquery' and not updated_connector.get('serviceAccountKey'):
        updated_connector['serviceAccountKey'] = existing_connector.get('serviceAccountKey', '')

    connectors[connector_index] = updated_connector
    save_connectors(connectors)
    
    if connector_config.connectorType == 'postgres':
        return PostgresConnectionConfig(**updated_connector)
    else:
        return BigQueryConnectionConfig(**updated_connector)

@app.delete("/api/data-connectors/{connector_id}")
async def delete_data_connector(connector_id: str):
    # Check if any advanced tools are using this connector
    advanced_tools = load_advanced_tools()
    tools_using_connector = [tool.name for tool in advanced_tools if tool.data_connector_id == connector_id]
    
    # Check if any custom tools are using this connector
    custom_tools = load_custom_tools()
    metadata_dir = "tool_metadata"
    
    for tool in custom_tools:
        metadata_path = f"{metadata_dir}/{tool.id}.json"
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    if metadata.get('data_connector_id') == connector_id:
                        tools_using_connector.append(tool.name)
            except:
                # Skip if there's an issue reading metadata
                pass
    
    # If tools are using this connector, prevent deletion
    if tools_using_connector:
        tool_names = ", ".join(tools_using_connector)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete connector because it is being used by the following tools: {tool_names}"
        )
    
    # If no tools are using the connector, proceed with deletion
    connectors = load_connectors()
    connectors = [c for c in connectors if c["id"] != connector_id]
    save_connectors(connectors)
    return {"message": "Connector deleted successfully"}

if DISABLE_RUN:
    @app.post("/api/data-connectors/test")
    async def test_connection(connection_data: PostgresConnectionTest):
        if connection_data.type == "postgres":
            config = connection_data.config
            required_fields = ['host', 'port', 'database', 'user']
            missing_fields = [field for field in required_fields if not config.get(field)]
            
            if missing_fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required fields: {', '.join(missing_fields)}"
                )

            try:
                try:
                    port = int(config['port'])
                except ValueError:
                    raise HTTPException(status_code=400, detail="Port must be a valid number")

                conn = psycopg2.connect(
                    host=config['host'],
                    port=port,
                    database=config['database'],
                    user=config['user'],
                    password=config.get('password', ''),
                    connect_timeout=10
                )

                try:
                    with conn.cursor() as cur:
                        cur.execute('SELECT version();')
                        version = cur.fetchone()[0]
                
                    conn.close()

                    return {
                        "status": "success",
                        "message": "Connection successful",
                        "details": {
                            "version": version,
                            "connected_to": f"{config['host']}:{config['port']}/{config['database']}"
                        }
                    }

                except PostgresError as e:
                    if not conn.closed:
                        conn.close()
                    raise HTTPException(
                        status_code=400,
                        detail=f"Database query failed: {str(e)}"
                    )

            except PostgresError as e:
                error_message = str(e)
                if "timeout expired" in error_message.lower():
                    error_message = "Connection timed out. Please check if the database is accessible and the host/port are correct."
                elif "password authentication failed" in error_message.lower():
                    error_message = "Authentication failed. Please check your username and password."
                elif "database" in error_message.lower() and "does not exist" in error_message.lower():
                    error_message = f"Database '{config['database']}' does not exist."
                elif "could not connect to server" in error_message.lower():
                    error_message = "Could not connect to server. Please check if the host and port are correct and the server is running."

                raise HTTPException(
                    status_code=400,
                    detail=error_message
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"An unexpected error occurred: {str(e)}"
                )
        elif connection_data.type == "bigquery":
            config = connection_data.config
            required_fields = ['projectId', 'datasetId', 'serviceAccountKey']
            missing_fields = [field for field in required_fields if not config.get(field)]
            
            if missing_fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required fields: {', '.join(missing_fields)}"
                )

            try:
                # Parse service account key JSON
                try:
                    service_account_info = json.loads(config['serviceAccountKey'])
                except json.JSONDecodeError:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid service account key JSON format"
                    )

                # Initialize BigQuery client
                try:
                    credentials = service_account.Credentials.from_service_account_info(service_account_info)
                    client = bigquery.Client(credentials=credentials, project=config['projectId'])
                except Exception as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to initialize BigQuery client: {str(e)}"
                    )

                # Test dataset access
                try:
                    dataset_ref = client.dataset(config['datasetId'])
                    client.get_dataset(dataset_ref)
                    return {
                        "status": "success",
                        "message": "Connection successful",
                        "details": {
                            "project": config['projectId'],
                            "dataset": config['datasetId']
                        }
                    }
                except Exception as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to access dataset: {str(e)}"
                    )
                finally:
                    client.close()

            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"An unexpected error occurred: {str(e)}"
                )
        else:
            raise HTTPException(status_code=400, detail="Unsupported connector type")

# --- API Endpoints ---

@app.get("/api/agents")
async def get_agents():
    return load_agents()

@app.post("/api/agents")
async def create_agent(agent: AgentCreate):
    agents = load_agents()
    new_agent = Agent(
        id=str(uuid.uuid4()),
        **agent.dict()
    )
    agents.append(new_agent.dict())
    save_agents(agents)
    return new_agent

@app.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str):
    agents = load_agents()
    for agent in agents:
        if agent["id"] == agent_id:
            return agent
    raise HTTPException(status_code=404, detail="Agent not found")

@app.put("/api/agents/{agent_id}")
async def update_agent(agent_id: str, updated_agent: AgentCreate):
    agents = load_agents()
    for i, agent in enumerate(agents):
        if agent["id"] == agent_id:
            agents[i] = {
                "id": agent_id,
                **updated_agent.dict()
            }
            save_agents(agents)
            return agents[i]
    raise HTTPException(status_code=404, detail="Agent not found")

@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str):
    agents = load_agents()
    agents = [agent for agent in agents if agent["id"] != agent_id]
    save_agents(agents)
    return {"message": "Agent deleted"}

@app.get("/api/tools", response_model=List[Tool])
async def get_tools():
    built_in_tools = load_tools()
    custom_tools = load_custom_tools()
    return built_in_tools + custom_tools

@app.post("/api/tools/add")
async def add_tool(tool_id: str):
    tools = load_tools()
    for tool in tools:
        if tool.id == tool_id:
            tool.is_added = True
            break
    save_tools(tools)
    return {"message": "Tool added successfully"}

@app.post("/api/tools/custom")
async def create_custom_tool(tool: CustomTool):
    custom_tools = load_custom_tools()
    
    if any(t.name.lower() == tool.name.lower() for t in custom_tools):
        raise HTTPException(status_code=400, detail="Tool with this name already exists")
    
    new_tool = Tool(
        id=str(uuid.uuid4()),
        name=tool.name,
        description=tool.description,
        tags=tool.tags,
        is_custom=True,
        is_added=False
    )

    # Handle schema
    schema_dir = "tool_schemas"
    os.makedirs(schema_dir, exist_ok=True)
    with open(f"{schema_dir}/{new_tool.id}.json", 'w') as f:
        json.dump(tool.schema, f, indent=2)
    
    # Handle metadata (data connector)
    if tool.data_connector_id:
        metadata_dir = "tool_metadata"
        os.makedirs(metadata_dir, exist_ok=True)
        with open(f"{metadata_dir}/{new_tool.id}.json", 'w') as f:
            json.dump({"data_connector_id": tool.data_connector_id}, f, indent=2)
    
    custom_tools.append(new_tool)
    save_custom_tools(custom_tools)
    
    return new_tool

@app.get("/api/tools/{tool_id}/schema")
async def get_tool_schema(tool_id: str):
    schema_path = f"tool_schemas/{tool_id}.json"
    if not os.path.exists(schema_path):
        raise HTTPException(status_code=404, detail="Schema not found")
    
    with open(schema_path, 'r') as f:
        return json.load(f)

@app.put("/api/tools/{tool_id}/auth")
async def update_tool_auth(tool_id: str, auth: ToolAuth):
    auth_dir = "tool_auth"
    os.makedirs(auth_dir, exist_ok=True)
    
    auth_path = f"{auth_dir}/{tool_id}.json"
    with open(auth_path, 'w') as f:
        json.dump(auth.dict(), f, indent=2)
    
    return {"message": "Tool authentication updated"}

@app.get("/api/tools/{tool_id}")
async def get_tool(tool_id: str):
    tools = load_tools()
    custom_tools = load_custom_tools()
    all_tools = tools + custom_tools
    
    for tool in all_tools:
        if tool.id == tool_id:
            return tool
    raise HTTPException(status_code=404, detail="Tool not found")

@app.put("/api/tools/{tool_id}")
async def update_tool(tool_id: str, updated_tool: CustomTool):
    custom_tools = load_custom_tools()
    
    for i, tool in enumerate(custom_tools):
        if tool.id == tool_id:
            updated = Tool(
                id=tool_id,
                name=updated_tool.name,
                description=updated_tool.description,
                tags=updated_tool.tags,
                is_custom=True
            )
            
            schema_dir = "tool_schemas"
            with open(f"{schema_dir}/{tool_id}.json", 'w') as f:
                json.dump(updated_tool.schema, f, indent=2)
            
            # Handle metadata
            metadata_dir = "tool_metadata"
            metadata_path = f"{metadata_dir}/{tool_id}.json"
            
            if updated_tool.data_connector_id:
                # Update metadata with connector
                metadata = {"data_connector_id": updated_tool.data_connector_id}
                os.makedirs(metadata_dir, exist_ok=True)
                with open(metadata_path, 'w') as f:
                    json.dump(metadata, f, indent=2)
            else:
                # Remove metadata file if data connector is unselected
                if os.path.exists(metadata_path):
                    os.remove(metadata_path)
            
            custom_tools[i] = updated
            save_custom_tools(custom_tools)
            return updated
            
    raise HTTPException(status_code=404, detail="Tool not found")

@app.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: str):
    custom_tools = load_custom_tools()
    custom_tools = [tool for tool in custom_tools if tool.id != tool_id]
    save_custom_tools(custom_tools)
    
    schema_path = f"tool_schemas/{tool_id}.json"
    if os.path.exists(schema_path):
        os.remove(schema_path)
    
    auth_path = f"tool_auth/{tool_id}.json"
    if os.path.exists(auth_path):
        os.remove(auth_path)
    
    agents = load_agents()
    for agent in agents:
        if tool_id in agent.get('tools', []):
            agent['tools'].remove(tool_id)
        if tool_id in agent.get('advanced_tools', []):
            agent['advanced_tools'].remove(tool_id)
    save_agents(agents)
    
    return {"message": "Tool deleted"}

@app.get("/api/notifications")
async def get_notifications():
    return load_notifications()

@app.post("/api/notifications/{notification_id}/mark-read")
async def mark_notification_read(notification_id: str):
    notifications = load_notifications()
    for notification in notifications:
        if notification["id"] == notification_id:
            notification["read"] = True
            save_notifications(notifications)
            return {"message": "Notification marked as read"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/api/notifications/mark-all-read")
async def mark_all_notifications_read():
    notifications = load_notifications()
    for notification in notifications:
        notification["read"] = True
    save_notifications(notifications)
    return {"message": "All notifications marked as read"}

@app.get("/pages/{page_name}")
async def read_page_fragment(page_name: str):
    file_path = f"static/pages/{page_name}.html"
    if ".." in page_name or page_name.startswith("/"):
         raise HTTPException(status_code=404, detail="Page not found")
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    if page_name == "" or page_name == "home":
         if os.path.exists("static/pages/home.html"):
              return FileResponse("static/pages/home.html")
    raise HTTPException(status_code=404, detail="Page fragment not found")

# --- Agent Inference Models & Endpoint ---

class TableData(BaseModel):
    headers: List[str]
    rows: List[List[str]]

class ChartData(BaseModel):
    type: str
    data: Dict[str, Any]

class CodeData(BaseModel):
    language: str
    code: str

class ListData(BaseModel):
    items: List[str]

class TextData(BaseModel):
    text: str

class ErrorData(BaseModel):
    message: str
    details: Optional[str] = None

class MessageResponse(BaseModel):
    type: str
    content: Union[TextData, ErrorData, TableData, ChartData, CodeData, ListData, Dict[str, Any]]

class InferenceRequest(BaseModel):
    agentId: str
    userInput: str

ALLOWED_FILE_TYPES = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "text/csv": "csv",
    "application/json": "json",
    "text/plain": "text",
    "application/pdf": "pdf"
}

if DISABLE_RUN:
    @app.post("/api/agent/infer")
    async def agent_infer(
        agentId: str = Form(...),
        userInput: str = Form(...),
        file: Optional[UploadFile] = File(None)
    ):
        try:
            agents = load_agents()
            agent = next((a for a in agents if a["id"] == agentId), None)
            
            if not agent:
                return MessageResponse(
                    type="error",
                    content=ErrorData(
                        message="Agent not found",
                        details=f"No agent found with ID: {agentId}"
                    )
                )

            file_info = None
            file_path = None
            if file:
                contents = await file.read()
                file_size = len(contents)
                if file_size > 10 * 1024 * 1024:
                    return MessageResponse(
                        type="error",
                        content=ErrorData(
                            message="File too large",
                            details="Maximum file size is 10MB"
                        )
                    )

                if file.content_type not in ALLOWED_FILE_TYPES:
                    return MessageResponse(
                        type="error",
                        content=ErrorData(
                            message="Unsupported file type",
                            details=f"Only CSV, JSON, TXT, PDF, and image (JPEG, PNG, GIF) files are supported. Got: {file.content_type}"
                        )
                    )

                file_extension = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                file_path = UPLOAD_DIR / unique_filename

                with open(file_path, "wb") as buffer:
                    buffer.write(contents)

                file_info = {
                    "original_name": file.filename,
                    "saved_name": unique_filename,
                    "size": file_size,
                    "type": file.content_type,
                    "path": str(file_path),
                    "uploaded_at": datetime.now().isoformat()
                }
                logger.info(f"File saved: {file_path}")

            tools_config = []
            for tool_id in agent.get("tools", []):
                schema_path = f"tool_schemas/{tool_id}.json"
                auth_path = f"tool_auth/{tool_id}.json"
                
                if os.path.exists(schema_path):
                    tool_config = {"id": tool_id}
                    with open(schema_path, 'r') as f:
                        tool_config["schema"] = json.load(f)
                    if os.path.exists(auth_path):
                        with open(auth_path, 'r') as f:
                            tool_config["auth"] = json.load(f)
                    tools_config.append(tool_config)

            agent_config_dict = {
                "role": agent["role"],
                "goal": agent["goal"],
                "backstory": agent["backstory"],
                "instructions": agent["instructions"]
            }
            
            executor = TaskExecutor(agent_config=agent_config_dict, tools_config=tools_config)

            if userInput:
                agent["instructions"] = check_in_sentence(agent["instructions"], "{{input}}")

            result = executor.execute_task(
                description=agent["instructions"],
                expected_output=agent["expectedOutput"],
                task_name=agent["name"],
                input=userInput,
                file_path=file_path if file_info else None
            )
            logger.info(f"Agent inference result: {result}")

            response = MessageResponse(type="text", content=TextData(text=result))
            return response
            
        except Exception as e:
            logger.error(f"Error in agent_infer: {str(e)}")
            return MessageResponse(
                type="error",
                content=ErrorData(
                    message="Error processing request",
                    details=str(e)
                )
            )

    class MultiAgentInferenceRequest(BaseModel):
        multi_agent_id: str
        user_input: str

    @app.post("/api/multi_agent/infer")
    async def multi_agent_infer(request: MultiAgentInferenceRequest):
        try:
            multi_agent_id = request.multi_agent_id
            user_input = request.user_input
            
            logger.info(f"Received multi-agent infer request for ID: {multi_agent_id}")
            logger.debug(f"User input: {user_input}")

            if not user_input or user_input.strip() == "":
                logger.error("Empty or invalid user input provided.")
                raise HTTPException(status_code=400, detail="User input cannot be empty.")

            multi_agents = load_multi_agents()
            multi_agent_config = next((ma for ma in multi_agents if ma["id"] == multi_agent_id), None)
            
            if not multi_agent_config:
                logger.error(f"Multi-Agent not found: {multi_agent_id}")
                raise HTTPException(status_code=404, detail=f"Multi-Agent not found: {multi_agent_id}")

            multi_agent_config.setdefault("role", "Coordinator")
            multi_agent_config.setdefault("goal", "Efficiently manage and delegate tasks.")
            multi_agent_config.setdefault("backstory", "Orchestrator for connected agents.")
            multi_agent_config.setdefault("description", "Coordinate the processing of the user request by delegating to worker agents.")

            multi_agent_config.setdefault("expected_output", (
                "Agent Outputs:\n"
                "<agent_name> Output: <output from agent>\n"
                "(repeated for each agent in the sequence)\n"
            ))
            all_agents = load_agents()
            connected_agent_ids = multi_agent_config.get("agent_ids", [])
            worker_agent_configs = []

            for agent_id in connected_agent_ids:
                agent_data = next((a for a in all_agents if a["id"] == agent_id), None)
                if not agent_data:
                    logger.warning(f"Agent with ID {agent_id} not found, skipping.")
                    continue

                worker_tools_config = []
                for tool_id in agent_data.get("tools", []):
                    schema_path = f"tool_schemas/{tool_id}.json"
                    auth_path = f"tool_auth/{tool_id}.json"
                    tool_cfg = {"id": tool_id}

                    if os.path.exists(schema_path):
                        try:
                            with open(schema_path, 'r') as f:
                                tool_cfg["schema"] = json.load(f)
                        except json.JSONDecodeError as e:
                            logger.warning(f"Invalid JSON in schema file {schema_path} for agent {agent_id}: {e}")
                            continue
                    else:
                        logger.warning(f"Schema file not found for tool {tool_id} in agent {agent_id}")
                        continue

                    if os.path.exists(auth_path):
                        try:
                            with open(auth_path, 'r') as f:
                                tool_cfg["auth"] = json.load(f)
                        except json.JSONDecodeError as e:
                            logger.warning(f"Invalid JSON in auth file {auth_path} for agent {agent_id}: {e}")
                            tool_cfg["auth"] = {}

                    worker_tools_config.append(tool_cfg)

                worker_config = {
                    "id": agent_data["id"],
                    "name": agent_data.get("name", agent_data["role"]),
                    "role": agent_data["role"],
                    "goal": agent_data["goal"],
                    "backstory": agent_data["backstory"],
                    "instructions": agent_data.get("instructions", f"Perform tasks as {agent_data['role']}"),
                    "expectedOutput": agent_data.get("expectedOutput", "A contribution to the overall goal"),
                    "tools": worker_tools_config
                }
                worker_agent_configs.append(worker_config)
                logger.info(f"Loaded config for worker agent {agent_id} ({worker_config['name']})")

            if len(worker_agent_configs) < 2:
                logger.error("At least two worker agents are required.")
                raise HTTPException(status_code=400, detail="Multi-agent requires at least two worker agents.")

            if user_input:
                default_description = multi_agent_config["description"]
                if "{{input}}" in default_description:
                    multi_agent_config["description"] = default_description.replace("{{input}}", user_input)
                else:
                    multi_agent_config["description"] = f"{default_description}\nInput to process: {user_input}"

            executor = MultiAgentExecutor(
                multi_agent_config=multi_agent_config,
                worker_agent_configs=worker_agent_configs
            )

            result = executor.execute_task(user_input=user_input)
            logger.info("Multi-agent task completed successfully")

            return {
                "response": result,
                "sender_agent_name": "Manager Agent"
            }

        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            logger.error(f"Error in multi_agent_infer: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def check_in_sentence(sentence="", input_to_check="{{input}}"):
    sentence_lower = sentence.lower()
    input_lower = input_to_check.lower()
    
    if input_lower in sentence_lower:
        return sentence
    else:
        return sentence + "\n\n\ninput: " + input_to_check

@app.post("/api/agent/upload")
async def upload_file(file: UploadFile = File(...), agentId: str = None):
    try:
        if not agentId:
            return MessageResponse(
                type="error",
                content=ErrorData(
                    message="Agent ID is required",
                    details="No agent ID provided"
                )
            )

        file_size = 0
        contents = await file.read()
        file_size = len(contents)
        if file_size > 10 * 1024 * 1024:
            return MessageResponse(
                type="error",
                content=ErrorData(
                    message="File too large",
                    details="Maximum file size is 10MB"
                )
            )

        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename

        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        file_info = {
            "original_name": file.filename,
            "saved_name": unique_filename,
            "size": file_size,
            "type": file.content_type,
            "uploaded_at": datetime.now().isoformat()
        }

        if file.content_type.startswith('image/'):
            return MessageResponse(
                type="image",
                content={
                    "url": f"/static/uploads/{unique_filename}",
                    "info": file_info
                }
            )
        else:
            return MessageResponse(
                type="file",
                content={
                    "info": file_info,
                    "preview": None
                }
            )

    except Exception as e:
        return MessageResponse(
            type="error",
            content=ErrorData(
                message="File upload failed",
                details=str(e)
            )
        )

class MultiAgentCreate(BaseModel):
    name: str
    description: str
    agent_ids: List[str]
    role: Optional[str] = "Coordinator"
    goal: Optional[str] = "Efficiently manage and delegate tasks to connected agents based on user requests."
    backstory: Optional[str] = "I am a manager agent responsible for orchestrating multiple specialized agents to achieve complex goals."
    expected_output: str

class MultiAgent(MultiAgentCreate):
    id: str

@app.get("/api/multi-agents")
async def get_multi_agents():
    return load_multi_agents()

@app.post("/api/multi-agents")
async def create_multi_agent(multi_agent: MultiAgentCreate):
    multi_agents = load_multi_agents()
    agent_data = multi_agent.dict(exclude_unset=False)
    new_multi_agent = MultiAgent(
        id=str(uuid.uuid4()),
        **agent_data
    )
    multi_agents.append(new_multi_agent.dict())
    save_multi_agents(multi_agents)
    return new_multi_agent

@app.get("/api/multi-agents/{multi_agent_id}")
async def get_multi_agent(multi_agent_id: str):
    multi_agents = load_multi_agents()
    for ma in multi_agents:
        if ma["id"] == multi_agent_id:
            ma.setdefault("role", "Coordinator")
            ma.setdefault("goal", "Efficiently manage and delegate tasks.")
            ma.setdefault("backstory", "Orchestrator for connected agents.")
            return ma
    raise HTTPException(status_code=404, detail="Multi-Agent not found")

@app.put("/api/multi-agents/{multi_agent_id}")
async def update_multi_agent(multi_agent_id: str, updated_multi_agent: MultiAgentCreate):
    multi_agents = load_multi_agents()
    for i, ma in enumerate(multi_agents):
        if ma["id"] == multi_agent_id:
            updated_data = updated_multi_agent.dict(exclude_unset=False)
            multi_agents[i] = {
                "id": multi_agent_id,
                **updated_data
            }
            save_multi_agents(multi_agents)
            return multi_agents[i]
    raise HTTPException(status_code=404, detail="Multi-Agent not found")

@app.delete("/api/multi-agents/{multi_agent_id}")
async def delete_multi_agent(multi_agent_id: str):
    multi_agents = load_multi_agents()
    multi_agents = [ma for ma in multi_agents if ma["id"] != multi_agent_id]
    save_multi_agents(multi_agents)
    return {"message": "Multi-Agent deleted"}

class TimeRequest(BaseModel):
    hour: Optional[int] = None

@app.post("/greet", summary="Get a greeting message")
async def get_greeting(request: TimeRequest):
    now_utc = datetime.utcnow()
    now_bengaluru = now_utc + timedelta(hours=5, minutes=30)

    hour = request.hour if request.hour is not None else now_bengaluru.hour

    if not (0 <= hour <= 23):
        raise HTTPException(status_code=400, detail="Hour must be between 0 and 23.")

    if 5 <= hour < 12:
        greeting = "Good morning!"
    elif 12 <= hour < 18:
        greeting = "Good afternoon!"
    elif 18 <= hour < 22:
        greeting = "Good evening!"
    else:
        greeting = "Good night!"

    return {"greeting": greeting}

class TextRequest(BaseModel):
    text: str

EMOJI_MAP = {
    "morning": "☀️",
    "afternoon": "🌤️",
    "evening": "🌙",
    "night": "🌜",
    "hello": "👋",
    "hi": "😊",
    "hey": "🙌",
}

@app.post("/process", summary="Process text")
async def process_text(request: TextRequest):
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    emoji = next((emoji for keyword, emoji in EMOJI_MAP.items() if keyword in text.lower()), "✨")
    
    processed_text = f"{text} {emoji}"

    return {"result": processed_text}

# --- Advanced Tool Models ---
class AdvancedTool(BaseModel):
    id: str
    name: str
    description: str
    tags: List[str]
    schema: Dict[str, Any]
    data_connector_id: Optional[str] = None
    connector_uniqueName: Optional[str] = None
    connectorType: Optional[str] = None
    is_added: bool = False

class AdvancedToolCreate(BaseModel):
    name: str
    description: str
    tags: List[str]
    schema: Dict[str, Any]
    data_connector_id: Optional[str] = None

def load_advanced_tools() -> List[AdvancedTool]:
    try:
        with open('advanced_tools.json', 'r') as f:
            tools_data = json.load(f)
            return [AdvancedTool(**tool) for tool in tools_data]
    except FileNotFoundError:
        return []

def save_advanced_tools(tools: List[AdvancedTool]):
    with open('advanced_tools.json', 'w') as f:
        json.dump([tool.dict() for tool in tools], f, indent=2)

# --- Advanced Tool Endpoints ---
@app.get("/api/advanced-tools", response_model=List[AdvancedTool])
async def get_advanced_tools():
    logger.info("Fetching advanced tools")
    tools = load_advanced_tools()
    connectors = load_connectors()
    
    # Create a mapping of connector IDs to their names and types
    connector_map = {
        connector['id']: {
            'uniqueName': connector['uniqueName'],
            'connectorType': connector['connectorType']
        } for connector in connectors
    }
    
    # Add connector name and type to each tool
    for tool in tools:
        if tool.data_connector_id and tool.data_connector_id in connector_map:
            tool.connector_uniqueName = connector_map[tool.data_connector_id]['uniqueName']
            tool.connectorType = connector_map[tool.data_connector_id]['connectorType']
        else:
            tool.connector_uniqueName = None
            tool.connectorType = None
            
    logger.info(f"Returning {len(tools)} advanced tools")
    return tools

@app.post("/api/advanced-tools")
async def create_advanced_tool(tool: AdvancedToolCreate):
    if tool.data_connector_id:
        connectors = load_connectors()
        if not any(c["id"] == tool.data_connector_id for c in connectors):
            raise HTTPException(status_code=400, detail="Invalid data connector ID")

    tools = load_advanced_tools()
    
    if any(t.name.lower() == tool.name.lower() for t in tools):
        raise HTTPException(status_code=400, detail="Tool with this name already exists")
    
    new_tool = AdvancedTool(
        id=str(uuid.uuid4()),
        name=tool.name,
        description=tool.description,
        tags=tool.tags,
        schema=tool.schema,
        data_connector_id=tool.data_connector_id,
        is_added=False
    )
    
    schema_dir = "tool_schemas"
    os.makedirs(schema_dir, exist_ok=True)
    with open(f"{schema_dir}/{new_tool.id}.json", 'w') as f:
        json.dump(tool.schema, f, indent=2)
    
    tools.append(new_tool)
    save_advanced_tools(tools)
    
    return new_tool

@app.get("/api/advanced-tools/{tool_id}")
async def get_advanced_tool(tool_id: str):
    tools = load_advanced_tools()
    for tool in tools:
        if tool.id == tool_id:
            return tool
    raise HTTPException(status_code=404, detail="Advanced tool not found")

@app.put("/api/advanced-tools/{tool_id}")
async def update_advanced_tool(tool_id: str, updated_tool: AdvancedToolCreate):
    tools = load_advanced_tools()
    
    if updated_tool.data_connector_id:
        connectors = load_connectors()
        if not any(c["id"] == updated_tool.data_connector_id for c in connectors):
            raise HTTPException(status_code=400, detail="Invalid data connector ID")
    
    for i, tool in enumerate(tools):
        if tool.id == tool_id:
            if any(t.name.lower() == updated_tool.name.lower() and t.id != tool_id for t in tools):
                raise HTTPException(status_code=400, detail="Tool with this name already exists")
            
            updated = AdvancedTool(
                id=tool_id,
                name=updated_tool.name,
                description=updated_tool.description,
                tags=updated_tool.tags,
                schema=updated_tool.schema,
                data_connector_id=updated_tool.data_connector_id,
                is_added=tool.is_added
            )
            
            schema_dir = "tool_schemas"
            with open(f"{schema_dir}/{tool_id}.json", 'w') as f:
                json.dump(updated_tool.schema, f, indent=2)
            
            tools[i] = updated
            save_advanced_tools(tools)
            return updated
            
    raise HTTPException(status_code=404, detail="Advanced tool not found")

@app.delete("/api/advanced-tools/{tool_id}")
async def delete_advanced_tool(tool_id: str):
    tools = load_advanced_tools()
    tools = [tool for tool in tools if tool.id != tool_id]
    save_advanced_tools(tools)
    
    schema_path = f"tool_schemas/{tool_id}.json"
    if os.path.exists(schema_path):
        os.remove(schema_path)
    
    # Remove references from agents
    agents = load_agents()
    for agent in agents:
        if tool_id in agent.get('advanced_tools', []):
            agent['advanced_tools'].remove(tool_id)
    save_agents(agents)
    
    return {"message": "Advanced tool deleted"}

@app.post("/api/advanced-tools/{tool_id}/add")
async def add_advanced_tool(tool_id: str):
    tools = load_advanced_tools()
    for tool in tools:
        if tool.id == tool_id:
            tool.is_added = True
            save_advanced_tools(tools)
            return {"message": "Advanced tool added successfully"}
    raise HTTPException(status_code=404, detail="Advanced tool not found")

@app.get("/api/tools/{tool_id}/metadata")
async def get_tool_metadata(tool_id: str):
    metadata_path = f"tool_metadata/{tool_id}.json"
    if not os.path.exists(metadata_path):
        return {}  # Return empty metadata if none exists
    
    with open(metadata_path, 'r') as f:
        return json.load(f)

# --- Catch-all Route for SPA (MUST BE LAST) ---
@app.get("/{full_path:path}")
async def serve_frontend(request: Request):
    full_path = request.path_params.get("full_path", "")
    logger.info(f"Catch-all route matched for path: {full_path}")

    # Exclude API, static, and other reserved paths
    reserved_prefixes = ["/api/", "/static/", "/pages/"]
    if any(full_path.startswith(prefix) for prefix in reserved_prefixes):
        logger.warning(f"Reserved path accessed via catch-all: {full_path}")
        raise HTTPException(status_code=404, detail="Resource not found")

    # Special handling for multi-agents page
    if full_path == "multi-agents":
        return FileResponse("static/index.html")

    # Serve index.html for SPA routes
    potential_file_path = f"static/{full_path}"
    if not os.path.exists(potential_file_path) or os.path.isdir(potential_file_path):
        if full_path not in ["favicon.ico"]:
            return FileResponse("static/index.html")

    return FileResponse("static/index.html")