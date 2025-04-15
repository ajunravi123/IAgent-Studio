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

# API endpoints for agents
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

# Endpoint to serve HTML page fragments for dynamic loading
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

# API endpoint for agent inference (chat)

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
    try:
        # Get the agent from storage
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

        # Handle file upload if present
        file_info = None
        file_path = None
        if file:
            # Validate file size (max 10MB)
            contents = await file.read()
            file_size = len(contents)
            if file_size > 10 * 1024 * 1024:  # 10MB
                return MessageResponse(
                    type="error",
                    content=ErrorData(
                        message="File too large",
                        details="Maximum file size is 10MB"
                    )
                )

            # Check file type (case-insensitive MIME type check)
            if file.content_type not in ALLOWED_FILE_TYPES:
                return MessageResponse(
                    type="error",
                    content=ErrorData(
                        message="Unsupported file type",
                        details=f"Only CSV, JSON, TXT, PDF, and image (JPEG, PNG, GIF) files are supported. Got: {file.content_type}"
                    )
                )

            # Generate unique filename (preserve original extension case)
            file_extension = os.path.splitext(file.filename)[1]  # Keeps case, e.g., .JPEG or .jpeg
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = UPLOAD_DIR / unique_filename

            # Save file
            with open(file_path, "wb") as buffer:
                buffer.write(contents)

            # Store file info
            file_info = {
                "original_name": file.filename,
                "saved_name": unique_filename,
                "size": file_size,
                "type": file.content_type,
                "path": str(file_path),
                "uploaded_at": datetime.now().isoformat()
            }
            print(f"File saved: {file_path}")

        # Get API keys from environment variables
        # API_KEYS = {
        #     "gemini": os.getenv("GEMINI_API_KEY"),
        #     "openai": os.getenv("OPENAI_API_KEY"),
        #     "groq": os.getenv("GROQ_API_KEY"),
        # }

        # Load tool configurations for this agent
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

        # Pass the single agent configuration dict and tools_config list to TaskExecutor
        agent_config_dict = {
            "role": agent["role"],
            "goal": agent["goal"],
            "backstory": agent["backstory"],
            "instructions": agent["instructions"] # Pass instructions here
        }
        
        # Instantiate the single-agent executor
        executor = TaskExecutor(agent_config=agent_config_dict, tools_config=tools_config)


        if userInput:
            agent["instructions"] = check_in_sentence(agent["instructions"], "{{input}}")

        # Execute the task using the original TaskExecutor logic
        result = executor.execute_task(
            description=agent["instructions"], # Base instructions
            expected_output=agent["expectedOutput"],
            task_name=agent["name"],
            input=userInput, # Pass user input as kwarg
            file_path=file_path if file_info else None
        )
        print(result)

        response = MessageResponse(type="text", content=TextData(text=result))
        return response
        
    except Exception as e:
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
    # Add file handling if needed later



@app.post("/api/multi_agent/infer")
async def multi_agent_infer(request: MultiAgentInferenceRequest):
    try:
        multi_agent_id = request.multi_agent_id
        user_input = request.user_input
        
        logger.info(f"Received multi-agent infer request for ID: {multi_agent_id}")
        logger.debug(f"User input: {user_input}")

        # Load multi-agent configuration
        multi_agents = load_multi_agents()
        multi_agent_config = next((ma for ma in multi_agents if ma["id"] == multi_agent_id), None)
        
        if not multi_agent_config:
            logger.error(f"Multi-Agent not found: {multi_agent_id}")
            raise HTTPException(status_code=404, detail=f"Multi-Agent not found: {multi_agent_id}")

        # Set default values for manager config
        multi_agent_config.setdefault("role", "Coordinator")
        multi_agent_config.setdefault("goal", "Efficiently manage and delegate tasks.")
        multi_agent_config.setdefault("backstory", "Orchestrator for connected agents.")
        multi_agent_config.setdefault("description", "Process the user request using available agents.")

        # Load worker agent configurations
        all_agents = load_agents()
        connected_agent_ids = multi_agent_config.get("agent_ids", [])
        worker_agent_configs = []

        for agent_id in connected_agent_ids:
            agent_data = next((a for a in all_agents if a["id"] == agent_id), None)
            if not agent_data:
                logger.warning(f"Agent with ID {agent_id} not found, skipping.")
                continue

            # Load tool configurations
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

            # Prepare worker config
            worker_config = {
                "id": agent_data["id"],
                "name": agent_data.get("name", agent_data["role"]),  # Add name, fallback to role
                "role": agent_data["role"],
                "goal": agent_data["goal"],
                "backstory": agent_data["backstory"],
                "instructions": agent_data.get("instructions", f"Perform tasks as {agent_data['role']}"),
                "expectedOutput": agent_data.get("expectedOutput", "A contribution to the overall goal"),
                "tools": worker_tools_config
            }
            worker_agent_configs.append(worker_config)
            logger.info(f"Loaded config for worker agent {agent_id} ({worker_config['name']})")

        if not worker_agent_configs:
            logger.error("No valid connected agents found.")
            raise HTTPException(status_code=400, detail="No valid connected agents found.")

        # Update manager description with user input
        if user_input:
            multi_agent_config["description"] = (
                multi_agent_config["description"].replace("{{input}}", user_input)
                if "{{input}}" in multi_agent_config["description"]
                else f"{multi_agent_config['description']}\n\nUser Input: {user_input}"
            )

        # Instantiate and execute
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
    """
    Check if input_to_check exists in the given sentence and modify sentence if not found.
    
    Parameters:
    sentence (str): The sentence to search in
    input_to_check (str): The word/phrase to look for
    
    Returns:
    str: Original sentence if input found, modified sentence if not found
    """
    # Convert both to lowercase for case-insensitive comparison
    sentence_lower = sentence.lower()
    input_lower = input_to_check.lower()
    
    # Check if input exists in sentence
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

        # Validate file size (max 10MB)
        file_size = 0
        contents = await file.read()
        file_size = len(contents)
        if file_size > 10 * 1024 * 1024:  # 10MB
            return MessageResponse(
                type="error",
                content=ErrorData(
                    message="File too large",
                    details="Maximum file size is 10MB"
                )
            )

        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename

        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        # Get file info
        file_info = {
            "original_name": file.filename,
            "saved_name": unique_filename,
            "size": file_size,
            "type": file.content_type,
            "uploaded_at": datetime.now().isoformat()
        }

        # For images, return preview
        if file.content_type.startswith('image/'):
            return MessageResponse(
                type="image",
                content={
                    "url": f"/static/uploads/{unique_filename}",
                    "info": file_info
                }
            )
        else:
            # For other files, return file info
            return MessageResponse(
                type="file",
                content={
                    "info": file_info,
                    "preview": None  # You could add text preview for text files here
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

# API endpoints for multi-agents
class MultiAgentCreate(BaseModel):
    name: str
    description: str
    agent_ids: List[str]
    role: Optional[str] = "Coordinator"
    goal: Optional[str] = "Efficiently manage and delegate tasks to connected agents based on user requests."
    backstory: Optional[str] = "I am a manager agent responsible for orchestrating multiple specialized agents to achieve complex goals."

class MultiAgent(MultiAgentCreate):
    id: str

@app.get("/api/multi-agents")
async def get_multi_agents():
    return load_multi_agents()

@app.post("/api/multi-agents")
async def create_multi_agent(multi_agent: MultiAgentCreate):
    multi_agents = load_multi_agents()
    # Ensure default values are included if not provided
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
            # Ensure defaults are present for older entries
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
            # Merge update, keeping the ID and ensuring defaults are included
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

# Catch-all route to serve the main index.html for any other path
# This MUST be defined AFTER all API routes and static file mounts
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