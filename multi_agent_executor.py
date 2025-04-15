from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from langchain.tools import Tool
import os
import requests
import random
from dotenv import load_dotenv
import json
import re
import uuid
from typing import Optional, Dict, Any, List
import logging
import unicodedata
import time
from functools import lru_cache

from task_executor import (
    ALLOWED_FILE_TYPES,
    EXTENSION_TO_MIME,
    ENABLE_GPU,
    BLIP_PROCESSOR,
    BLIP_MODEL,
    OCR_READER,
)

if ENABLE_GPU:
    from PIL import Image

load_dotenv()

# Disable CrewAI telemetry
os.environ["CREWAI_TELEMETRY_ENABLED"] = "false"
logger = logging.getLogger(__name__)
logger.info("CrewAI telemetry disabled via CREWAI_TELEMETRY_ENABLED=false")

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class MultiAgentExecutor:
    """
    Orchestrates multiple agents using a sequential process for robust task delegation.
    Handles any user input dynamically, preserves emojis, extracts all contextual clues,
    and ensures clear error messages for ambiguous inputs.
    """
    def __init__(
        self,
        multi_agent_config: Dict[str, Any],
        worker_agent_configs: List[Dict[str, Any]],
        blip_processor=BLIP_PROCESSOR,
        blip_model=BLIP_MODEL,
        ocr_reader=OCR_READER
    ):
        self.multi_agent_config = multi_agent_config
        self.worker_agent_configs = worker_agent_configs
        self._validate_configs()

        if ENABLE_GPU:
            self.blip_processor = blip_processor
            self.blip_model = blip_model
            self.ocr_reader = ocr_reader

        # Initialize LLM client with retry logic
        self.llm_client = LLM(
            model="gemini/gemini-2.0-flash",
            api_key=self._get_api_key(),
            max_retries=3,
            retry_delay=34
        )

        # Initialize utility agents
        self.schema_agent = self._create_utility_agent(
            role="Schema Analyzer",
            goal="Extract key information from OpenAPI schemas.",
            backstory="Expert in analyzing OpenAPI schemas."
        )
        self.payload_agent = self._create_utility_agent(
            role="Payload Generator",
            goal="Generate valid API payloads from any input with all contextual clues.",
            backstory="Specialist in creating accurate API payloads with full context."
        )

        # Initialize Manager Agent
        self.manager_agent = CrewAgent(
            role=self.multi_agent_config.get("role", "Coordinator"),
            goal=self.multi_agent_config.get("goal", "Delegate tasks efficiently."),
            backstory=self.multi_agent_config.get("backstory", "Orchestrates worker agents."),
            llm=self.llm_client,
            verbose=False,
            allow_delegation=False
        )
        logger.info(f"Initialized Manager Agent: {self.manager_agent.role}")

        # Initialize Worker Agents
        self.worker_agents = []
        self.worker_map = {}
        for config in self.worker_agent_configs:
            tools = self._load_agent_tools(config)
            agent = CrewAgent(
                role=config["role"],
                goal=config["goal"],
                backstory=config["backstory"],
                llm=self.llm_client,
                tools=tools,
                verbose=False,
                allow_delegation=False
            )
            self.worker_agents.append(agent)
            self.worker_map[config["id"]] = {
                "agent": agent,
                "config": config
            }
            logger.info(f"Initialized Worker Agent: {agent.role} (ID: {config['id']}, Name: {config['name']})")

        if not self.worker_agents:
            logger.warning("No worker agents initialized.")

        # Track LLM calls
        self.llm_call_count = 0

    def _validate_configs(self):
        """Validates configurations."""
        required_manager_fields = ["role", "goal", "backstory", "description"]
        required_worker_fields = ["id", "role", "goal", "backstory", "instructions", "expectedOutput"]

        for field in required_manager_fields:
            if field not in self.multi_agent_config:
                logger.warning(f"Missing manager config field: {field}. Using default.")
                self.multi_agent_config[field] = f"Default {field}"

        for config in self.worker_agent_configs:
            for field in required_worker_fields:
                if field not in config:
                    logger.warning(f"Missing worker config field: {field} for agent {config.get('id', 'unknown')}. Using default.")
                    config[field] = f"Default {field}"
            if "name" not in config:
                config["name"] = config["role"]
                logger.warning(f"Missing name for agent {config['id']}, using role: {config['name']}")

    def _get_api_key(self) -> str:
        """Selects a random API key."""
        keys = os.getenv("GEMINI_API_KEYS", "").split(",")
        key_list = [key.strip() for key in keys if key.strip()]
        if not key_list:
            raise ValueError("No API keys found in GEMINI_API_KEYS.")
        return random.choice(key_list)

    def _create_utility_agent(self, role: str, goal: str, backstory: str) -> CrewAgent:
        """Creates a utility agent."""
        return CrewAgent(
            role=role,
            goal=goal,
            backstory=backstory,
            llm=self.llm_client,
            verbose=False,
            allow_delegation=False
        )

    def _load_agent_tools(self, agent_config: Dict[str, Any]) -> List[Tool]:
        """Loads tools for an agent."""
        tools = []
        tools_config = agent_config.get("tools", [])
        agent_id = agent_config.get("id", "unknown")

        if not isinstance(tools_config, list):
            logger.warning(f"Invalid tools config for agent {agent_id}.")
            return tools

        for tool_config in tools_config:
            if not isinstance(tool_config, dict) or "schema" not in tool_config:
                logger.warning(f"Skipping invalid tool config for agent {agent_id}: {tool_config}")
                continue

            tool_schema = tool_config.get("schema")
            if not isinstance(tool_schema, dict) or "info" not in tool_schema or "paths" not in tool_schema:
                logger.warning(f"Skipping invalid schema for tool {tool_config.get('id')} in agent {agent_id}")
                continue

            tool_headers = tool_config.get("auth", {}).get("headers", {})
            tool_params = tool_config.get("auth", {}).get("params", {})

            def create_api_caller(schema: Dict, headers: Dict, params: Dict, agent_id: str):
                def api_caller(input_text: str, **kwargs) -> Dict:
                    try:
                        logger.info(f"Agent {agent_id} api_caller received input_text: '{input_text}'")
                        if not input_text or "{{input}}" in input_text:
                            logger.error(f"Invalid input for API call by agent {agent_id}: '{input_text}'")
                            return {"error": f"Invalid input: '{input_text}'"}

                        request_schema = (
                            schema.get("paths", {})
                            .get(next(iter(schema.get("paths", {}))), {})
                            .get("post", {})
                            .get("requestBody", {})
                            .get("content", {})
                            .get("application/json", {})
                            .get("schema", {})
                        )
                        required_fields = request_schema.get("required", [])
                        if required_fields:
                            logger.debug(f"Schema requires fields: {required_fields}")

                        paths = schema.get("paths")
                        if not paths:
                            logger.error(f"No API paths found in schema for agent {agent_id}")
                            return {"error": "No API paths found"}

                        path = next(iter(paths))
                        path_info = paths[path]
                        method = next(iter(path_info)).lower()

                        endpoint_url = path if path.startswith('http') else (
                            f"{schema.get('servers', [{}])[0].get('url', 'http://localhost:8003').rstrip('/')}/{path.lstrip('/')}"
                        )

                        payload = None
                        if method in ['post', 'put', 'patch']:
                            schema_analysis = self.analyze_schema(json.dumps(schema))
                            logger.debug(f"Agent {agent_id} generating payload with input: '{input_text}'")
                            payload = self.generate_payload(input_text, schema, schema_analysis, agent_id)
                            if payload is None:
                                logger.error(f"Failed to generate payload for agent {agent_id} with input: '{input_text}'")
                                return {"error": f"Failed to generate payload for input: '{input_text}'"}
                            if "error" in payload:
                                logger.warning(f"Ambiguous input for agent {agent_id}: {payload['error']}")
                                return payload

                        logger.info(f"Agent {agent_id} calling {method.upper()} {endpoint_url} with payload: {json.dumps(payload, ensure_ascii=False)}")
                        response = requests.request(
                            method=method,
                            url=endpoint_url,
                            headers=headers,
                            params=params,
                            json=payload
                        )

                        if 200 <= response.status_code < 300:
                            try:
                                result = response.json()
                                logger.info(f"Agent {agent_id} API response: {json.dumps(result, ensure_ascii=False)}")
                                return result
                            except json.JSONDecodeError:
                                result = {"success": True, "content": response.text}
                                logger.info(f"Agent {agent_id} API non-JSON response: {result}")
                                return result
                        else:
                            error_content = response.json().get('detail', response.text) if response.text else response.text
                            logger.error(f"API call failed for agent {agent_id} ({response.status_code}): {error_content}")
                            return {"error": f"API call failed ({response.status_code}): {error_content}"}
                    except Exception as e:
                        logger.error(f"Error in API call for agent {agent_id}: {e}")
                        return {"error": f"API call error: {str(e)}"}
                return api_caller

            tool_name = tool_schema.get("info", {}).get("title", f"tool_{tool_config.get('id')}")
            tool_name = tool_name.lower().replace(" ", "_")
            api_caller_instance = create_api_caller(tool_schema, tool_headers, tool_params, agent_id)

            tool_title = tool_schema.get("info", {}).get("title", "Unknown API")
            tool_description = tool_schema.get("info", {}).get("description", "")
            tool_description = f"Calls API: {tool_title}. {tool_description}"

            tools.append(
                Tool(
                    name=tool_name,
                    func=api_caller_instance,
                    description=tool_description,
                    result_as_answer=True
                )
            )
            logger.info(f"Loaded tool {tool_name} for agent {agent_id}")

        return tools

    @lru_cache(maxsize=100)
    def analyze_schema(self, schema: str) -> str:
        """Analyzes an OpenAPI schema to extract key requirements, cached by schema."""
        try:
            schema_dict = json.loads(schema)
            schema_str = json.dumps(schema_dict, indent=2, ensure_ascii=False)
            task = Task(
                description=(
                    f"Analyze the following OpenAPI schema:\n{schema_str}\n"
                    "Provide a concise summary in plain text, including:\n"
                    "- Required request fields, their data types, and constraints.\n"
                    "- Expected response structure.\n"
                    "Example: 'The API requires a JSON object with an \"hour\" integer (0-23). The response is a JSON object with a \"greeting\" string.'\n"
                    "Return plain text only."
                ),
                expected_output="A concise summary of schema requirements in plain text.",
                agent=self.schema_agent
            )
            crew = Crew(agents=[self.schema_agent], tasks=[task], process=Process.sequential)
            self.llm_call_count += 1
            logger.debug(f"LLM call count: {self.llm_call_count}")
            if self.llm_call_count > 12:
                logger.warning("Approaching Gemini API free-tier quota (15 calls/min)")
            result = crew.kickoff()
            analysis = str(result).strip()
            if analysis.startswith('```') or analysis == '{}':
                logger.warning("Invalid schema analysis format, falling back to manual extraction.")
                return self._manual_schema_analysis(schema_dict)
            logger.info(f"Schema analysis: {analysis}")
            return analysis
        except Exception as e:
            logger.error(f"Error analyzing schema: {e}")
            return self._manual_schema_analysis(schema_dict)

    def _manual_schema_analysis(self, schema: Dict) -> str:
        """Manually extracts schema requirements as a fallback."""
        try:
            request_schema = (
                schema.get("paths", {})
                .get(next(iter(schema.get("paths", {}))), {})
                .get("post", {})
                .get("requestBody", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema", {})
            )
            properties = request_schema.get("properties", {})
            required = request_schema.get("required", [])
            response_schema = (
                schema.get("paths", {})
                .get(next(iter(schema.get("paths", {}))), {})
                .get("post", {})
                .get("responses", {})
                .get("200", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema", {})
            )

            request_desc = "The API requires a JSON object with "
            if properties:
                fields = []
                for key, prop in properties.items():
                    field_type = prop.get("type", "unknown")
                    constraints = []
                    if "minimum" in prop:
                        constraints.append(f"min {prop['minimum']}")
                    if "maximum" in prop:
                        constraints.append(f"max {prop['maximum']}")
                    if "enum" in prop:
                        constraints.append(f"allowed: {prop['enum']}")
                    field_desc = f'"{key}" {field_type}'
                    if constraints:
                        field_desc += f" ({', '.join(constraints)})"
                    if key in required:
                        field_desc += " (required)"
                    fields.append(field_desc)
                request_desc += ", ".join(fields) + "."
            else:
                request_desc += "no specific fields."

            response_desc = " The response is a JSON object with "
            response_props = response_schema.get("properties", {})
            if response_props:
                fields = [f'"{key}" {prop.get("type", "unknown")}' for key, prop in response_props.items()]
                response_desc += ", ".join(fields) + "."
            else:
                response_desc += "no specific fields."

            analysis = request_desc + response_desc
            logger.info(f"Manual schema analysis: {analysis}")
            return analysis
        except Exception as e:
            logger.error(f"Error in manual schema analysis: {e}")
            return "Failed to analyze schema."

    def generate_payload(self, user_input: str, schema: Dict, schema_analysis: str, agent_id: str) -> Optional[Dict]:
        """Generates a valid API payload, handling ambiguous inputs."""
        paths = schema.get("paths", {})
        if not paths:
            logger.error(f"No paths found in schema for agent {agent_id}")
            return {"error": "Invalid API schema"}

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
                {json.dumps(request_schema, indent=2, ensure_ascii=False)}

                Generate a valid JSON payload that:
                1. Satisfies all schema requirements and constraints
                2. Extracts relevant information from the user input
                3. Handles any missing or invalid data appropriately
                4. For time-related inputs:
                   - Extract time information from natural language (e.g., "evening 6 o'clock" -> 18)
                   - Convert to 24-hour format (0-23)
                   - Handle various time formats (morning, afternoon, evening, night)
                   - If input is ambiguous (e.g., '8', '8 O'clock') without a time period, return {{"error": "Please clarify the time period for \"{user_input}\""}}
                5. For invalid inputs, return {{"error": "Invalid input: \"{user_input}\""}}

                Examples:
                - Input: 'evening 8 O'clock', Schema: {{"hour": integer}} -> '{{"hour": 20}}'
                - Input: '8', Schema: {{"hour": integer}} -> '{{"error": "Please clarify the time period for \"8\""}}'
                - Input: 'hello', Schema: {{"hour": integer}} -> '{{"error": "Invalid input: \"hello\""}}'

                Return only the JSON payload as a string.
            """,
            expected_output="A JSON string representing the payload or an error message",
            agent=self.payload_agent
        )
        crew = Crew(agents=[self.payload_agent], tasks=[payload_task], process=Process.sequential)
        self.llm_call_count += 1
        logger.debug(f"LLM call count: {self.llm_call_count}")
        if self.llm_call_count > 12:
            logger.warning("Approaching Gemini API free-tier quota (15 calls/min)")
        try:
            result = crew.kickoff()
            payload_str = str(result.raw if hasattr(result, 'raw') else result.output if hasattr(result, 'output') else result)
            payload_str = payload_str.strip('`').strip('json').strip()
            payload = json.loads(payload_str)
            logger.info(f"Generated payload for agent {agent_id}: {json.dumps(payload, ensure_ascii=False)}")
            return payload
        except (json.JSONDecodeError, AttributeError) as e:
            logger.error(f"Error parsing payload for agent {agent_id}: {e}")
            return {"error": f"Invalid payload format: {str(e)}"}

    def clean_output(self, output: str) -> str:
        """Cleans output by removing UUIDs, metadata, and extra whitespace, preserving emojis."""
        if not output:
            logger.info("Empty output received for cleaning")
            return ""

        try:
            cleaned = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '', output)
            metadata_phrases = ["output from", "task result", "agent output"]
            for phrase in metadata_phrases:
                cleaned = cleaned.replace(phrase, "").replace(phrase.title(), "").replace(phrase.upper(), "")
            cleaned = cleaned.strip().strip('[]').strip()
            logger.info(f"Cleaned output: '{cleaned}'")
            return cleaned
        except Exception as e:
            logger.error(f"Error cleaning output: {e}")
            return output.strip()

    def process_file_content(self, file_path: str, file_type: str) -> str:
        """Processes file content."""
        normalized_type = file_type.lower()
        content = ""
        try:
            if normalized_type.startswith("image/"):
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"Image not found: {file_path}")
                if ENABLE_GPU:
                    image = Image.open(file_path)
                    inputs = self.blip_processor(image, return_tensors="pt")
                    out = self.blip_model.generate(**inputs, max_length=150)
                    desc = self.blip_processor.decode(out[0], skip_special_tokens=True)
                    ocr = self.ocr_reader.readtext(file_path)
                    text = " ".join([r[1] for r in ocr]) if ocr else "No text detected"
                    content = f"[Image Content]\nDescription: {desc}\nText: {text}"
                else:
                    content = "[Image Uploaded - Processing Skipped (GPU Disabled)]"
            elif normalized_type == "text/csv":
                content = f"[CSV Content]\n{self.read_csv_as_text(file_path)}"
            elif normalized_type == "application/json":
                content = f"[JSON Content]\n{self.read_json_as_text(file_path)}"
            elif normalized_type == "text/plain":
                content = f"[Text Content]\n{self.read_txt_as_text(file_path)}"
            elif normalized_type == "application/pdf":
                content = f"[PDF Content]\n{self.read_pdf_as_text(file_path)}"
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            content = f"[Error processing file: {e}]"
        return content

    def read_csv_as_text(self, csv_path: str) -> str:
        try:
            with open(csv_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"Error reading CSV: {e}"

    def read_json_as_text(self, json_path: str) -> str:
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.dumps(json.load(f), indent=2, ensure_ascii=False)
        except Exception as e:
            return f"Error reading JSON: {e}"

    def read_txt_as_text(self, txt_path: str) -> str:
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"Error reading TXT: {e}"

    def read_pdf_as_text(self, pdf_path: str) -> str:
        try:
            import PyPDF2
            text = ""
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
            return text.strip() or "No readable text found"
        except Exception as e:
            return f"Error reading PDF: {e}"

    def execute_task(self, user_input: str, file_path: Optional[str] = None) -> str:
        """Executes multi-agent orchestration based on manager description."""
        try:
            if len(self.worker_agents) < 2:
                logger.error("At least two worker agents are required.")
                return "Error: At least two worker agents are required."

            # Reset LLM call count
            self.llm_call_count = 0

            # 1. Prepare file content
            file_content = ""
            if file_path:
                ext = os.path.splitext(file_path)[1].lower().lstrip(".")
                file_type = EXTENSION_TO_MIME.get(ext)
                if file_type and file_type in ALLOWED_FILE_TYPES:
                    file_content = self.process_file_content(file_path, file_type)
                    logger.info(f"Processed file: {file_path} (type: {file_type})")
                else:
                    logger.warning(f"Unsupported file type for {file_path}: {ext}")

            # 2. Resolve manager description
            manager_description = self.multi_agent_config.get(
                "description",
                "Coordinate the processing of the user request using two sub-agents in sequence."
            )
            manager_description += f"\n\nOriginal User Input: '{user_input}'"
            if file_content:
                manager_description += f"\nFile Content: {file_content}"
            logger.info(f"Manager description: {manager_description}")

            # 3. Prepare worker metadata
            worker_metadata = [
                {
                    "id": config["id"],
                    "name": config["name"],
                    "role": config["role"],
                    "goal": config["goal"],
                    "instructions": config["instructions"],
                    "tools": [
                        {
                            "name": tool["schema"]["info"].get("title", tool["id"]),
                            "schema": tool["schema"]
                        }
                        for tool in config.get("tools", [])
                    ]
                }
                for config in self.worker_agent_configs
            ]
            logger.info(f"Worker metadata prepared: {json.dumps([{'id': w['id'], 'name': w['name']} for w in worker_metadata], indent=2)}")

            # 4. Create and execute tasks sequentially
            worker_tasks = []
            first_agent_output = None
            first_agent_name = worker_metadata[0]["name"] if worker_metadata else "First Agent"
            second_agent_name = worker_metadata[1]["name"] if len(worker_metadata) > 1 else "Second Agent"

            for idx, config in enumerate(self.worker_agent_configs):
                agent_id = config["id"]
                agent_name = config["name"]
                default_instructions = f"Perform your role: {config['role']}"
                instructions = config.get("instructions", default_instructions)

                if idx == 0:
                    # First agent: Process user input
                    task_description = instructions.replace("{{input}}", user_input)
                    if file_content:
                        task_description += f"\nFile Content: {file_content}"
                    task_description += (
                        "\nInstructions:\n"
                        "- Process the full input, preserving emojis and context.\n"
                        "- Use your tools or LLM to generate the output.\n"
                        "- For ambiguous inputs, return an error like 'Please clarify the input'.\n"
                        "- Return a clear result based on your role."
                    )
                    task = Task(
                        description=task_description,
                        expected_output=config.get("expectedOutput", "A contribution to the goal."),
                        agent=self.worker_map[agent_id]["agent"]
                    )
                    crew = Crew(
                        agents=[self.worker_map[agent_id]["agent"]],
                        tasks=[task],
                        process=Process.sequential,
                        verbose=False
                    )
                    self.llm_call_count += 1
                    logger.debug(f"LLM call count: {self.llm_call_count}")
                    result = crew.kickoff()
                    raw_result = str(getattr(result, 'raw', result)).strip()
                    first_agent_output = self.clean_output(raw_result)
                    logger.info(f"First agent ({agent_name}) output: '{first_agent_output}'")
                    if not first_agent_output or "error" in first_agent_output.lower():
                        logger.warning(f"First agent failed, returning: {first_agent_output}")
                        return first_agent_output or "Error: First agent failed to produce valid output."
                    worker_tasks.append(task)

                elif idx == 1:
                    # Second agent: Process first agent's output
                    task_description = instructions.replace("{{input}}", first_agent_output or user_input)
                    if file_content:
                        task_description += f"\nFile Content: {file_content}"
                    task_description += (
                        "\nInstructions:\n"
                        f"- Process the input provided (output from '{first_agent_name}').\n"
                        "- If the input is text in English, translate it to Hindi and return only the translated text.\n"
                        "- Preserve all content, including emojis.\n"
                        "- Do not add any extra text, prefixes, or metadata.\n"
                        "- Return the processed result."
                    )
                    task = Task(
                        description=task_description,
                        expected_output="The direct Hindi translation of the input text, with no additional content.",
                        agent=self.worker_map[agent_id]["agent"]
                    )
                    worker_tasks.append(task)

                else:
                    # Additional agents (if any): Process user input
                    task_description = instructions.replace("{{input}}", user_input)
                    if file_content:
                        task_description += f"\nFile Content: {file_content}"
                    task_description += (
                        "\nInstructions:\n"
                        "- Process the full input, preserving emojis and context.\n"
                        "- Use your tools or LLM to generate the output.\n"
                        "- Return a clear result based on your role."
                    )
                    task = Task(
                        description=task_description,
                        expected_output=config.get("expectedOutput", "A contribution to the goal."),
                        agent=self.worker_map[agent_id]["agent"]
                    )
                    worker_tasks.append(task)

                logger.info(f"Task description for agent {agent_id} ({agent_name}): '{task_description}'")

            # 5. Create Manager Task
            manager_task = Task(
                description=(
                    f"{manager_description}\n\n"
                    f"Instructions:\n"
                    f"1. Use the output from '{first_agent_name}': '{first_agent_output}'.\n"
                    f"2. Use the output from '{second_agent_name}' (to be provided).\n"
                    f"3. Return the '{second_agent_name}' output as the final result.\n"
                    f"4. Preserve all content, including emojis (e.g., 😊, 🌙).\n"
                    f"5. If no valid output from '{second_agent_name}', return '{first_agent_name}' output or an error."
                ),
                expected_output="Final output from the second agent or an error message",
                agent=self.manager_agent
            )
            self.llm_call_count += 1
            logger.debug(f"LLM call count: {self.llm_call_count}")

            # 6. Run remaining tasks
            logger.info("Starting crew execution")
            crew = Crew(
                agents=self.worker_agents,
                tasks=[manager_task] + worker_tasks[1:],  # Skip first task (already run)
                process=Process.sequential,
                verbose=False
            )

            result = crew.kickoff()
            logger.info("Crew execution completed")

            # 7. Extract and Clean Result
            raw_result = str(getattr(result, 'raw', result)).strip()
            final_result = self.clean_output(raw_result)
            logger.info(f"Final cleaned output: '{final_result}'")
            if not final_result:
                logger.warning("Empty result after cleaning")
                return first_agent_output or "No output generated."
            return final_result

        except Exception as e:
            logger.error(f"Error during execution: {e}", exc_info=True)
            if "RateLimitError" in str(type(e).__name__):
                logger.warning("Gemini API rate limit exceeded.")
                return "Error: API rate limit exceeded. Please try again later."
            return f"An error occurred: {str(e)}"