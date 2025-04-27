import logging
import os
from datetime import datetime
import pytz
from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from langchain.tools import Tool
import requests
from dotenv import load_dotenv
from functools import partial
import json
import base64
import csv
from typing import Optional, Dict, Any, List
import PyPDF2
from PIL import Image
import random

load_dotenv()

ALLOWED_FILE_TYPES = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "text/csv": "csv",
    "application/json": "json",
    "text/plain": "text",
    "application/pdf": "pdf"
}

EXTENSION_TO_MIME = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "csv": "text/csv",
    "json": "application/json",
    "txt": "text/plain",
    "pdf": "application/pdf"
}

# Utility to sanitize strings for logging, preserving emojis
def sanitize_for_logging(text: Any) -> str:
    try:
        # Convert to string and ensure UTF-8 encoding, preserving valid Unicode (e.g., emojis)
        text_str = str(text)
        return text_str.encode("utf-8", errors="replace").decode("utf-8")
    except Exception:
        # Fallback for problematic inputs
        return str(text).encode("utf-8", errors="replace").decode("utf-8")

class TaskExecutor:
    def __init__(
        self,
        agent_config: Dict[str, str],
        tools_config: Optional[list] = None,
        log_file: Optional[str] = None
    ):
        # Configure logger for this execution
        self.logger = logging.getLogger(f"task_executor_{id(self)}")
        self.logger.setLevel(logging.DEBUG)
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        
        if log_file:
            try:
                file_handler = logging.FileHandler(log_file, encoding="utf-8")
                file_handler.setFormatter(formatter)
                self.logger.addHandler(file_handler)
            except Exception as e:
                self.logger.error(f"Failed to create log file handler for {log_file}: {sanitize_for_logging(e)}")
        
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)

        API_KEY = get_api_key()
        self.llm_client = LLM(model="gemini/gemini-2.5-flash-preview-04-17", api_key=API_KEY)
        self.internal_llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=os.getenv("INTERNAL_GEMINI_API_KEY"))

        # Unmodified agent configurations
        self.schema_agent = CrewAgent(
            role="Schema Analyzer",
            goal="Analyze OpenAPI schemas and extract key information",
            backstory="Expert at analyzing OpenAPI schemas.",
            verbose=False,
            allow_delegation=False,
            llm=self.internal_llm_client
        )

        self.payload_agent = CrewAgent(
            role="Payload Generator",
            goal="Generate accurate payloads for API tools",
            backstory="Expert at creating valid API payloads.",
            verbose=False,
            allow_delegation=False,
            llm=self.internal_llm_client
        )

        self.tools = []
        if tools_config:
            for tool_config in tools_config:
                tool_schema = tool_config["schema"]
                tool_headers = tool_config.get("auth", {}).get("headers", {})
                tool_params = tool_config.get("auth", {}).get("params", {})
                tool_data_connector = tool_config.get("data_connector", None)

                def create_api_caller(tool_schema, tool_headers, tool_params, tool_data_connector):
                    def api_caller(input_text, **kwargs):
                        try:
                            result = self.generate_payload(input_text, tool_schema, tool_data_connector)
                            if not result or "error" in result:
                                return {"error": result.get("error", "Failed to generate payload or endpoint URL")}

                            payload = result.get("payload")
                            endpoint_url = result.get("endpoint_url")
                            if not endpoint_url:
                                return {"error": "Missing endpoint URL"}

                            # Determine HTTP method from schema
                            paths = tool_schema.get("paths", {})
                            if not paths:
                                return {"error": "No paths found in schema"}

                            path_key = next(iter(paths))
                            method = None
                            for m in paths[path_key]:
                                if m.lower() in ["get", "post"]:
                                    method = m.lower()
                                    break
                            if not method:
                                return {"error": "No supported HTTP method (GET/POST) found in schema"}

                            # Prepare request
                            headers = tool_headers.copy() if tool_headers else {}
                            params = tool_params.copy() if tool_params else {}

                            if method == "get":
                                # For GET, payload contains query parameters (if any)
                                if payload:
                                    params.update(payload)
                                response = requests.get(
                                    endpoint_url,
                                    headers=headers,
                                    params=params if params else None
                                )
                            else:  # method == "post"
                                response = requests.post(
                                    endpoint_url,
                                    headers=headers,
                                    params=params if params else None,
                                    json=payload if payload else None
                                )

                            if response.status_code == 200:
                                try:
                                    return response.json()
                                except ValueError:
                                    return {"result": response.text}
                            else:
                                self.logger.debug(f"Tool returned status code: {response.status_code}")
                                try:
                                    return {"error": response.json().get('detail', str(response.status_code))}
                                except ValueError:
                                    return {"error": response.text or str(response.status_code)}
                        except Exception as e:
                            self.logger.debug(f"Tool returned error: {sanitize_for_logging(e)}")
                            return {"error": sanitize_for_logging(e)}
                    return api_caller

                tool_name = tool_schema["info"]["title"].lower().replace(" ", "_")
                api_caller = create_api_caller(tool_schema, tool_headers, tool_params, tool_data_connector)
                api_caller_with_config = partial(
                    api_caller,
                    headers=tool_headers,
                    params=tool_params
                )
                self.tools.append(
                    Tool(
                        name=tool_name,
                        func=api_caller_with_config,
                        description=f"Calls API: {tool_schema['info']['title']}.",
                        result_as_answer=True
                    )
                )

        self.agent = CrewAgent(
            role=agent_config["role"],
            goal=agent_config["goal"],
            backstory=agent_config["backstory"],
            llm=self.llm_client,
            tools=self.tools,
            verbose=True
        )

    def analyze_schema(self, schema: dict) -> str:
        self.logger.debug("Analyzing schema")
        schema_str = json.dumps(schema, indent=2, ensure_ascii=False)
        analysis_task = Task(
            description=f"Analyze OpenAPI schema:\n{schema_str}\nFocus on required fields, types, constraints, parameters, and response structure.",
            expected_output="Summary of schema requirements including HTTP method, parameters, and payload requirements",
            agent=self.schema_agent
        )
        crew = Crew(agents=[self.schema_agent], tasks=[analysis_task], process=Process.sequential)
        result = crew.kickoff()
        sanitized_result = sanitize_for_logging(result)
        return str(result)  # Return unsanitized result to preserve accuracy

    def generate_payload(self, user_input: str, schema: dict, tool_data_connector: Optional[dict] = None) -> Dict[str, Any]:
        self.logger.debug(f"Generating payload and endpoint URL for input: {sanitize_for_logging(user_input)}")
        paths = schema.get("paths", {})
        if not paths:
            self.logger.error("No paths in schema")
            return {"error": "No paths in schema"}

        schema_analysis = self.analyze_schema(schema)
        path_key = next(iter(paths))
        method = next((m for m in paths[path_key] if m.lower() in ["get", "post"]), "post")
        
        # Determine request schema based on method
        request_schema = {}
        if method == "get":
            parameters = paths[path_key].get(method, {}).get("parameters", [])
            if parameters:
                request_schema = {"parameters": parameters}
        else:  # method == "post"
            request_body = paths[path_key].get(method, {}).get("requestBody", {})
            if request_body:
                request_schema = request_body.get("content", {}).get("application/json", {}).get("schema", {})

        connector_info = f"Tool Data Connector:\n{json.dumps(tool_data_connector, indent=2, ensure_ascii=False)}\n" if tool_data_connector else ""
        
        payload_task = Task(
            description=f"""
            User Input: '{user_input}'
            Schema Analysis: {schema_analysis}
            Request Schema: {json.dumps(request_schema, indent=2, ensure_ascii=False)}
            Full Schema: {json.dumps(schema, indent=2, ensure_ascii=False)}
            {connector_info}
            Generate a valid JSON payload (if required) and the endpoint URL for the API call.
            For GET requests, return a dictionary of query parameters if parameters are defined in the schema, otherwise return null.
            For POST requests, generate a JSON payload if a requestBody is defined in the schema, otherwise return null.
            Return the response as a JSON object with two keys:
            - "payload": The JSON payload or query parameters (or null if not applicable).
            - "endpoint_url": The full URL for the API endpoint, constructed using the appropriate server URL from the schema's "servers" field and the correct path from the "paths" field.
            Ensure the endpoint_url is valid and corresponds to the {method.upper()} endpoint in the schema.
            """,
            expected_output="JSON object with 'payload' and 'endpoint_url'",
            agent=self.payload_agent
        )
        crew = Crew(agents=[self.payload_agent], tasks=[payload_task], process=Process.sequential)
        result = crew.kickoff()
        try:
            # Parse the agent's response
            result_str = str(result.raw if hasattr(result, 'raw') else result).strip('`').strip('json').strip()
            result_json = json.loads(result_str)
            payload = result_json.get("payload")
            endpoint_url = result_json.get("endpoint_url")
            
            if not endpoint_url:
                self.logger.error("Missing endpoint_url in agent response")
                return {"error": "Missing endpoint_url in agent response"}
            
            self.logger.debug(f"Generated payload: {json.dumps(payload, ensure_ascii=False) if payload else 'null'}")
            self.logger.debug(f"Generated endpoint URL: {endpoint_url}")
            return {"payload": payload, "endpoint_url": endpoint_url}
        except (json.JSONDecodeError, AttributeError) as e:
            self.logger.error(f"Error parsing payload or endpoint_url: {sanitize_for_logging(e)}")
            return {"error": f"Error parsing payload or endpoint_url: {sanitize_for_logging(e)}"}

    def get_task_descriptions(self, description, expected_output, task_name=None, **kwargs):
        self.logger.debug(f"Processing task descriptions for: {sanitize_for_logging(task_name)}")
        try:
            if kwargs:
                for key, value in kwargs.items():
                    placeholder = "{{" + key + "}}"
                    description = description.replace(placeholder, f"'{str(value)}'" if key == "input" else str(value))
                    expected_output = expected_output.replace(placeholder, str(value))
            return {"description": description, "expected_output": expected_output}
        except Exception as e:
            self.logger.error(f"Error processing task '{sanitize_for_logging(task_name)}': {sanitize_for_logging(e)}")
            return {"description": description, "expected_output": expected_output}

    def encode_image_to_base64(self, image_path: str) -> str:
        self.logger.debug(f"Encoding image: {sanitize_for_logging(image_path)}")
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode("utf-8")
        except Exception as e:
            self.logger.error(f"Error encoding image: {sanitize_for_logging(e)}")
            return f"Error encoding image: {sanitize_for_logging(e)}"

    def read_csv_as_text(self, csv_path: str) -> str:
        self.logger.debug(f"Reading CSV: {sanitize_for_logging(csv_path)}")
        try:
            with open(csv_path, "r", encoding="utf-8", errors="replace") as csv_file:
                content = csv_file.read()
                return content
        except Exception as e:
            self.logger.error(f"Error reading CSV: {sanitize_for_logging(e)}")
            return f"Error reading CSV: {sanitize_for_logging(e)}"

    def read_json_as_text(self, json_path: str) -> str:
        self.logger.debug(f"Reading JSON: {sanitize_for_logging(json_path)}")
        try:
            with open(json_path, "r", encoding="utf-8", errors="replace") as json_file:
                data = json.load(json_file)
                return json.dumps(data, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"Error reading JSON: {sanitize_for_logging(e)}")
            return f"Error reading JSON: {sanitize_for_logging(e)}"

    def read_txt_as_text(self, txt_path: str) -> str:
        self.logger.debug(f"Reading TXT: {sanitize_for_logging(txt_path)}")
        try:
            with open(txt_path, "r", encoding="utf-8", errors="replace") as txt_file:
                return txt_file.read()
        except Exception as e:
            self.logger.error(f"Error reading TXT: {sanitize_for_logging(e)}")
            return f"Error reading TXT: {sanitize_for_logging(e)}"

    def read_pdf_as_text(self, pdf_path: str) -> str:
        self.logger.debug(f"Reading PDF: {sanitize_for_logging(pdf_path)}")
        try:
            with open(pdf_path, "rb") as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                text = "".join(page.extract_text() or "" for page in reader.pages)
                return text.strip() or "No readable text in PDF"
        except Exception as e:
            self.logger.error(f"Error reading PDF: {sanitize_for_logging(e)}")
            return f"Error reading PDF: {sanitize_for_logging(e)}"

    def process_file_content(self, file_path: str, file_type: str) -> str:
        self.logger.debug(f"Processing file: {sanitize_for_logging(file_path)}, type: {file_type}")
        normalized_type = file_type.lower()
        if normalized_type.startswith("image/"):
            return ""  # Simplified; add GPU processing if needed
        elif normalized_type == "text/csv":
            content = self.read_csv_as_text(file_path)
            return f"\n\nCSV content:\n{content}"
        elif normalized_type == "application/json":
            content = self.read_json_as_text(file_path)
            return f"\n\nJSON content:\n{content}"
        elif normalized_type == "text/plain":
            content = self.read_txt_as_text(file_path)
            return f"\n\nText content:\n{content}"
        elif normalized_type == "application/pdf":
            content = self.read_pdf_as_text(file_path)
            return f"\n\nPDF content:\n{content}"
        return ""

    def execute_task(self, description: str, expected_output: str, task_name: Optional[str] = None, file_path: Optional[str] = None, file_type: Optional[str] = None, **kwargs):
        self.logger.info(f"Starting task execution: {sanitize_for_logging(task_name or 'Unnamed Task')}")
        self.logger.debug(f"Task description: {sanitize_for_logging(description)}")
        self.logger.debug(f"Expected output: {sanitize_for_logging(expected_output)}")
        self.logger.debug(f"Input kwargs: {sanitize_for_logging(kwargs)}")
        if file_path:
            self.logger.info(f"Processing file: {sanitize_for_logging(file_path)}")

        task_info = self.get_task_descriptions(description, expected_output, task_name, **kwargs)
        processed_description = task_info["description"]
        processed_expected_output = task_info["expected_output"]

        if file_path and file_type:
            if file_type in ALLOWED_FILE_TYPES:
                file_content = self.process_file_content(file_path, file_type)
                processed_description += file_content
                truncated_content = file_content[:100] + "..." if len(file_content) > 100 else file_content
                self.logger.info(f"Appended {file_type} content: {sanitize_for_logging(truncated_content)} (length: {len(file_content)})")
            else:
                self.logger.warning(f"Unsupported file type: {file_type} for file: {sanitize_for_logging(file_path)}")

        task = Task(
            description=processed_description,
            expected_output=processed_expected_output,
            agent=self.agent
        )

        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )

        try:
            self.logger.info("Initiating CrewAI execution")
            result = crew.kickoff()
        except Exception as e:
            self.logger.error(f"Error during CrewAI execution: {sanitize_for_logging(e)}", exc_info=True)
            raise

        raw_output = ""
        if hasattr(result, 'tasks_output') and result.tasks_output:
            raw_output = result.tasks_output[0].raw.strip() if hasattr(result.tasks_output[0], 'raw') else str(result.tasks_output[0])
        elif hasattr(result, 'raw'):
            raw_output = result.raw.strip()
        elif isinstance(result, str):
            raw_output = result.strip()
        else:
            raw_output = str(result)

        self.logger.info(f"Task '{sanitize_for_logging(task_name or 'Unnamed Task')}' completed")
        self.logger.debug(f"Raw LLM output: {sanitize_for_logging(raw_output)}")

        return raw_output

def get_api_key():
    keys = os.getenv("GEMINI_API_KEYS_FREE", "")
    key_list = [key.strip() for key in keys.split(",") if key.strip()]
    if not key_list:
        raise ValueError("No API keys found in GEMINI_API_KEYS environment variable.")
    return random.choice(key_list)