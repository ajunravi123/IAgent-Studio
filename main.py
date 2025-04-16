from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Dict, Optional, List, Union, Any
import json
import os
import uuid
from datetime import datetime, timedelta
import shutil
from pathlib import Path
from task_executor import TaskExecutor
from multi_agent_executor import MultiAgentExecutor
from langchain.tools import Tool # If tools are needed for manager/agents
import psycopg2
from psycopg2 import Error as PostgresError


import logging
# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


app = FastAPI()

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

class Tool(BaseModel):
    id: str
    name: str
    description: str
    # icon: str
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
    # icon: str
    tags: List[str]
    schema: Dict[str, Any] #OpenAPISchema
    is_custom: bool = True

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
CONNECTORS_FILE = "data/connectors.json" # New file for connectors

def load_agents():
    if os.path.exists(AGENTS_FILE):
        with open(AGENTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_agents(agents):
    with open(AGENTS_FILE, 'w') as f:
        json.dump(agents, f)

def load_multi_agents():
    print(f"Attempting to load multi-agents from: {MULTIAGENTS_FILE}")
    if os.path.exists(MULTIAGENTS_FILE):
        print(f"File found: {MULTIAGENTS_FILE}")
        try:
            with open(MULTIAGENTS_FILE, 'r') as f:
                data = json.load(f)
                print(f"Successfully loaded and parsed JSON data: {data}")
                return data
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from {MULTIAGENTS_FILE}: {e}")
            return [] # Return empty list on decode error
        except Exception as e:
            print(f"An unexpected error occurred while reading {MULTIAGENTS_FILE}: {e}")
            return []
    else:
        print(f"File not found: {MULTIAGENTS_FILE}")
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
        # Return default tools if file doesn't exist
        return [
            Tool(
                id="github",
                name="GitHub",
                description="Connect your GitHub repositories to automate code analysis, PR reviews, and issue management.",
                # icon="/static/images/github-icon.svg",
                tags=["Code", "Version Control", "Automation"]
            ),
            Tool(
                id="slack",
                name="Slack",
                description="Integrate with Slack to receive notifications and interact with your workspace through chat commands.",
                # icon="/static/images/slack-icon.svg",
                tags=["Communication", "Notifications", "Chat"]
            ),
            Tool(
                id="discord",
                name="Discord",
                description="Connect your Discord server to manage community interactions and automate moderation tasks.",
                # icon="/static/images/discord-icon.svg",
                tags=["Community", "Chat", "Gaming"]
            ),
            Tool(
                id="clickup",
                name="ClickUp",
                description="Integrate with ClickUp to manage tasks, track progress, and automate project workflows.",
                # icon="/static/images/clickup-icon.svg",
                tags=["Project Management", "Tasks", "Productivity"]
            ),
            Tool(
                id="spotify",
                name="Spotify",
                description="Control Spotify playback and manage playlists through automated commands.",
                # icon="/static/images/spotify-icon.svg",
                tags=["Music", "Entertainment", "Media"]
            ),
            Tool(
                id="twitter",
                name="Twitter",
                description="Automate tweet scheduling, monitoring, and engagement with your Twitter audience.",
                # icon="/static/images/twitter-icon.svg",
                tags=["Social Media", "Marketing", "Automation"]
            ),
            Tool(
                id="notion",
                name="Notion",
                description="Connect with Notion to manage documents, databases, and knowledge bases automatically.",
                # icon="/static/images/notion-icon.svg",
                tags=["Knowledge Base", "Documentation", "Organization"]
            ),
            Tool(
                id="outlook",
                name="Outlook",
                description="Integrate with Outlook to manage emails, calendar events, and contacts programmatically.",
                # icon="/static/images/outlook-icon.svg",
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

# --- Data Connector Models (Moved Here) ---
class PostgresConnectionConfig(BaseModel):
    uniqueName: str
    vectorStoreUser: str
    vectorStoreHost: str
    vectorStorePassword: str # Keep as string for now, consider encryption later
    vectorStorePort: str # Often string, but could be int
    vectorStoreDBName: str
    connectorType: str = 'postgres' # Added in JS, but good to have default
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

# --- Helper Functions ---

# ... load/save notifications, load/save agents, load/save multi-agents, load/save connectors, load/save tools, load/save custom tools ...

# --- API Endpoints ---

# Agent Endpoints
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

# Tool Endpoints
@app.get("/api/tools", response_model=List[Tool])
async def get_tools():
    # Combine built-in and custom tools
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
    
    # Check if tool with same name exists
    if any(t.name.lower() == tool.name.lower() for t in custom_tools):
        raise HTTPException(status_code=400, detail="Tool with this name already exists")
    
    # Create new tool
    new_tool = Tool(
        id=str(uuid.uuid4()),
        name=tool.name,
        description=tool.description,
        # icon=tool.icon,
        tags=tool.tags,
        is_custom=True,
        is_added=False
    )
    
    # Save OpenAPI schema separately
    schema_dir = "tool_schemas"
    os.makedirs(schema_dir, exist_ok=True)
    with open(f"{schema_dir}/{new_tool.id}.json", 'w') as f:
        json.dump(tool.schema, f, indent=2)
    
    # Save tool
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
    """Update authentication for a tool"""
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
                # icon=updated_tool.icon,
                tags=updated_tool.tags,
                is_custom=True
            )
            
            # Update schema
            schema_dir = "tool_schemas"
            with open(f"{schema_dir}/{tool_id}.json", 'w') as f:
                json.dump(updated_tool.schema, f, indent=2)
            
            custom_tools[i] = updated
            save_custom_tools(custom_tools)
            return updated
            
    raise HTTPException(status_code=404, detail="Tool not found")

@app.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: str):
    custom_tools = load_custom_tools()
    custom_tools = [tool for tool in custom_tools if tool.id != tool_id]
    save_custom_tools(custom_tools)
    
    # Delete schema file if exists
    schema_path = f"tool_schemas/{tool_id}.json"
    if os.path.exists(schema_path):
        os.remove(schema_path)
    
    # Delete auth file if exists
    auth_path = f"tool_auth/{tool_id}.json"
    if os.path.exists(auth_path):
        os.remove(auth_path)
    
    # Remove tool from agents
    agents = load_agents()
    for agent in agents:
        if tool_id in agent.get('tools', []):
            agent['tools'].remove(tool_id)
    save_agents(agents)
    
    return {"message": "Tool deleted"}

# Notification Endpoints
@app.get("/api/notifications")
async def get_notifications():
    """Get all notifications"""
    return load_notifications()

@app.post("/api/notifications/{notification_id}/mark-read")
async def mark_notification_read(notification_id: str):
    """Mark a single notification as read"""
    notifications = load_notifications()
    for notification in notifications:
        if notification["id"] == notification_id:
            notification["read"] = True
            save_notifications(notifications)
            return {"message": "Notification marked as read"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/api/notifications/mark-all-read")
async def mark_all_notifications_read():
    """Mark all notifications as read"""
    notifications = load_notifications()
    for notification in notifications:
        notification["read"] = True
    save_notifications(notifications)
    return {"message": "All notifications marked as read"}

# HTML Fragment Endpoint
@app.get("/pages/{page_name}")
async def read_page_fragment(page_name: str):
    file_path = f"static/pages/{page_name}.html"
    # Basic security check to prevent path traversal
    if ".." in page_name or page_name.startswith("/"):
         raise HTTPException(status_code=404, detail="Page not found")
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    # Optionally, try loading index if page_name is empty or 'home'
    if page_name == "" or page_name == "home":
         if os.path.exists("static/pages/home.html"):
              return FileResponse("static/pages/home.html")
    raise HTTPException(status_code=404, detail="Page fragment not found")

# --- Agent Inference Models & Endpoint ---

# Response models for different message types
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
    type: str  # One of: "text", "error", "table", "chart", "code", "list", "image", "file"
    content: Union[TextData, ErrorData, TableData, ChartData, CodeData, ListData, Dict[str, Any]]

class InferenceRequest(BaseModel):
    agentId: str
    userInput: str

# Allowed file types (MIME types mapped to categories)
ALLOWED_FILE_TYPES = {
    "image/jpeg": "image",  # Covers both .jpg and .jpeg
    "image/png": "image",
    "image/gif": "image",
    "text/csv": "csv",
    "application/json": "json",
    "text/plain": "text",
    "application/pdf": "pdf"
}

@app.post("/api/agent/infer")
async def agent_infer(
    agentId: str = Form(...),
    userInput: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    # ... function body ...
    pass # Placeholder for agent_infer logic

def check_in_sentence(sentence="", input_to_check="{{input}}"):
    # ... function body ...
    pass # Placeholder for check_in_sentence logic

@app.post("/api/agent/upload")
async def upload_file(file: UploadFile = File(...), agentId: str = None):
    # ... function body ...
    pass # Placeholder for upload_file logic

# --- Multi-Agent Models & Endpoints ---

class MultiAgentInferenceRequest(BaseModel):
    multi_agent_id: str
    user_input: str
    # Add file handling if needed later

class MultiAgentCreate(BaseModel):
    name: str
    description: str
    agent_ids: List[str]
    role: Optional[str] = "Coordinator"
    goal: Optional[str] = "Efficiently manage and delegate tasks to connected agents based on user requests."
    backstory: Optional[str] = "I am a manager agent responsible for orchestrating multiple specialized agents to achieve complex goals."
    expected_output: str # Make mandatory

class MultiAgent(MultiAgentCreate):
    id: str

@app.post("/api/multi_agent/infer")
async def multi_agent_infer(request: MultiAgentInferenceRequest):
    # ... function body ...
    pass # Placeholder for multi_agent_infer logic

@app.get("/api/multi-agents")
async def get_multi_agents():
    return load_multi_agents()

@app.post("/api/multi-agents")
async def create_multi_agent(multi_agent: MultiAgentCreate):
    # ... function body ...
    pass # Placeholder for create_multi_agent logic

@app.get("/api/multi-agents/{multi_agent_id}")
async def get_multi_agent(multi_agent_id: str):
    # ... function body ...
    pass # Placeholder for get_multi_agent logic

@app.put("/api/multi-agents/{multi_agent_id}")
async def update_multi_agent(multi_agent_id: str, updated_multi_agent: MultiAgentCreate):
    # ... function body ...
    pass # Placeholder for update_multi_agent logic

@app.delete("/api/multi-agents/{multi_agent_id}")
async def delete_multi_agent(multi_agent_id: str):
    # ... function body ...
    pass # Placeholder for delete_multi_agent logic

# --- Data Connectors API (Moved Here) ---
@app.post("/api/data-connectors", status_code=201)
async def save_data_connector(connector_config: PostgresConnectionConfig):
    # For now, we only support Postgres, but this could be expanded
    if connector_config.connectorType != 'postgres':
        raise HTTPException(status_code=400, detail="Only postgres connectors are supported currently.")
        
    connectors = load_connectors()
    
    # Check if a connector with the same uniqueName already exists
    if any(c.get('uniqueName') == connector_config.uniqueName for c in connectors):
        # Option 1: Raise error
         raise HTTPException(status_code=409, detail=f"Connector with name '{connector_config.uniqueName}' already exists.")
    else:
        # Add new connector
        new_connector_dict = connector_config.dict()
        connectors.append(new_connector_dict)
    
    save_connectors(connectors)
    return connector_config # Return the Pydantic model which includes the ID

@app.get("/api/data-connectors", response_model=List[PostgresConnectionConfig])
async def get_data_connectors():
    connectors = load_connectors()
    return connectors

@app.put("/api/data-connectors/{connector_id}", response_model=PostgresConnectionConfig)
async def update_data_connector(connector_id: str, connector_config: PostgresConnectionConfig):
    connectors = load_connectors()
    
    for i, connector in enumerate(connectors):
        if connector["id"] == connector_id:
            if any(c["uniqueName"] == connector_config.uniqueName and c["id"] != connector_id for c in connectors):
                raise HTTPException(status_code=409, detail=f"Connector with name '{connector_config.uniqueName}' already exists.")
            
            # Create a new dictionary for the updated connector, preserving the ID
            updated_connector_dict = connector_config.dict()
            updated_connector_dict["id"] = connector_id # Ensure ID is preserved
            
            connectors[i] = updated_connector_dict
            save_connectors(connectors)
            # Return the updated Pydantic model
            return PostgresConnectionConfig(**connectors[i])
    
    raise HTTPException(status_code=404, detail=f"Connector with ID '{connector_id}' not found.")

@app.delete("/api/data-connectors/{connector_id}")
async def delete_data_connector(connector_id: str):
    connectors = load_connectors()
    connectors = [c for c in connectors if c["id"] != connector_id]
    save_connectors(connectors)
    return {"message": "Connector deleted successfully"}

# Add new model for connection testing
class PostgresConnectionTest(BaseModel):
    type: str
    config: Dict[str, Any]

# Add the test connection endpoint
@app.post("/api/data-connectors/test")
async def test_connection(connection_data: PostgresConnectionTest):
    if connection_data.type != "postgres":
        raise HTTPException(status_code=400, detail="Only PostgreSQL connections are supported")
    
    config = connection_data.config
    required_fields = ['host', 'port', 'database', 'user']
    missing_fields = [field for field in required_fields if not config.get(field)]
    
    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing_fields)}"
        )

    try:
        # Convert port to integer if it's a string
        try:
            port = int(config['port'])
        except ValueError:
            raise HTTPException(status_code=400, detail="Port must be a valid number")

        # Attempt to establish connection
        conn = psycopg2.connect(
            host=config['host'],
            port=port,
            database=config['database'],
            user=config['user'],
            password=config.get('password', ''),
            # Add a shorter timeout for connection testing
            connect_timeout=10
        )

        try:
            # Test the connection with a simple query
            with conn.cursor() as cur:
                cur.execute('SELECT version();')
                version = cur.fetchone()[0]
            
            # Close the connection properly
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
        # Handle different PostgreSQL error cases
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

# --- Other Example Endpoints (Keep after specific APIs) ---

# ... TimeRequest, get_greeting ...
# ... TextRequest, process_text ...

# --- Catch-all Route for SPA (MUST BE LAST) ---
@app.get("/{full_path:path}")
async def serve_frontend(request: Request):
    full_path = request.path_params.get("full_path", "")
    # Special handling for multi-agents page
    if full_path == "multi-agents":
        return FileResponse("static/index.html")

    # Existing logic to serve index.html for SPA routes
    # Assuming this logic is needed for other routes
    # You might need to adjust this based on your exact SPA routing needs
    potential_file_path = f"static/{full_path}"
    if not os.path.exists(potential_file_path) or os.path.isdir(potential_file_path):
        # If the path doesn't correspond to an existing file/directory in static,
        # assume it's an SPA route and serve index.html
        if full_path not in ["favicon.ico"]: # Add other static assets if needed
             return FileResponse("static/index.html")

    # Default: Let StaticFiles handle existing static assets
    # Or explicitly return index.html if that's the desired fallback
    return FileResponse("static/index.html")








class TimeRequest(BaseModel):
    hour: Optional[int] = None  # Python 3.8 compatible annotation

@app.post("/greet", summary="Get a greeting message")
async def get_greeting(request: TimeRequest):
    # Get the current UTC time and convert to IST (UTC+5:30)
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


# Pydantic model for TextRequest (used by /process)
class TextRequest(BaseModel):
    text: str

# Process text endpoint
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

    # Find a relevant emoji based on keywords in the text
    emoji = next((emoji for keyword, emoji in EMOJI_MAP.items() if keyword in text.lower()), "✨")
    
    # Append emoji to the processed text
    processed_text = f"{text} {emoji}"

    return {"result": processed_text}