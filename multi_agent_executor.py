from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from langchain.tools import Tool
import os
import requests
from dotenv import load_dotenv
from functools import partial
import json
import re
import base64
import csv
from datetime import datetime
import pytz
from typing import Optional, Dict, Any, List
import PyPDF2

# Assuming file processing utilities might be needed (copy from task_executor or refactor to common utils)
from task_executor import (
    ALLOWED_FILE_TYPES, 
    EXTENSION_TO_MIME, 
    ENABLE_GPU, 
    BLIP_PROCESSOR, 
    BLIP_MODEL, 
    OCR_READER,
    # Import necessary helper functions if they aren't methods of TaskExecutor
    # e.g., encode_image_to_base64, read_csv_as_text etc. 
    # If they are methods, we'll need to copy them or refactor.
    # For now, let's copy the file processing methods.
)

if ENABLE_GPU:
    from PIL import Image # Import only if GPU enabled

load_dotenv()

class MultiAgentExecutor:
    """
    Handles the orchestration of multiple agents using CrewAI's hierarchical process.
    Mirrors the structure and tool handling of TaskExecutor where applicable.
    """
    def __init__(
        self,
        multi_agent_config: Dict[str, Any],
        worker_agent_configs: List[Dict[str, Any]],
        blip_processor=BLIP_PROCESSOR, # Allow passing pre-initialized models
        blip_model=BLIP_MODEL,
        ocr_reader=OCR_READER
    ):
        self.multi_agent_config = multi_agent_config
        self.worker_agent_configs = worker_agent_configs
        
        if ENABLE_GPU:
            self.blip_processor = blip_processor
            self.blip_model = blip_model
            self.ocr_reader = ocr_reader

        API_KEYS = {
            "gemini": os.getenv("GEMINI_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY"),
        }

        # Initialize LLM client (consistent across agents)
        self.llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEYS["gemini"])

        # Initialize utility agents (same as TaskExecutor, needed for tool handling)
        self.schema_agent = CrewAgent(
            role="Schema Analyzer",
            goal="Analyze OpenAPI schemas and extract key information about required fields, data types, and constraints",
            backstory="I'm an expert at analyzing OpenAPI schemas and extracting key information about API requirements.",
            verbose=False, allow_delegation=False, llm=self.llm_client
        )
        self.payload_agent = CrewAgent(
            role="Payload Generator",
            goal="Generate accurate payloads for API tools based on user input, task description, and schema analysis",
            backstory="I'm an expert at creating valid API payloads based on OpenAPI schemas and user requirements.",
            verbose=False, allow_delegation=False, llm=self.llm_client
        )

        # Initialize Manager Agent from the multi-agent config
        self.manager_agent = CrewAgent(
            role=self.multi_agent_config.get("role", "Coordinator"),
            goal=self.multi_agent_config.get("goal", "Efficiently manage and delegate tasks."),
            backstory=self.multi_agent_config.get("backstory", "Orchestrator for connected agents."),
            llm=self.llm_client,
            verbose=True,
            allow_delegation=True # Manager MUST delegate
        )
        print(f"Initialized Manager Agent: {self.manager_agent.role}")

        # Initialize Worker Agents
        self.worker_agents = []
        for config in self.worker_agent_configs:
            tools = self._load_agent_tools(config) # Use helper to load tools
            agent = CrewAgent(
                role=config["role"],
                goal=config["goal"],
                backstory=config["backstory"],
                llm=self.llm_client,
                tools=tools,
                verbose=True,
                allow_delegation=False # Workers typically don't delegate further
            )
            self.worker_agents.append(agent)
            print(f"Initialized Worker Agent: {agent.role}")
            
        if not self.worker_agents:
             print("Warning: No worker agents were successfully initialized.")


    def _load_agent_tools(self, agent_config: Dict[str, Any]) -> List[Tool]:
        """Loads tools for a specific agent based on its configuration, mirroring TaskExecutor logic."""
        tools = []
        tools_config = agent_config.get("tools") # Get tool configs *for this agent*
        
        # Now that main.py passes the full config, this logic should work
        if tools_config and isinstance(tools_config, list):
            print(f"Loading tools for agent {agent_config.get('role', agent_config.get('id'))}: {len(tools_config)} configs found")
            for tool_config in tools_config:
                if not isinstance(tool_config, dict) or "schema" not in tool_config:
                    print(f"Warning: Skipping invalid tool config entry: {tool_config}")
                    continue
                
                tool_schema = tool_config["schema"]
                # Basic check for schema validity
                if not isinstance(tool_schema, dict) or "info" not in tool_schema or "paths" not in tool_schema:
                     print(f"Warning: Skipping tool due to invalid schema structure: {tool_config.get('id')}")
                     continue
                     
                tool_headers = tool_config.get("auth", {}).get("headers", {})
                tool_params = tool_config.get("auth", {}).get("params", {})
        
                # Use the exact same create_api_caller logic from TaskExecutor
                # Define it nested here to ensure lexical scope captures 'self' correctly
                def create_api_caller(schema, headers, params):
                    def api_caller(input_text, **kwargs):
                        try:
                            # Use schema passed to create_api_caller, not tool_schema from outer scope
                            current_schema = schema 
                            current_headers = headers
                            current_params = params
                            
                            paths = current_schema.get("paths")
                            if not paths: return {"error": "No API paths found in schema"}
                            
                            # Simple approach: use the first path and method found
                            # More robust: Agent would need to select path/method based on input/goal
                            path = next(iter(paths)) # First path key
                            path_info = paths[path]
                            method = next(iter(path_info)).lower() # First method key (get, post, etc.)

                            if path.startswith('http'): endpoint_url = path
                            else:
                                base_url = current_schema.get('servers', [{}])[0].get('url', 'http://localhost:8003')
                                endpoint_url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
                            
                            print(f"Tool {current_schema.get('info',{}).get('title')}: Calling {method.upper()} {endpoint_url}")

                            # Schema analysis and payload gen needed mainly for POST/PUT etc.
                            payload = None
                            if method in ['post', 'put', 'patch']:
                                schema_analysis = self.analyze_schema(current_schema)
                                payload = self.generate_payload(input_text, current_schema, schema_analysis)
                                if payload is None: # Check if generate_payload returned None explicitly
                                    return {"error": "Failed to generate valid payload"}
                            
                            # Execute request
                            response = requests.request(
                                method=method,
                                url=endpoint_url,
                                headers=current_headers,
                                params=current_params, # Use current_params here
                                json=payload # Will be None for GET etc.
                            )
                            
                            print(f"Tool Response Status: {response.status_code}")
                            if response.status_code >= 200 and response.status_code < 300:
                                try: return response.json()
                                except json.JSONDecodeError: return {"success": True, "content": response.text} # Handle non-json success
                            else:
                                try: error_content = response.json().get('detail', response.text)
                                except json.JSONDecodeError: error_content = response.text
                                print(f"Tool Error Content: {error_content}")
                                return {"error": f"API call failed ({response.status_code}): {error_content}"}
                        except Exception as e:
                            print(f"Error in api_caller: {e}")
                            import traceback
                            traceback.print_exc()
                            return {"error": str(e)}
                    return api_caller
                
                tool_name = tool_schema.get("info", {}).get("title", f"tool_{tool_config.get('id')}").lower().replace(" ", "_")
                api_caller_instance = create_api_caller(tool_schema, tool_headers, tool_params)
                
                # Partial function needs the arguments required by api_caller
                # It seems api_caller doesn't directly use url, headers, params passed via partial?
                # Let's simplify - the closure should handle schema, headers, params
                # api_caller_with_config = partial(
                #     api_caller_instance
                #     # No need to pass url/headers/params here if closure works
                # )
                
                tool_description = (
                    f"Calls API: {tool_schema.get('info', {}).get('title', 'Unknown API')}. "
                    f"{tool_schema.get('info', {}).get('description', '')}"
                    f" Input should be relevant text for the API call."
                )

                tools.append(
                    Tool(
                        name=tool_name,
                        func=api_caller_instance, # Pass the function created by the factory
                        description=tool_description,
                        result_as_answer=True
                    )
                )
                print(f"  - Loaded tool: {tool_name}")
        else:
             print(f"Agent {agent_config.get('role', agent_config.get('id'))} has no tools or invalid tool config.")

        return tools


    # --- Copy Helper methods from TaskExecutor ---
    # (analyze_schema, generate_payload, get_task_descriptions, file processing)

    def analyze_schema(self, schema: dict) -> str:
        # Copied from TaskExecutor
        schema_str = json.dumps(schema, indent=2)
        analysis_task = Task(
            description=f"""
                Analyze this OpenAPI schema and extract key information:
                {schema_str}
                Focus on: Required fields/types, constraints, response structure, special requirements.
                Return a clear, concise summary.
            """,
            expected_output="A clear summary of the schema requirements and constraints",
            agent=self.schema_agent
        )
        crew = Crew(agents=[self.schema_agent], tasks=[analysis_task], process=Process.sequential)
        result = crew.kickoff()
        return str(result)

    def generate_payload(self, user_input: str, schema: dict, schema_analysis: str) -> Optional[dict]:
        # Copied from TaskExecutor
        paths = schema.get("paths", {})
        if not paths: return None
        first_path = next(iter(paths))
        path_info = paths[first_path]
        post_method = path_info.get("post", {})
        request_body = post_method.get("requestBody", {})
        content = request_body.get("content", {})
        json_content = content.get("application/json", {})
        request_schema = json_content.get("schema", {})
        
        payload_task = Task(
            description=f"""
                Given:
                User Input: '{user_input}'
                Schema Analysis: {schema_analysis}
                Request Schema: {json.dumps(request_schema, indent=2)}
                Generate a valid JSON payload satisfying schema requirements, extracting info from input.
                Handle time inputs (natural language to 24h). Use defaults for invalid/missing data.
                Return JSON string payload or '{{}}' if invalid.
            """,
            expected_output="A JSON string representing the payload that satisfies all schema requirements",
            agent=self.payload_agent
        )
        crew = Crew(agents=[self.payload_agent], tasks=[payload_task], process=Process.sequential)
        result = crew.kickoff()
        try:
            payload_str = str(result.raw if hasattr(result, 'raw') else result.output if hasattr(result, 'output') else result)
            payload_str = payload_str.strip('`').strip('json').strip()
            return json.loads(payload_str)
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing payload: {e}")
            return None
            
    def get_task_descriptions(self, description, expected_output, task_name=None, **kwargs):
         # Copied from TaskExecutor - used for formatting {{input}} if needed, though less critical for manager task
        if task_name: 
            try:
                if kwargs:
                    for key, value in kwargs.items():
                        placeholder = "{{" + key + "}}"
                        # Use original logic for replacing or appending input
                        if placeholder in description:
                             description = description.replace(placeholder, str(value))
                        # Append input if placeholder missing (adjust logic if needed)
                        elif key == "input" and placeholder not in description: 
                            description += f"\n\nUser Input: {value}"
                        elif key != "input": # Append other kwargs 
                             description += f"\n\n{key.capitalize()}: {value}"
                             
                        if placeholder in expected_output:
                             expected_output = expected_output.replace(placeholder, str(value))
                             
                return {"description": description, "expected_output": expected_output}
            except Exception as e:
                print(f"Error processing task '{task_name}': {e}.")
                return {"description": description, "expected_output": expected_output}
        return {"description": description, "expected_output": expected_output}

    # --- File Processing Methods (Copied from TaskExecutor) ---
    def encode_image_to_base64(self, image_path: str) -> str:
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode("utf-8")
        except Exception as e: return f"Error encoding image: {e}"

    def read_csv_as_text(self, csv_path: str) -> str:
        try:
            with open(csv_path, "r", encoding="utf-8") as f: return f.read()
        except Exception as e: return f"Error reading CSV: {e}"

    def read_json_as_text(self, json_path: str) -> str:
        try:
            with open(json_path, "r", encoding="utf-8") as f: return json.dumps(json.load(f), indent=2)
        except Exception as e: return f"Error reading JSON: {e}"

    def read_txt_as_text(self, txt_path: str) -> str:
        try:
            with open(txt_path, "r", encoding="utf-8") as f: return f.read()
        except Exception as e: return f"Error reading TXT: {e}"

    def read_pdf_as_text(self, pdf_path: str) -> str:
        try:
            text = ""
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages: text += page.extract_text() or ""
            return text.strip() or "No readable text found"
        except Exception as e: return f"Error reading PDF: {e}"

    def process_file_content(self, file_path: str, file_type: str) -> str:
        normalized_type = file_type.lower()
        content = ""
        if normalized_type.startswith("image/"):
            try:
                file_path_str = str(file_path)
                if not os.path.exists(file_path_str): raise FileNotFoundError(f"Image not found: {file_path_str}")
                if ENABLE_GPU:
                    # ... (GPU image processing logic from TaskExecutor) ...
                    image = Image.open(file_path_str)
                    inputs = self.blip_processor(image, return_tensors="pt")
                    out = self.blip_model.generate(**inputs, max_length=150)
                    desc = self.blip_processor.decode(out[0], skip_special_tokens=True)
                    ocr = self.ocr_reader.readtext(file_path_str)
                    text = " ".join([r[1] for r in ocr]) if ocr else "No text detected"
                    content = f"\n\n[Image Content]\nDescription: {desc}\nText: {text}"
                else: content = "\n\n[Image Uploaded - Processing Skipped (GPU Disabled)]"
            except Exception as e: content = f"\n\n[Error processing image: {e}]"
        elif normalized_type == "text/csv": content = f"\n\n[CSV Content]\n{self.read_csv_as_text(file_path)}"
        elif normalized_type == "application/json": content = f"\n\n[JSON Content]\n{self.read_json_as_text(file_path)}"
        elif normalized_type == "text/plain": content = f"\n\n[Text Content]\n{self.read_txt_as_text(file_path)}"
        elif normalized_type == "application/pdf": content = f"\n\n[PDF Content]\n{self.read_pdf_as_text(file_path)}"
        
        truncated_content = content[:100] + "..." if len(content) > 100 else content
        print(f"Processed {file_type} content: {truncated_content} (full length: {len(content)})")
        return content
    # --- End Copied Helper Methods ---


    def execute_task(self, user_input: str, file_path: Optional[str] = None) -> str:
        """
        Executes the multi-agent orchestration by creating specific tasks for each worker agent.
        """
        print("--- Executing Multi-Agent Task (Worker-Specific Tasks) --- ")
        try:
            if not self.worker_agents:
                 return "Error: No worker agents available for orchestration."

            # 1. Prepare file content (if any)
            file_content_str = ""
            if file_path:
                ext = os.path.splitext(file_path)[1].lower().replace(".", "")
                file_type = EXTENSION_TO_MIME.get(ext)
                if file_type and file_type in ALLOWED_FILE_TYPES:
                    file_content_str = self.process_file_content(file_path, file_type)
            
            # 2. Define Specific Tasks for Each Worker Agent
            worker_tasks = []
            for i, worker_agent in enumerate(self.worker_agents):
                # Get the original config for this worker
                agent_config = self.worker_agent_configs[i]
                agent_instructions = agent_config.get("instructions", "Perform your assigned role based on the user request.")
                # Use the agent's specific expected output from its config
                agent_expected_output = agent_config.get("expectedOutput", "Your specific contribution towards the overall goal.")
                
                # Format the agent's instructions with the user input using the helper
                # Pass user_input as a kwarg
                task_details = self.get_task_descriptions(
                    description=agent_instructions, 
                    expected_output=agent_expected_output, # Use agent-specific expected output
                    task_name=f"worker_task_{i}_{worker_agent.role}", # Unique task name
                    input=user_input
                )
                
                # Append file content to the formatted description
                task_description_for_agent = task_details["description"]
                if file_content_str:
                    task_description_for_agent += file_content_str
                
                # Create the task for this specific agent
                task = Task(
                    description=task_description_for_agent,
                    expected_output=task_details["expected_output"],
                    agent=worker_agent
                )
                worker_tasks.append(task)
                print(f"Created Task for Worker {worker_agent.role}: {task_description_for_agent[:100]}...")

            if not worker_tasks:
                return "Error: Could not create any tasks for the worker agents."

            # 3. Create and Run the Crew with Worker Tasks
            crew = Crew(
                agents=self.worker_agents, # Workers are managed by the manager
                tasks=worker_tasks,        # Pass the list of specific worker tasks
                process=Process.hierarchical,
                manager_agent=self.manager_agent,
                verbose=True
            )

            print("Kicking off Hierarchical Crew with Worker Tasks...")
            result = crew.kickoff()
            print("Crew finished.")

            # 4. Extract and return the final result (robust extraction)
            # In hierarchical mode, the final result is typically the manager's output
            final_result = result
            if hasattr(result, 'tasks_output') and result.tasks_output:
                 raw_output = result.tasks_output[-1].raw.strip() if result.tasks_output[-1].raw else str(result.tasks_output[-1])
                 final_result = raw_output
            elif hasattr(result, 'raw'):
                 final_result = result.raw.strip()
            elif not isinstance(result, str):
                 final_result = str(result)
                 
            print(f"Multi-Agent Task Final Result: {final_result}")
            return final_result.strip()

        except Exception as e:
            print(f"Error during multi-agent task execution: {e}")
            import traceback
            traceback.print_exc()
            return f"An error occurred during multi-agent processing: {e}" 