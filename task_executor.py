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
from PIL import Image
import random

load_dotenv()

ENABLE_GPU = False

if ENABLE_GPU:
    from transformers import BlipProcessor, BlipForConditionalGeneration
    import easyocr

    # Global initialization of BLIP and EasyOCR models (runs once when module is imported)
    BLIP_PROCESSOR = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
    BLIP_MODEL = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")
    OCR_READER = easyocr.Reader(["en"])  # Initialize EasyOCR with English language support
else:
    BLIP_PROCESSOR = None
    BLIP_MODEL = None
    OCR_READER = None

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

# Extension to MIME type mapping (case-insensitive)
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

class TaskExecutor:
    def __init__(
        self,
        agent_config: Dict[str, str],
        tools_config: Optional[list] = None,
        blip_processor=BLIP_PROCESSOR,
        blip_model=BLIP_MODEL,
        ocr_reader=OCR_READER
    ):
        if ENABLE_GPU:
            # Use pre-initialized models passed as arguments (defaults to global instances)
            self.blip_processor = blip_processor
            self.blip_model = blip_model
            self.ocr_reader = ocr_reader

        API_KEYS = {
            "gemini": os.getenv("GEMINI_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY"),
        }

        API_KEY = get_api_key()

        self.llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEY)

        # self.llm_client = LLM(
        #     model="deepseek-chat",
        #     api_key='sk-5936f2f8151847fb8374d1111fe2c00a',
        #     base_url="https://api.deepseek.com/v1"
        # )

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
                            url = kwargs.get('url')
                            headers = kwargs.get('headers', {})
                            params = kwargs.get('params', {})
                            if not url:
                                return {"error": "No API paths found in schema"}

                            path = list(url.keys())[0]
                            method = list(url[path].keys())[0]
                            if path.startswith('http'):
                                endpoint_url = path
                            else:
                                base_url = tool_schema.get('servers', [{}])[0].get('url', 'http://localhost:8003')
                                endpoint_url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
                            
                            schema_analysis = self.analyze_schema(tool_schema)
                            payload = self.generate_payload(input_text, tool_schema, schema_analysis, tool_data_connector)
                            if not payload:
                                return {"error": "Failed to generate valid payload"}

                            response = requests.post(
                                endpoint_url,
                                headers=headers,
                                params=params,
                                json=payload
                            )
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

                tool_name = tool_schema["info"]["title"].lower().replace(" ", "_")
                api_caller = create_api_caller(tool_schema, tool_headers, tool_params, tool_data_connector)
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
                        description=f"""Calls API: {tool_schema['info']['title']}. {tool_schema['info'].get('description', '')}
                        Input: {{input}}
                        Important: Use the complete input text as provided.""",
                        result_as_answer=True
                    )
                )

        self.agent = CrewAgent(
            role=agent_config["role"],
            goal=agent_config["goal"],
            backstory=agent_config["backstory"],
            llm=self.llm_client,
            tools=self.tools if self.tools else [],
            verbose=True
        )

    def analyze_schema(self, schema: dict) -> str:
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

    def generate_payload(self, user_input: str, schema: dict, schema_analysis: str, tool_data_connector: Optional[dict] = None) -> Optional[dict]:
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
        
        # Prepare tool_data_connector information for the prompt
        connector_info = ""
        if tool_data_connector:
            connector_info = f"""
                Tool Data Connector:
                {json.dumps(tool_data_connector, indent=2)}
                
                Ensure the payload is compatible with the specified data connector's configuration and type.
            """
        
        payload_task = Task(
            description=f"""
                Given the following information:
                
                User Input: '{user_input}'
                
                Schema Analysis:
                {schema_analysis}
                
                Request Schema:
                {json.dumps(request_schema, indent=2)}
                
                {connector_info}
                
                Generate a valid JSON payload that:
                1. Satisfies all schema requirements and constraints
                2. Extracts relevant information from the user input
                3. Handles any missing or invalid data appropriately
                4. For time-related inputs:
                   - Extract time information from natural language (e.g., "evening 6 o'clock" -> 18)
                   - Convert to 24-hour format (0-23)
                   - Handle various time formats (morning, afternoon, evening, night)
                   - Use current time as fallback for invalid inputs
                5. For invalid inputs, use sensible defaults
                6. If a tool_data_connector is provided, ensure the payload is compatible with its configuration (e.g., database type, schema, or connection details)
                
                Return only the JSON payload as a string.
                If no valid payload can be determined, return an empty JSON object '{{}}'.
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
        if task_name:
            try:
                if kwargs:
                    for key, value in kwargs.items():
                        placeholder = "{{" + key + "}}"
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

    def encode_image_to_base64(self, image_path: str) -> str:
        try:
            with open(image_path, "rb") as image_file:
                encoded = base64.b64encode(image_file.read()).decode("utf-8")
                return encoded
        except Exception as e:
            print(f"Error encoding image: {e}")
            return f"Error encoding image: {str(e)}"

    def read_csv_as_text(self, csv_path: str) -> str:
        try:
            with open(csv_path, "r", encoding="utf-8") as csv_file:
                content = csv_file.read()
                return content
        except Exception as e:
            print(f"Error reading CSV: {e}")
            return f"Error reading CSV: {str(e)}"

    def read_json_as_text(self, json_path: str) -> str:
        try:
            with open(json_path, "r", encoding="utf-8") as json_file:
                data = json.load(json_file)
                return json.dumps(data, indent=2)
        except Exception as e:
            print(f"Error reading JSON: {e}")
            return f"Error reading JSON: {str(e)}"

    def read_txt_as_text(self, txt_path: str) -> str:
        try:
            with open(txt_path, "r", encoding="utf-8") as txt_file:
                content = txt_file.read()
                return content
        except Exception as e:
            print(f"Error reading TXT: {e}")
            return f"Error reading TXT: {str(e)}"

    def read_pdf_as_text(self, pdf_path: str) -> str:
        try:
            with open(pdf_path, "rb") as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                return text.strip() if text.strip() else "No readable text found in PDF"
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return f"Error reading PDF: {str(e)}"

    def process_file_content(self, file_path: str, file_type: str) -> str:
        """Process file content based on its type and return as a string."""
        normalized_type = file_type.lower()
        if normalized_type.startswith("image/"):  # Handle images differently
            try:
                # Convert file_path to string if it's a Path object
                file_path_str = str(file_path) if not isinstance(file_path, str) else file_path

                # Verify file exists
                if not os.path.exists(file_path_str):
                    raise FileNotFoundError(f"Image file not found at: {file_path_str}")

                if ENABLE_GPU:
                    # Load image
                    image = Image.open(file_path_str)
                    
                    # Generate detailed description using BLIP
                    inputs = self.blip_processor(image, return_tensors="pt")
                    out = self.blip_model.generate(**inputs, max_length=150)
                    detailed_description = self.blip_processor.decode(out[0], skip_special_tokens=True)
                    
                    # Extract text using EasyOCR
                    print(f"Processing OCR for file: {file_path_str}")
                    ocr_results = self.ocr_reader.readtext(file_path_str)
                    extracted_text = " ".join([result[1] for result in ocr_results]) if ocr_results else "No text detected"
                    
                    return f"\n\n\nExtracted Image Description: {detailed_description}\nExtracted Text: {extracted_text}"
                else:
                    return ""
            except Exception as e:
                print(f"Error processing image: {e}")
                return f"Error processing image: {str(e)}"
        elif normalized_type == "text/csv":
            return f"\n\nCSV content:\n{self.read_csv_as_text(file_path)}"
        elif normalized_type == "application/json":
            return f"\n\nJSON content:\n{self.read_json_as_text(file_path)}"
        elif normalized_type == "text/plain":
            return f"\n\nText content:\n{self.read_txt_as_text(file_path)}"
        elif normalized_type == "application/pdf":
            return f"\n\nPDF content:\n{self.read_pdf_as_text(file_path)}"
        return ""

    def execute_task(self, description: str, expected_output: str, task_name: Optional[str] = None, file_path: Optional[str] = None, **kwargs):
        """Execute a task, optionally including file content based on type."""
        task_info = self.get_task_descriptions(description, expected_output, task_name, **kwargs)
        processed_description = task_info["description"]
        processed_expected_output = task_info["expected_output"]

        # Append file content to description if a file is provided
        if file_path:
            ext = os.path.splitext(file_path)[1].lower().replace(".", "")
            file_type = EXTENSION_TO_MIME.get(ext)
            if file_type and file_type in ALLOWED_FILE_TYPES:
                file_content = self.process_file_content(file_path, file_type)
                processed_description += file_content
                truncated_content = file_content[:100] + "..." if len(file_content) > 100 else file_content
                print(f"Appended {file_type} content to task description: {truncated_content} (full length: {len(file_content)})")

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

        # Handle potential variations in CrewAI result structure
        raw_output = ""
        if hasattr(result, 'tasks_output') and result.tasks_output:
            # Access the raw output of the first task's output
            if hasattr(result.tasks_output[0], 'raw') and result.tasks_output[0].raw:
                raw_output = result.tasks_output[0].raw.strip()
            else:
                # Fallback if raw attribute is missing or None
                raw_output = str(result.tasks_output[0])
        elif hasattr(result, 'raw'): # Check if result itself has 'raw'
            raw_output = result.raw.strip()
        elif isinstance(result, str):
             raw_output = result.strip()
        else: # Fallback if structure is unexpected
             raw_output = str(result)

        if task_name:
            print(f"Raw LLM output for task '{task_name}': {raw_output}")
        else:
            print(f"Raw LLM output: {raw_output}")
        return raw_output





# This is a temporary function to get a random API key from the GEMINI_API_KEYS environment variable.
def get_api_key():
    keys = os.getenv("GEMINI_API_KEYS_FREE", "")
    key_list = [key.strip() for key in keys.split(",") if key.strip()]
    if not key_list:
        raise ValueError("No API keys found in GEMINI_API_KEYS environment variable.")
    return random.choice(key_list)