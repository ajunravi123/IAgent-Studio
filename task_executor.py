from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from langchain.tools import Tool
import os
import requests
from dotenv import load_dotenv
from functools import partial
import json
from typing import List, Dict, Optional, Any
import PyPDF2
from PIL import Image
import base64

load_dotenv()

ENABLE_GPU = True
if ENABLE_GPU:
    from transformers import BlipProcessor, BlipForConditionalGeneration
    import easyocr
    BLIP_PROCESSOR = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
    BLIP_MODEL = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")
    OCR_READER = easyocr.Reader(["en"])
else:
    BLIP_PROCESSOR = None
    BLIP_MODEL = None
    OCR_READER = None

ALLOWED_FILE_TYPES = {
    "image/jpeg": "image", "image/png": "image", "image/gif": "image",
    "text/csv": "csv", "application/json": "json", "text/plain": "text", "application/pdf": "pdf"
}
EXTENSION_TO_MIME = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "csv": "text/csv", "json": "application/json", "txt": "text/plain", "pdf": "application/pdf"
}

class TaskExecutor:
    def __init__(
        self,
        agent_configs: List[Dict[str, Any]],
        blip_processor=BLIP_PROCESSOR,
        blip_model=BLIP_MODEL,
        ocr_reader=OCR_READER
    ):
        if ENABLE_GPU:
            self.blip_processor = blip_processor
            self.blip_model = blip_model
            self.ocr_reader = ocr_reader

        API_KEYS = {
            "gemini": os.getenv("GEMINI_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY"),
        }

        self.llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEYS["gemini"])

        self.schema_agent = CrewAgent(
            role="Schema Analyzer",
            goal="Analyze OpenAPI schemas and extract key information",
            backstory="Expert in OpenAPI schema analysis.",
            verbose=False,
            allow_delegation=False,
            llm=self.llm_client
        )
        self.payload_agent = CrewAgent(
            role="Payload Generator",
            goal="Generate accurate payloads for API tools",
            backstory="Expert in creating valid API payloads.",
            verbose=False,
            allow_delegation=False,
            llm=self.llm_client
        )

        self.manager_agent = CrewAgent(
            role="Task Manager",
            goal="Delegate tasks to appropriate agents based on their roles and synthesize results",
            backstory="I'm an expert at coordinating multi-agent workflows.",
            llm=self.llm_client,
            verbose=True,
            allow_delegation=True
        )

        self.agents = []
        for config in agent_configs:
            tools = []
            if "tools" in config and config["tools"]:
                for tool_config in config["tools"]:
                    tool_schema = tool_config["schema"]
                    tool_headers = tool_config.get("auth", {}).get("headers", {})
                    tool_params = tool_config.get("auth", {}).get("params", {})

                    def create_api_caller(tool_schema, tool_headers, tool_params):
                        def api_caller(input_text, **kwargs):
                            url = kwargs.get('url')
                            headers = kwargs.get('headers', {})
                            params = kwargs.get('params', {})
                            if not url:
                                return {"error": "No API paths found in schema"}
                            path = list(url.keys())[0]
                            method = list(url[path].keys())[0]
                            base_url = tool_schema.get('servers', [{}])[0].get('url', 'http://localhost:8003')
                            endpoint_url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
                            schema_analysis = self.analyze_schema(tool_schema)
                            payload = self.generate_payload(input_text, tool_schema, schema_analysis)
                            if not payload:
                                return {"error": "Failed to generate valid payload"}
                            response = requests.post(endpoint_url, headers=headers, params=params, json=payload)
                            return response.json() if response.status_code == 200 else {"error": response.text}
                        return api_caller

                    tool_name = tool_schema["info"]["title"].lower().replace(" ", "_")
                    api_caller = partial(create_api_caller(tool_schema, tool_headers, tool_params),
                                        url=tool_schema["paths"], headers=tool_headers, params=tool_params)
                    tools.append(Tool(
                        name=tool_name,
                        func=api_caller,
                        description=f"Calls API: {tool_schema['info']['title']}. {tool_schema['info']['description']}",
                        result_as_answer=True
                    ))

            agent = CrewAgent(
                role=config["role"],
                goal=config["goal"],
                backstory=config["backstory"],
                llm=self.llm_client,
                tools=tools,
                verbose=True
            )
            self.agents.append(agent)

    def analyze_schema(self, schema: dict) -> str:
        schema_str = json.dumps(schema, indent=2)
        analysis_task = Task(
            description=f"Analyze this OpenAPI schema:\n{schema_str}\nFocus on required fields, types, constraints, and response structure.",
            expected_output="A clear summary of schema requirements",
            agent=self.schema_agent
        )
        crew = Crew(agents=[self.schema_agent], tasks=[analysis_task], process=Process.sequential)
        return str(crew.kickoff())

    def generate_payload(self, user_input: str, schema: dict, schema_analysis: str) -> Optional[dict]:
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
                
                Generate a valid JSON payload that satisfies all schema requirements.
                Return only the JSON payload as a string or '{{}}' if invalid.
            """,
            expected_output="A JSON string representing the payload",
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
        normalized_type = file_type.lower()
        if normalized_type.startswith("image/"):
            try:
                file_path_str = str(file_path) if not isinstance(file_path, str) else file_path
                if not os.path.exists(file_path_str):
                    raise FileNotFoundError(f"Image file not found at: {file_path_str}")
                
                if ENABLE_GPU:
                    image = Image.open(file_path_str)
                    inputs = self.blip_processor(image, return_tensors="pt")
                    out = self.blip_model.generate(**inputs, max_length=150)
                    detailed_description = self.blip_processor.decode(out[0], skip_special_tokens=True)
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
        """Execute a task with multi-agent orchestration using a manager agent."""
        task_info = self.get_task_descriptions(description, expected_output, task_name, **kwargs)
        processed_description = task_info["description"]
        processed_expected_output = task_info["expected_output"]

        if file_path:
            ext = os.path.splitext(file_path)[1].lower().replace(".", "")
            file_type = EXTENSION_TO_MIME.get(ext)
            if file_type and file_type in ALLOWED_FILE_TYPES:
                file_content = self.process_file_content(file_path, file_type)
                processed_description += file_content
                print(f"Appended {file_type} content: {file_content[:100]}... (full length: {len(file_content)})")

        # Create tasks for each agent
        tasks = []
        for agent in self.agents:
            if "Analyzer" in agent.role:
                task_desc = f"Analyze the input: {processed_description}"
                task_output = "A detailed analysis of the input data"
            else:
                task_desc = processed_description
                task_output = processed_expected_output
            tasks.append(Task(description=task_desc, expected_output=task_output, agent=agent))

        # Choose process based on number of worker agents
        if len(self.agents) == 1:
            crew = Crew(
                agents=self.agents + [self.schema_agent, self.payload_agent],
                tasks=tasks,
                process=Process.sequential,
                verbose=True
            )
        else:
            crew = Crew(
                agents=self.agents + [self.schema_agent, self.payload_agent],
                tasks=tasks,
                process=Process.hierarchical,
                manager_agent=self.manager_agent,
                verbose=True
            )

        result = crew.kickoff()
        raw_output = result.tasks_output[-1].raw.strip()
        print(f"Raw LLM output for task '{task_name or 'unnamed'}': {raw_output}")
        return raw_output