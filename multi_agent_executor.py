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

# Configure logging for detailed tracing
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class MultiAgentExecutor:
    """
    Orchestrates multiple agents using a hierarchical process for robust task delegation.
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

        # Initialize LLM client
        self.llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=self._get_api_key())

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
        self.clean_output_agent = self._create_utility_agent(
            role="Output Cleaner",
            goal="Remove metadata and UUIDs from outputs while preserving content.",
            backstory="Expert in cleaning agent outputs without altering meaning."
        )

        # Initialize Manager Agent
        self.manager_agent = CrewAgent(
            role=self.multi_agent_config.get("role", "Coordinator"),
            goal=self.multi_agent_config.get("goal", "Delegate tasks efficiently."),
            backstory=self.multi_agent_config.get("backstory", "Orchestrates worker agents."),
            llm=self.llm_client,
            verbose=True,
            allow_delegation=True
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
                verbose=True,
                allow_delegation=False
            )
            self.worker_agents.append(agent)
            self.worker_map[config["id"]] = {
                "agent": agent,
                "config": config
            }
            logger.info(f"Initialized Worker Agent: {agent.role} (ID: {config['id']})")

        if not self.worker_agents:
            logger.warning("No worker agents initialized.")

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
                        logger.info(f"Agent {agent_id} api_caller received input_text: '{input_text}' (Unicode: {unicodedata.name(input_text[-1]) if input_text else 'Empty'})")
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
                            schema_analysis = self.analyze_schema(schema)
                            logger.debug(f"Agent {agent_id} generating payload with input: '{input_text}'")
                            payload = self.generate_payload(input_text, schema, schema_analysis, agent_id)
                            if payload is None:
                                logger.error(f"Failed to generate payload for agent {agent_id} with input: '{input_text}'")
                                return {"error": f"Failed to generate payload for input: '{input_text}'"}
                            if "error" in payload:
                                logger.warning(f"Ambiguous input for agent {agent_id}: {payload['error']}")
                                return payload  # Return error message to user

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

    def analyze_schema(self, schema: Dict) -> str:
        """Analyzes an OpenAPI schema to extract key requirements."""
        try:
            schema_str = json.dumps(schema, indent=2, ensure_ascii=False)
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
            result = crew.kickoff()
            analysis = str(result).strip()
            if analysis.startswith('```') or analysis == '{}':
                logger.warning("Invalid schema analysis format, falling back to manual extraction.")
                return self._manual_schema_analysis(schema)
            logger.info(f"Schema analysis: {analysis}")
            return analysis
        except Exception as e:
            logger.error(f"Error analyzing schema: {e}")
            return self._manual_schema_analysis(schema)

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
        """Generates a valid JSON payload by extracting all contextual clues."""
        try:
            logger.info(f"Agent {agent_id} generating payload with input: '{user_input}' (Unicode: {unicodedata.name(user_input[-1]) if user_input else 'Empty'})")
            paths = schema.get("paths", {})
            if not paths:
                logger.warning(f"No paths found in schema for agent {agent_id}.")
                return None

            first_path = next(iter(paths))
            request_schema = (
                schema.get("paths", {})
                .get(first_path, {})
                .get("post", {})
                .get("requestBody", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema", {})
            )
            properties = request_schema.get("properties", {})
            required = request_schema.get("required", [])

            task_description = (
                f"Input: '{user_input}'\n"
                f"Schema Analysis: {schema_analysis}\n"
                f"Request Schema: {json.dumps(request_schema, indent=2, ensure_ascii=False)}\n"
                "Generate a valid JSON payload by extracting ALL contextual clues from the input. Follow these rules strictly:\n"
                "- Handle ambiguity FIRST:\n"
                "  - For 'hour' fields (integer, 0-23), if the input is a bare number (e.g., '8', '10') or vague time (e.g., '8 O'clock') without a clear time period (e.g., 'morning', 'evening', 'AM', 'PM', 'night'), return {{'error': 'Please clarify the time period for \"{user_input}\"'}}.\n"
                "  - If input lacks data for required fields, return {{'error': 'Input does not match required fields: {required}'}}.\n"
                "- Map clues to schema fields ONLY after confirming no ambiguity:\n"
                "  - Numbers: Extract for 'hour' (with time period), 'age', 'quantity', etc.\n"
                "  - Time periods: Convert 'evening', 'PM', 'night' to 24-hour (e.g., 'evening 8' → 20; '8 PM' → 20; 'sunset' → 19).\n"
                "  - Days: Identify 'Monday', 'Christmas' for 'day' or 'date' (e.g., 'Christmas' → '2025-12-25').\n"
                "  - Events: Capture 'birthday', 'meeting', 'sunset' for 'event' or 'context'.\n"
                "  - Strings: Use full text for 'text' fields, preserving emojis (e.g., 😊, 🌙).\n"
                "- Respect constraints (e.g., min/max, enums).\n"
                "- Preserve emojis in all string fields.\n"
                "Examples:\n"
                "- Input: '8', Schema: {{'hour': integer}} → '{\"error\": \"Please clarify the time period for \\\"8\\\"\"}'\n"
                "- Input: '8 O'clock', Schema: {{'hour': integer}} → '{\"error\": \"Please clarify the time period for \\\"8 O'clock\\\"\"}'\n"
                "- Input: 'time is evening 8 O'clock.', Schema: {{'hour': integer}} → '{\"hour\": 20}'\n"
                "- Input: 'grandma’s 80th birthday', Schema: {{'age': integer, 'event': string}} → '{\"age\": 80, \"event\": \"birthday\"}'\n"
                "- Input: 'Monday meeting 😊', Schema: {{'day': string}} → '{\"day\": \"Monday\"}'\n"
                "- Input: 'sunset view at 7 😊', Schema: {{'hour': integer}} → '{\"hour\": 19}'\n"
                "- Input: 'Hello! 😊', Schema: {{'text': string, 'target_lang': string}} → '{\"text\": \"Hello! 😊\", \"target_lang\": \"es\"}'\n"
                "Return a JSON string."
            )

            task = Task(
                description=task_description,
                expected_output="A valid JSON string payload or error message.",
                agent=self.payload_agent
            )
            crew = Crew(agents=[self.payload_agent], tasks=[task], process=Process.sequential)
            result = crew.kickoff()

            payload_str = str(getattr(result, 'raw', result)).strip('`').strip('json').strip()
            logger.info(f"Agent {agent_id} generated payload string: '{payload_str}'")

            if not payload_str:
                logger.warning(f"Empty payload generated for agent {agent_id}")
                return self._fallback_payload(user_input, request_schema, schema_analysis, agent_id)

            try:
                payload = json.loads(payload_str)
                if "error" in payload:
                    logger.warning(f"Payload contains error for agent {agent_id}: {payload['error']}")
                    return payload
                if required and not all(key in payload for key in required):
                    error_msg = f"Input does not match required fields: {required}"
                    logger.warning(f"Payload missing required fields for agent {agent_id}: {payload}")
                    return {"error": error_msg}
                logger.info(f"Agent {agent_id} generated payload: {json.dumps(payload, ensure_ascii=False)}")
                return payload
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON payload for agent {agent_id}: '{payload_str}', error: {e}")
                return self._fallback_payload(user_input, request_schema, schema_analysis, agent_id)

        except Exception as e:
            logger.error(f"Error generating payload for agent {agent_id}: {e}")
            return self._fallback_payload(user_input, request_schema, schema_analysis, agent_id)

    def _fallback_payload(self, user_input: str, request_schema: Dict, schema_analysis: str, agent_id: str) -> Optional[Dict]:
        """Generates a fallback payload with contextual clues."""
        try:
            properties = request_schema.get("properties", {})
            required = request_schema.get("required", [])
            payload = {}
            input_lower = user_input.lower()

            # Time period mappings
            time_periods = {
                "evening": 12,  # Add 12 hours (6 PM–11 PM)
                "night": 12,    # Add 12 hours (7 PM–midnight)
                "pm": 12,       # Add 12 hours
                "morning": 0,    # 12 AM–11 AM
                "am": 0,        # 12 AM–11 AM
                "afternoon": 6,  # 12 PM–5 PM
                "sunset": 12     # Assume evening (7 PM)
            }
            days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            events = ["birthday", "meeting", "sunset", "christmas", "wedding"]

            for key, prop in properties.items():
                if key in required:
                    prop_type = prop.get("type", "string")
                    constraints = {
                        "minimum": prop.get("minimum"),
                        "maximum": prop.get("maximum"),
                        "enum": prop.get("enum")
                    }

                    if prop_type == "integer":
                        numbers = [int(n) for n in re.findall(r'\d+', user_input) if n]
                        if numbers:
                            value = numbers[0]
                            if key == "hour":
                                # Check for time period
                                time_clue = None
                                for period in time_periods:
                                    if period in input_lower:
                                        time_clue = period
                                        value = (value % 12) + time_periods[period] if value <= 12 else value
                                        break
                                if time_clue is None:
                                    error_msg = f"Please clarify the time period for \"{user_input}\""
                                    logger.warning(f"Ambiguous time input for agent {agent_id}: {user_input}")
                                    return {"error": error_msg}
                            if constraints["minimum"] is not None and value < constraints["minimum"]:
                                value = constraints["minimum"]
                            if constraints["maximum"] is not None and value > constraints["maximum"]:
                                value = constraints["maximum"]
                            payload[key] = value
                        else:
                            error_msg = f"No number found for required field '{key}' in input: {user_input}"
                            logger.warning(error_msg)
                            return {"error": error_msg}

                    elif prop_type == "string":
                        if key == "target_lang" and "translation" in schema_analysis.lower():
                            payload[key] = constraints["enum"][0] if constraints["enum"] else "es"
                        elif key == "day":
                            for day in days:
                                if day in input_lower:
                                    payload[key] = day.capitalize()
                                    break
                            else:
                                error_msg = f"No day found for required field 'day' in input: {user_input}"
                                logger.warning(error_msg)
                                return {"error": error_msg}
                        elif key == "event" or key == "context":
                            for event in events:
                                if event in input_lower:
                                    payload[key] = event
                                    break
                            else:
                                payload[key] = user_input
                        else:
                            payload[key] = user_input

                    elif prop_type == "enum" and constraints["enum"]:
                        payload[key] = constraints["enum"][0]

                    else:
                        error_msg = f"Unsupported required field type {prop_type} for {key} in input: {user_input}"
                        logger.warning(error_msg)
                        return {"error": error_msg}

            if required and not all(key in payload for key in required):
                error_msg = f"Input does not match required fields: {required}"
                logger.warning(f"Fallback payload missing required fields for agent {agent_id}: {error_msg}")
                return {"error": error_msg}

            logger.info(f"Agent {agent_id} generated fallback payload: {json.dumps(payload, ensure_ascii=False)}")
            return payload if payload else None
        except Exception as e:
            logger.error(f"Error in fallback payload for agent {agent_id}: {e}")
            return {"error": f"Failed to process input: {str(e)}"}

    def clean_output(self, output: str) -> str:
        """Cleans output using LLM to remove UUIDs and metadata, preserving emojis."""
        if not output:
            return ""

        try:
            task_description = (
                f"Input: '{output}'\n"
                "Clean the input by removing:\n"
                "- UUIDs (e.g., [123e4567-e89b-12d3-a456-426614174000] or 123e4567-e89b-12d3-a456-426614174000).\n"
                "- Metadata phrases like 'output from', 'task result' (case-insensitive).\n"
                "- Extra brackets or whitespace.\n"
                "Rules:\n"
                "- Preserve all content, including emojis (e.g., 😊, 🌙).\n"
                "- Return only the cleaned text.\n"
                "Examples:\n"
                "- Input: '[123e4567-e89b-12d3-a456-426614174000] Hello! 😊' → 'Hello! 😊'\n"
                "- Input: 'output from agent: Hola 🌙' → 'Hola 🌙'\n"
                "- Input: '[task result] 6 pm' → '6 pm'\n"
                "Return plain text."
            )

            task = Task(
                description=task_description,
                expected_output="Cleaned output text with UUIDs and metadata removed.",
                agent=self.clean_output_agent
            )
            crew = Crew(agents=[self.clean_output_agent], tasks=[task], process=Process.sequential)
            result = crew.kickoff()

            cleaned_output = str(getattr(result, 'raw', result)).strip('`').strip()
            logger.info(f"Cleaned output: '{cleaned_output}' (Unicode: {unicodedata.name(cleaned_output[-1]) if cleaned_output else 'Empty'})")
            return cleaned_output if cleaned_output else output.strip()

        except Exception as e:
            logger.error(f"Error cleaning output: {e}")
            # Fallback: minimal cleaning without regex
            metadata_phrases = ["output from", "task result"]
            cleaned = output
            for phrase in metadata_phrases:
                cleaned = cleaned.replace(phrase, "").replace(phrase.title(), "").replace(phrase.upper(), "")
            cleaned = cleaned.strip().strip('[]').strip()
            logger.warning(f"Fallback cleaning applied: '{cleaned}'")
            return cleaned

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
            text = ""
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
            return text.strip() or "No readable text found"
        except Exception as e:
            return f"Error reading PDF: {e}"

    def execute_task(self, user_input: str, file_path: Optional[str] = None) -> str:
        """Executes multi-agent orchestration using a single hierarchical crew."""
        try:
            if not self.worker_agents:
                logger.error("No worker agents available.")
                return "Error: No worker agents available."

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
            manager_context = self.multi_agent_config.get("description", "Coordinate tasks based on user input.")
            manager_description = (
                f"{manager_context}\n\n"
                f"Original User Input: '{user_input}'\n"
            )
            if file_content:
                manager_description += f"File Content: {file_content}\n"
            logger.info(f"Manager description: {manager_description}")

            # 3. Prepare worker metadata
            worker_metadata = [
                {
                    "id": config["id"],
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
            logger.info(f"Worker metadata prepared: {json.dumps([w['id'] for w in worker_metadata], indent=2)}")

            # 4. Create Manager Task
            manager_task = Task(
                description=(
                    f"{manager_description}\n"
                    f"Worker Agents Available:\n{json.dumps(worker_metadata, indent=2, ensure_ascii=False)}\n\n"
                    "Orchestrate tasks with these instructions:\n"
                    "1. Analyze the user input and file content (if any).\n"
                    "2. Delegate tasks to worker agents based on their roles, goals, and tools.\n"
                    "3. For the agent with ID 'agent_1', process the original user input to generate an output (e.g., a greeting).\n"
                    "4. Pass the cleaned output of 'agent_1' as the input to the agent with ID 'translator'.\n"
                    "5. Ensure tasks are executed sequentially: 'agent_1' completes before 'translator' starts.\n"
                    "6. Combine worker outputs, using the translator's output as the final result.\n"
                    "7. Preserve all content, including emojis (e.g., 😊, 🌙).\n"
                    "8. If input is ambiguous (e.g., '8' for an hour field), ensure 'agent_1' returns an error like 'Please clarify the time period', and skip translation.\n"
                    "Return the final output as a single string."
                ),
                expected_output="Final translated output with all characters preserved, or an error message if applicable.",
                agent=self.manager_agent
            )

            # 5. Create Worker Tasks
            worker_tasks = []
            for config in self.worker_agent_configs:
                agent_id = config["id"]
                default_instructions = f"Perform your role: {config['role']}"
                
                if agent_id == "agent_1":
                    # First agent processes user input
                    task_description = (
                        f"{config.get('instructions', default_instructions)}\n\n"
                        f"User Input: '{user_input}'\n"
                    )
                    if file_content:
                        task_description += f"File Content: {file_content}\n"
                    task_description += (
                        "Instructions:\n"
                        "- Process the full user input, preserving emojis and context.\n"
                        "- Use your tools to generate appropriate outputs (e.g., API payloads or greetings).\n"
                        "- For ambiguous inputs (e.g., '8' for an hour field), return an error like 'Please clarify the time period'.\n"
                        "- Return a clear result based on your role and tools."
                    )
                elif agent_id == "translator":
                    # Translator task uses placeholder; manager will provide first agent's output
                    task_description = (
                        f"{config.get('instructions', default_instructions)}\n\n"
                        f"Input: [Output from agent_1 will be provided by the manager]\n"
                    )
                    if file_content:
                        task_description += f"File Content: {file_content}\n"
                    task_description += (
                        "Instructions:\n"
                        "- Translate the input provided by the manager (from agent_1's output).\n"
                        "- Use your tools to perform the translation (e.g., to Spanish).\n"
                        "- Preserve all content, including emojis (e.g., 😊, 🌙).\n"
                        "- Return the translated text."
                    )
                else:
                    # Other agents (if any) use user input
                    task_description = (
                        f"{config.get('instructions', default_instructions)}\n\n"
                        f"User Input: '{user_input}'\n"
                    )
                    if file_content:
                        task_description += f"File Content: {file_content}\n"
                    task_description += (
                        "Instructions:\n"
                        "- Process the full user input, preserving emojis and context.\n"
                        "- Use your tools to generate appropriate outputs.\n"
                        "- Return a clear result based on your role and tools."
                    )

                logger.info(f"Task description for agent {agent_id}: '{task_description}'")

                task = Task(
                    description=task_description,
                    expected_output=config.get("expectedOutput", "A contribution to the goal."),
                    agent=self.worker_map[agent_id]["agent"]
                )
                worker_tasks.append(task)

                # crew = Crew(
                #     agents=[self.worker_map[agent_id]["agent"]],
                #     tasks=[task],
                #     process=Process.sequential,
                #     verbose=True
                # )
                # task_result = crew.kickoff()
                # raw_output = str(getattr(task_result, 'raw', task_result)).strip()
                # previous_output = self.clean_output(raw_output)

            # 6. Run Hierarchical Crew
            logger.info("Starting hierarchical crew execution")
            crew = Crew(
                agents=self.worker_agents,
                tasks=[manager_task] + worker_tasks,
                process=Process.hierarchical,
                manager_agent=self.manager_agent,
                verbose=True
            )

            result = crew.kickoff()

            # result = previous_output
            logger.info("Crew execution completed")

            # 7. Extract and Clean Result
            raw_result = str(getattr(result, 'raw', result)).strip()
            final_result = self.clean_output(raw_result)
            logger.info(f"Final cleaned output: '{final_result}' (Unicode: {unicodedata.name(final_result[-1]) if final_result else 'Empty'})")
            if not final_result:
                logger.warning("Empty result after cleaning")
                return "No output generated."
            return final_result

        except Exception as e:
            logger.error(f"Error during execution: {e}", exc_info=True)
            return f"An error occurred: {str(e)}"