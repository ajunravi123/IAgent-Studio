from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Optional, List
import json
import os
import uuid
from datetime import datetime

app = FastAPI()

# Mount the static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

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
    backstory: str = ""
    instructions: str
    verbose: bool = False
    features: AgentFeatures
    tools: List[str] = []  # List of tool IDs

class Tool(BaseModel):
    id: str
    name: str
    description: str
    icon: str
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
    icon: str
    tags: List[str]
    schema: OpenAPISchema
    is_custom: bool = True

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
                icon="/static/images/github-icon.svg",
                tags=["Code", "Version Control", "Automation"]
            ),
            Tool(
                id="slack",
                name="Slack",
                description="Integrate with Slack to receive notifications and interact with your workspace through chat commands.",
                icon="/static/images/slack-icon.svg",
                tags=["Communication", "Notifications", "Chat"]
            ),
            Tool(
                id="discord",
                name="Discord",
                description="Connect your Discord server to manage community interactions and automate moderation tasks.",
                icon="/static/images/discord-icon.svg",
                tags=["Community", "Chat", "Gaming"]
            ),
            Tool(
                id="clickup",
                name="ClickUp",
                description="Integrate with ClickUp to manage tasks, track progress, and automate project workflows.",
                icon="/static/images/clickup-icon.svg",
                tags=["Project Management", "Tasks", "Productivity"]
            ),
            Tool(
                id="spotify",
                name="Spotify",
                description="Control Spotify playback and manage playlists through automated commands.",
                icon="/static/images/spotify-icon.svg",
                tags=["Music", "Entertainment", "Media"]
            ),
            Tool(
                id="twitter",
                name="Twitter",
                description="Automate tweet scheduling, monitoring, and engagement with your Twitter audience.",
                icon="/static/images/twitter-icon.svg",
                tags=["Social Media", "Marketing", "Automation"]
            ),
            Tool(
                id="notion",
                name="Notion",
                description="Connect with Notion to manage documents, databases, and knowledge bases automatically.",
                icon="/static/images/notion-icon.svg",
                tags=["Knowledge Base", "Documentation", "Organization"]
            ),
            Tool(
                id="outlook",
                name="Outlook",
                description="Integrate with Outlook to manage emails, calendar events, and contacts programmatically.",
                icon="/static/images/outlook-icon.svg",
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
        icon=tool.icon,
        tags=tool.tags,
        is_custom=True,
        is_added=False
    )
    
    # Save OpenAPI schema separately
    schema_dir = "tool_schemas"
    os.makedirs(schema_dir, exist_ok=True)
    with open(f"{schema_dir}/{new_tool.id}.json", 'w') as f:
        json.dump(tool.schema.dict(), f, indent=2)
    
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
                icon=updated_tool.icon,
                tags=updated_tool.tags,
                is_custom=True
            )
            
            # Update schema
            schema_dir = "tool_schemas"
            with open(f"{schema_dir}/{tool_id}.json", 'w') as f:
                json.dump(updated_tool.schema.dict(), f, indent=2)
            
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

# Catch-all route to serve the main index.html for any other path
# This MUST be defined AFTER all API routes and static file mounts
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # You could add checks here if certain paths should 404,
    # but for a typical SPA, serving index.html is correct.
    return FileResponse("static/index.html")

# Note: The root path "/" is now handled by the catch-all route,
# so the specific @app.get("/") route can be removed if desired,
# or kept if you want specific logic just for the root.
# If kept, ensure it also returns FileResponse("static/index.html").
# For simplicity, relying on the catch-all is fine.
# Remove this block if you rely on the catch-all:
# @app.get("/")
# async def read_root():
#     return FileResponse("static/index.html")

# Model for Agent Inference Request
class AgentInferenceRequest(BaseModel):
    agentId: str
    userInput: str

# Model for Agent Inference Response
class AgentInferenceResponse(BaseModel):
    response: str

# API endpoint for agent inference (chat)
@app.post("/api/agent/infer", response_model=AgentInferenceResponse)
async def agent_inference(inference_request: AgentInferenceRequest):
    agent_id = inference_request.agentId
    user_input = inference_request.userInput

    # Load agent details to verify ID and potentially use in logic
    agents = load_agents()
    agent_details = None
    for agent in agents:
        if agent["id"] == agent_id:
            agent_details = agent
            break

    if not agent_details:
        raise HTTPException(status_code=404, detail=f"Agent with ID {agent_id} not found")

    # --- Placeholder for Actual Agent Logic ---
    # TODO: Replace this section with your actual agent execution logic.
    # This might involve:
    # - Initializing your agent framework (e.g., Langchain, CrewAI) with agent_details
    # - Running the inference/chat process with user_input
    # - Handling tools, memory, LLM calls, etc.
    print(f"Received inference request for agent {agent_id}: {user_input}") # Server-side log
    agent_response_content = f"Agent '{agent_details.get('name', agent_id)}' received: {user_input}"
    # --- End Placeholder ---

    return AgentInferenceResponse(response=agent_response_content)

# ... (rest of the file, if any) ... 