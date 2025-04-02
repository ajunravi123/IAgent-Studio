from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Optional, List, Union, Any
import json
import os
import uuid
from datetime import datetime, timedelta
import shutil
from pathlib import Path
import os
from task_executor import TaskExecutor


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

def load_agents():
    if os.path.exists(AGENTS_FILE):
        with open(AGENTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_agents(agents):
    with open(AGENTS_FILE, 'w') as f:
        json.dump(agents, f)

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

            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1]
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
        API_KEYS = {
            "gemini": os.getenv("GEMINI_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY"),
        }

        # Load tool configurations for this agent
        tools_config = []
        for tool_id in agent.get("tools", []):
            # Load schema
            schema_path = f"tool_schemas/{tool_id}.json"
            auth_path = f"tool_auth/{tool_id}.json"
            
            if os.path.exists(schema_path):
                tool_config = {"id": tool_id}
                
                # Load schema
                with open(schema_path, 'r') as f:
                    tool_config["schema"] = json.load(f)
                
                # Load auth if exists
                if os.path.exists(auth_path):
                    with open(auth_path, 'r') as f:
                        tool_config["auth"] = json.load(f)
                
                tools_config.append(tool_config)

        # Pass the agent configuration and tool schemas to TaskExecutor
        executor = TaskExecutor(
            agent_config={
                "role": agent["role"],
                "goal": agent["goal"],
                "backstory": agent["backstory"],
                "llm_provider": agent["llmProvider"].lower(),
                "llm_model": agent["llmModel"],
                "api_key": API_KEYS.get(agent["llmProvider"].lower(), agent["apiKey"])
            },
            tools_config=tools_config
        )

        if userInput:
            agent["instructions"] = check_in_sentence(agent["instructions"], "{{input}}")

        # Modify instructions to include file info if a file was uploaded
        if file_info:
            file_message = f"\nA file was uploaded: {file_info['original_name']} (saved as {file_info['saved_name']}, type: {file_info['type']}, size: {file_size} bytes, path: {file_info['path']})"
            userInput += file_message

        # Execute a task
        result = executor.execute_task(
            description=agent["instructions"],
            expected_output=agent["expectedOutput"],
            task_name=agent["name"],
            input=userInput
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

# Catch-all route to serve the main index.html for any other path
# This MUST be defined AFTER all API routes and static file mounts
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # You could add checks here if certain paths should 404,
    # but for a typical SPA, serving index.html is correct.
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