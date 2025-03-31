from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from langchain.tools import Tool
import os
import requests
from dotenv import load_dotenv
from functools import partial
import json
import re
from datetime import datetime
import pytz
from typing import Optional

load_dotenv()

class TaskExecutor:
    def __init__(self, agent_config, tools_config=None):
        """
        Initialize the TaskExecutor with agent configuration and tools.
        Args:
            agent_config (dict): Configuration for creating a CrewAgent
                Expected keys: role, goal, backstory, llm_provider, llm_model, api_key
            tools_config (list): List of tool configurations with schemas and auth info
        """
        API_KEYS = {
            "gemini": os.getenv("GEMINI_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY"),
        }

        # Initialize LLM
        self.llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEYS["gemini"])

        # Initialize specialized agents
        self.schema_agent = CrewAgent(
            role="Schema Analyzer",
            goal="Analyze OpenAPI schemas and extract key information about required fields, data types, and constraints",
            backstory="I'm an expert at analyzing OpenAPI schemas and extracting key information about API requirements.",
            verbose=False,
            allow_delegation=False,
            llm=self.llm_client
        )

        self.payload_agent = CrewAgent(
            role="Payload Generator",
            goal="Generate accurate payloads for API tools based on user input, task description, and schema analysis",
            backstory="I'm an expert at creating valid API payloads based on OpenAPI schemas and user requirements.",
            verbose=False,
            allow_delegation=False,
            llm=self.llm_client
        )

        # Initialize tools properly
        self.tools = []
        if tools_config:
            for tool_config in tools_config:
                tool_schema = tool_config["schema"]
                tool_headers = tool_config.get("auth", {}).get("headers", {})
                tool_params = tool_config.get("auth", {}).get("params", {})

                def create_api_caller(tool_schema, tool_headers, tool_params):
                    """Create an API caller function with the correct schema and auth info."""
                    def api_caller(input_text, **kwargs):
                        """Dynamically calls an API based on schema configuration."""
                        try:
                            # Get the paths from the schema passed in kwargs
                            url = kwargs.get('url')
                            headers = kwargs.get('headers', {})
                            params = kwargs.get('params', {})

                            if not url:
                                return {"error": "No API paths found in schema"}

                            # Get the first path and method from the schema
                            path = list(url.keys())[0]
                            method = list(url[path].keys())[0]
                            
                            # Extract base URL and endpoint path
                            if path.startswith('http'):
                                # If it's a full URL, use it as is
                                endpoint_url = path
                            else:
                                # If it's just a path, construct the full URL
                                base_url = tool_schema.get('servers', [{}])[0].get('url', 'http://localhost:8003')
                                endpoint_url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"

                            # Analyze schema first
                            schema_analysis = self.analyze_schema(tool_schema)
                            
                            # Generate payload based on schema analysis and user input
                            payload = self.generate_payload(input_text, tool_schema, schema_analysis)
                            
                            if not payload:
                                return {"error": "Failed to generate valid payload"}

                            # Make the API call
                            response = requests.post(
                                endpoint_url,
                                headers=headers,
                                params=params,
                                json=payload
                            )

                            # Handle response based on status code
                            if response.status_code == 200:
                                return response.json()
                            else:
                                try:
                                    error_content = response.json().get('detail', str(response.status_code))
                                except json.JSONDecodeError:
                                    error_content = str(response.status_code)
                                return {"error": error_content}

                        except Exception as e:
                            return {"error": str(e)}
                    
                    return api_caller

                # Create a unique name for the tool based on the schema title
                tool_name = tool_schema["info"]["title"].lower().replace(" ", "_")
                
                # Create the API caller with the correct schema and auth info
                api_caller = create_api_caller(tool_schema, tool_headers, tool_params)
                
                # Create a partial function with the paths
                api_caller_with_config = partial(
                    api_caller,
                    url=tool_schema["paths"],
                    headers=tool_headers,
                    params=tool_params
                )

                self.tools.append(
                    Tool(
                        name=tool_name,
                        func=api_caller_with_config,
                        description=f"""Calls API: {tool_schema['info']['title']}. {tool_schema['info']['description']}
                        
                        Input: {{input}}
                        
                        Important: Use the complete input text as provided. Do not extract or modify the input text before passing it to the API.
                        The input text should be used in its entirety to generate the appropriate payload.""",
                        result_as_answer=True
                    )
                )

        # Create the main agent
        self.agent = CrewAgent(
            role=agent_config["role"],
            goal=agent_config["goal"],
            backstory=agent_config["backstory"],
            llm=self.llm_client,
            tools=self.tools if self.tools else [],
            verbose=True
        )

    def analyze_schema(self, schema: dict) -> str:
        """Analyze the OpenAPI schema to extract key information."""
        schema_str = json.dumps(schema, indent=2)
        
        analysis_task = Task(
            description=f"""
                Analyze this OpenAPI schema and extract key information:
                {schema_str}
                
                Focus on:
                1. Required fields and their types
                2. Any constraints (min/max values, patterns, etc.)
                3. Response structure
                4. Any special requirements or validations
                
                Return a clear, concise summary of the schema requirements.
            """,
            expected_output="A clear summary of the schema requirements and constraints",
            agent=self.schema_agent
        )
        
        crew = Crew(agents=[self.schema_agent], tasks=[analysis_task], process=Process.sequential)
        result = crew.kickoff()
        
        return str(result)

    def generate_payload(self, user_input: str, schema: dict, schema_analysis: str) -> Optional[dict]:
        """Generate a valid payload based on user input and schema analysis."""
        # Extract the request body schema from the first path
        paths = schema.get("paths", {})
        if not paths:
            return None
            
        first_path = next(iter(paths))
        path_info = paths[first_path]
        post_method = path_info.get("post", {})
        request_body = post_method.get("requestBody", {})
        content = request_body.get("content", {})
        json_content = content.get("application/json", {})
        request_schema = json_content.get("schema", {})
        
        payload_task = Task(
            description=f"""
                Given the following information:
                
                User Input: '{user_input}'
                
                Schema Analysis:
                {schema_analysis}
                
                Request Schema:
                {json.dumps(request_schema, indent=2)}
                
                Generate a valid JSON payload that:
                1. Satisfies all schema requirements and constraints
                2. Extracts relevant information from the user input
                3. Handles any missing or invalid data appropriately
                4. For time-related inputs:
                   - Extract time information from natural language (e.g., "evening 6 o'clock" → 18)
                   - Convert to 24-hour format (0-23)
                   - Handle various time formats (morning, afternoon, evening, night)
                   - Use current time as fallback for invalid inputs
                5. For invalid inputs, use sensible defaults
                
                Return only the JSON payload as a string.
                If no valid payload can be determined, return an empty JSON object '{{}}'.
            """,
            expected_output="A JSON string representing the payload that satisfies all schema requirements",
            agent=self.payload_agent
        )
        
        crew = Crew(agents=[self.payload_agent], tasks=[payload_task], process=Process.sequential)
        result = crew.kickoff()
        
        try:
            # Handle different possible result formats
            if hasattr(result, 'raw'):
                payload_str = str(result.raw)
            elif hasattr(result, 'output'):
                payload_str = str(result.output)
            else:
                payload_str = str(result)
            
            # Clean up the payload string
            payload_str = payload_str.strip('`').strip('json').strip()
            
            # Parse the payload
            return json.loads(payload_str)
            
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing payload: {e}")
            return None

    def get_task_descriptions(self, description, expected_output, task_name=None, **kwargs):
        """Process task description and expected output, replacing placeholders with kwargs."""
        if task_name:
            try:
                if kwargs:
                    for key, value in kwargs.items():
                        placeholder = "{{" + key + "}}"
                        # For input text, preserve the full text
                        if key == "input":
                            description = description.replace(placeholder, f"'{value}'")
                        else:
                            description = description.replace(placeholder, str(value))
                        expected_output = expected_output.replace(placeholder, str(value))
                return {"description": description, "expected_output": expected_output}
            except Exception as e:
                print(f"Error processing task '{task_name}': {e}. Using provided description.")
                return {"description": description, "expected_output": expected_output}
        return {"description": description, "expected_output": expected_output}

    def execute_task(self, description, expected_output, task_name=None, **kwargs):
        """Execute a task using the CrewAI framework."""
        task_info = self.get_task_descriptions(description, expected_output, task_name, **kwargs)
        processed_description = task_info["description"]
        processed_expected_output = task_info["expected_output"]

        task = Task(
            description=processed_description,
            expected_output=processed_expected_output,
            agent=self.agent
        )

        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=Process.sequential
        )
        result = crew.kickoff()

        raw_output = result.tasks_output[0].raw.strip()
        if task_name:
            print(f"Raw LLM output for task '{task_name}': {raw_output}")
        else:
            print(f"Raw LLM output: {raw_output}")
        return raw_output