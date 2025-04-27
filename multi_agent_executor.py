import os
import requests
import random
import json
import re
import uuid
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from functools import partial
from datetime import datetime

load_dotenv()

# Disable CrewAI telemetry
os.environ["CREWAI_TELEMETRY_ENABLED"] = "false"
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logger.info("CrewAI telemetry disabled")

class MultiAgentExecutor:
    """
    Orchestrates multiple agents with a manager agent that delegates tasks dynamically.
    Handles user input, preserves context, and ensures robust error handling with logging.
    """
    def __init__(
        self,
        multi_agent_config: Dict[str, Any],
        worker_agent_configs: List[Dict[str, Any]],
        execution_id: Optional[str] = None,
        log_url: Optional[str] = None
    ):
        self.multi_agent_config = multi_agent_config
        self.worker_agent_configs = worker_agent_configs
        self.execution_id = execution_id or str(uuid.uuid4())
        self.log_url = log_url
        self._validate_configs()

        # Initialize LLM client
        self.llm_client = LLM(
            model="gemini/gemini-2.5-flash-preview-04-17",
            api_key=self._get_api_key(),
            max_retries=3,
            retry_delay=34
        )

        # Initialize Internal LLM client for schema and payload agents
        self.internal_llm_client = LLM(
            model="gemini/gemini-2.0-flash",
            api_key=os.getenv("INTERNAL_GEMINI_API_KEY")
        )

        # Initialize Schema Agent
        self.schema_agent = CrewAgent(
            role="Schema Analyzer",
            goal="Analyze OpenAPI schemas and extract key information",
            backstory="I'm an expert at analyzing OpenAPI schemas and extracting key information.",
            verbose=False,
            allow_delegation=False,
            llm=self.internal_llm_client
        )

        self.payload_agent = CrewAgent(
            role="Payload Generator",
            goal="Generate accurate payloads and endpoint URLs for API tools",
            backstory="I'm an expert at creating valid API payloads and determining endpoint URLs.",
            verbose=False,
            allow_delegation=False,
            llm=self.internal_llm_client
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
        logger.info(f"Initialized Manager Agent: {self.manager_agent.role} (Execution ID: {self.execution_id})")

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
            logger.info(f"Initialized Worker Agent: {agent.role} (ID: {config['id']}, Name: {config['name']}, Execution ID: {self.execution_id})")

        if not self.worker_agents:
            logger.warning("No worker agents initialized.")

    def _validate_configs(self):
        """Validates configurations."""
        required_manager_fields = ["role", "goal", "backstory", "description", "expected_output", "agent_ids"]
        required_worker_fields = ["id", "role", "goal", "backstory", "instructions", "expectedOutput"]

        for field in required_manager_fields:
            if field not in self.multi_agent_config:
                logger.warning(f"Missing manager config field: {field}. Using default (Execution ID: {self.execution_id}).")
                self.multi_agent_config[field] = (
                    f"Default {field}" if field != "expected_output"
                    else "Formatted output containing each agent's result."
                    if field != "agent_ids" else []
                )

        for config in self.worker_agent_configs:
            for field in required_worker_fields:
                if field not in config:
                    logger.warning(f"Missing worker config field: {field} for agent {config.get('id', 'unknown')}. Using default (Execution ID: {self.execution_id}).")
                    config[field] = f"Default {field}"
            if "name" not in config:
                config["name"] = config["role"]
                logger.warning(f"Missing name for agent {config['id']}, using role: {config['name']} (Execution ID: {self.execution_id}).")

    def _get_api_key(self) -> str:
        """Selects a random API key."""
        keys = os.getenv("GEMINI_API_KEYS", "").split(",")
        key_list = [key.strip() for key in keys if key.strip()]
        if not key_list:
            raise ValueError("No API keys found in GEMINI_API_KEYS.")
        return random.choice(key_list)

    def _sanitize_for_logging(self, text: Any) -> str:
        """Sanitizes strings for logging, preserving emojis and handling non-UTF-8 bytes."""
        try:
            text_str = str(text)
            return text_str.encode("utf-8", errors="replace").decode("utf-8")
        except Exception:
            return str(text).encode("utf-8", errors="replace").decode("utf-8")

    def _parse_time(self, user_input: str) -> Optional[int]:
        """Parses natural language time inputs into 24-hour format."""
        try:
            user_input_lower = user_input.lower().strip()
            time_patterns = {
                r"(\d{1,2})\s*(am|pm)": lambda match: int(match.group(1)) % 12 + (12 if match.group(2) == "pm" else 0),
                r"(\d{1,2}):(\d{2})\s*(am|pm)": lambda match: int(match.group(1)) % 12 + (12 if match.group(3) == "pm" else 0),
                r"(\d{1,2})\s*(o'?clock)": lambda match: int(match.group(1)) % 24,
                r"morning\s*(\d{1,2})": lambda match: int(match.group(1)) % 12,
                r"afternoon\s*(\d{1,2})": lambda match: (int(match.group(1)) % 12) + 12,
                r"evening\s*(\d{1,2})": lambda match: (int(match.group(1)) % 12) + 12,
                r"night\s*(\d{1,2})": lambda match: (int(match.group(1)) % 12) + 12 if int(match.group(1)) < 6 else int(match.group(1)),
                r"(\d{1,2}):(\d{2})": lambda match: int(match.group(1)) % 24
            }

            for pattern, handler in time_patterns.items():
                match = re.search(pattern, user_input_lower)
                if match:
                    hour = handler(match)
                    if 0 <= hour <= 23:
                        logger.debug(f"Parsed time '{user_input_lower}' to hour {hour} (Execution ID: {self.execution_id})")
                        return hour

            logger.warning(f"Could not parse time from '{user_input_lower}', using current hour (Execution ID: {self.execution_id})")
            return datetime.now().hour
        except Exception as e:
            logger.error(f"Error parsing time '{user_input_lower}': {self._sanitize_for_logging(e)} (Execution ID: {self.execution_id})")
            return datetime.now().hour

    def generate_payload(self, user_input: str, schema: dict, tool_data_connector: Optional[dict] = None) -> Dict[str, Any]:
        """Generates a valid JSON payload and endpoint URL based on user input, schema, and data connector."""
        logger.info(f"Generating payload and endpoint URL for input: '{self._sanitize_for_logging(user_input)}' (Execution ID: {self.execution_id})")
        paths = schema.get("paths", {})
        if not paths:
            logger.error(f"No paths found in schema (Execution ID: {self.execution_id})")
            return {"error": "No paths in schema"}

        path_key = next(iter(paths))
        method = next((m for m in paths[path_key] if m.lower() in ["get", "post"]), "post")
        
        # Determine request schema based on method
        request_schema = {}
        required_fields = []
        properties = {}
        if method == "get":
            parameters = paths[path_key].get(method, {}).get("parameters", [])
            if parameters:
                request_schema = {"parameters": parameters}
                required_fields = [param["name"] for param in parameters if param.get("required", False)]
                properties = {param["name"]: param.get("schema", {}) for param in parameters}
        else:  # method == "post"
            request_body = paths[path_key].get(method, {}).get("requestBody", {})
            if request_body:
                request_schema = request_body.get("content", {}).get("application/json", {}).get("schema", {})
                required_fields = request_schema.get("required", [])
                properties = request_schema.get("properties", {})

        connector_info = f"Tool Data Connector:\n{json.dumps(tool_data_connector, indent=2, ensure_ascii=False)}\n" if tool_data_connector else ""
        
        # Parse time if required by schema
        time_field = None
        for prop, details in properties.items():
            if details.get("type") == "integer" and "hour" in prop.lower():
                time_field = prop
                break

        default_payload = {}
        if time_field and user_input:
            parsed_hour = self._parse_time(user_input)
            default_payload[time_field] = parsed_hour
            logger.info(f"Set {time_field} to {parsed_hour} based on user input (Execution ID: {self.execution_id})")

        # Generate payload and endpoint URL
        payload_task = Task(
            description=f"""
                User Input: '{self._sanitize_for_logging(user_input)}'
                Request Schema: {json.dumps(request_schema, indent=2, ensure_ascii=False)}
                Full Schema: {json.dumps(schema, indent=2, ensure_ascii=False)}
                {connector_info}
                Generate a valid JSON payload (if required) and the endpoint URL for the API call.
                For GET requests, return a dictionary of query parameters if parameters are defined in the schema, otherwise return null.
                For POST requests, generate a JSON payload if a requestBody is defined in the schema, otherwise return null.
                Return a JSON object with two keys:
                - "payload": The JSON payload or query parameters (or null if not applicable, required fields: {required_fields}).
                - "endpoint_url": The full URL for the API endpoint, using the appropriate server URL from the schema's "servers" field and the correct path from the "paths" field.
                For the payload:
                - Extract relevant information from the user input.
                - For required fields without user input, use sensible defaults or null.
                - If a time-related field (e.g., {time_field}) is required, use the parsed time {default_payload.get(time_field, 'N/A')} (24-hour format, 0-23).
                - Validate against schema constraints (e.g., min/max, patterns).
                - Ensure compatibility with the tool_data_connector if provided.
                Ensure the endpoint_url is valid and corresponds to the {method.upper()} endpoint in the schema.
                Log any validation errors or default substitutions.
                If no valid URL can be determined, return {{"payload": {json.dumps(default_payload)}, "endpoint_url": ""}}.
            """,
            expected_output="JSON object with 'payload' and 'endpoint_url'",
            agent=self.payload_agent
        )
        crew = Crew(agents=[self.payload_agent], tasks=[payload_task], process=Process.sequential)
        result = crew.kickoff()
        try:
            result_str = str(result.raw if hasattr(result, 'raw') else result).strip('`').strip('json').strip()
            result_json = json.loads(result_str)
            payload = result_json.get("payload")
            endpoint_url = result_json.get("endpoint_url")
            
            if not endpoint_url:
                logger.error(f"Missing endpoint_url in agent response (Execution ID: {self.execution_id})")
                return {"error": "Missing endpoint_url in agent response"}
            
            # Validate required fields if payload exists
            if payload:
                missing_fields = [f for f in required_fields if f not in payload or payload[f] is None]
                if missing_fields:
                    logger.warning(f"Missing required fields {missing_fields}, using defaults (Execution ID: {self.execution_id})")
                    for field in missing_fields:
                        payload[field] = None

            logger.info(f"Generated payload: {self._sanitize_for_logging(json.dumps(payload, ensure_ascii=False) if payload else 'null')} (Execution ID: {self.execution_id})")
            logger.info(f"Generated endpoint URL: {self._sanitize_for_logging(endpoint_url)} (Execution ID: {self.execution_id})")
            return {"payload": payload, "endpoint_url": endpoint_url}
        except (json.JSONDecodeError, AttributeError) as e:
            logger.error(f"Error parsing payload or endpoint_url: {self._sanitize_for_logging(e)} (Execution ID: {self.execution_id})")
            return {"error": f"Error parsing payload or endpoint_url: {self._sanitize_for_logging(e)}"}

    def _load_agent_tools(self, agent_config: Dict[str, Any]) -> List:
        """Loads tools for an agent."""
        from langchain.tools import Tool
        tools = []
        tools_config = agent_config.get("tools", [])
        agent_id = agent_config.get("id", "unknown")

        for tool_config in tools_config:
            if not isinstance(tool_config, dict) or "schema" not in tool_config:
                logger.warning(f"Skipping invalid tool config for agent {agent_id}: {tool_config} (Execution ID: {self.execution_id})")
                continue

            tool_schema = tool_config.get("schema")
            if not isinstance(tool_schema, dict) or "info" not in tool_schema or "paths" not in tool_schema:
                logger.warning(f"Skipping invalid schema for tool {tool_config.get('id')} in agent {agent_id} (Execution ID: {self.execution_id})")
                continue

            tool_headers = tool_config.get("auth", {}).get("headers", {}) or {}
            tool_params = tool_config.get("auth", {}).get("params", {}) or {}
            tool_data_connector = tool_config.get("data_connector", None)

            def create_api_caller(schema: Dict, headers: Dict, params: Dict, agent_id: str, tool_data_connector: Optional[dict] = None):
                def api_caller(input_text: str, **kwargs) -> Dict:
                    try:
                        logger.info(f"Agent {agent_id} api_caller received input_text: '{self._sanitize_for_logging(input_text)}' (Execution ID: {self.execution_id})")
                        if not input_text or "{{input}}" in input_text:
                            logger.error(f"Invalid input for API call by agent {agent_id}: '{self._sanitize_for_logging(input_text)}' (Execution ID: {self.execution_id})")
                            return {"error": f"Invalid input: '{input_text}'"}

                        result = self.generate_payload(input_text, schema, tool_data_connector)
                        if not result or "error" in result:
                            logger.error(f"Failed to generate payload or endpoint URL for agent {agent_id}: {self._sanitize_for_logging(result.get('error', 'Unknown error'))} (Execution ID: {self.execution_id})")
                            return {"error": result.get("error", "Failed to generate payload or endpoint URL")}

                        payload = result.get("payload")
                        endpoint_url = result.get("endpoint_url")
                        if not endpoint_url:
                            logger.error(f"Missing endpoint URL for agent {agent_id} (Execution ID: {self.execution_id})")
                            return {"error": "Missing endpoint URL"}

                        # Determine HTTP method from schema
                        paths = schema.get("paths", {})
                        if not paths:
                            logger.error(f"No paths found in schema for agent {agent_id} (Execution ID: {self.execution_id})")
                            return {"error": "No paths found in schema"}

                        path_key = next(iter(paths))
                        method = None
                        for m in paths[path_key]:
                            if m.lower() in ["get", "post"]:
                                method = m.lower()
                                break
                        if not method:
                            logger.error(f"No supported HTTP method (GET/POST) found in schema for agent {agent_id} (Execution ID: {self.execution_id})")
                            return {"error": "No supported HTTP method (GET/POST) found in schema"}

                        # Ensure headers and params are dictionaries
                        request_headers = headers or {}
                        request_params = params or {}

                        if method == "get":
                            # For GET, payload contains query parameters (if any)
                            if payload:
                                request_params.update(payload)
                            logger.info(f"Agent {agent_id} calling GET {endpoint_url} with params: {self._sanitize_for_logging(json.dumps(request_params, ensure_ascii=False) if request_params else 'none')} (Execution ID: {self.execution_id})")
                            response = requests.get(
                                endpoint_url,
                                headers=request_headers,
                                params=request_params if request_params else None
                            )
                        else:  # method == "post"
                            logger.info(f"Agent {agent_id} calling POST {endpoint_url} with payload: {self._sanitize_for_logging(json.dumps(payload, ensure_ascii=False) if payload else 'none')} (Execution ID: {self.execution_id})")
                            response = requests.post(
                                endpoint_url,
                                headers=request_headers,
                                params=request_params if request_params else None,
                                json=payload if payload else None
                            )

                        if 200 <= response.status_code < 300:
                            try:
                                result = response.json()
                                logger.info(f"Agent {agent_id} API response: {self._sanitize_for_logging(json.dumps(result, ensure_ascii=False))} (Execution ID: {self.execution_id})")
                                return result
                            except json.JSONDecodeError:
                                result = {"success": True, "content": response.text}
                                logger.info(f"Agent {agent_id} API non-JSON response: {self._sanitize_for_logging(result)} (Execution ID: {self.execution_id})")
                                return result
                        else:
                            error_content = response.json().get('detail', response.text) if response.text else response.text
                            logger.error(f"API call failed for agent {agent_id} ({response.status_code}): {self._sanitize_for_logging(error_content)} (Execution ID: {self.execution_id})")
                            return {"error": f"API call failed ({response.status_code}): {error_content}"}
                    except Exception as e:
                        logger.error(f"Error in API call for agent {agent_id}: {self._sanitize_for_logging(e)} (Execution ID: {self.execution_id})")
                        return {"error": f"API call error: {str(e)}"}
                return api_caller

            tool_name = tool_schema.get("info", {}).get("title", f"tool_{tool_config.get('id')}")
            tool_name = tool_name.lower().replace(" ", "_")
            api_caller_instance = partial(
                create_api_caller(tool_schema, tool_headers, tool_params, agent_id, tool_data_connector),
                headers=tool_headers,
                params=tool_params
            )

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
            logger.info(f"Loaded tool {tool_name} for agent {agent_id} (Execution ID: {self.execution_id})")

        return tools

    def clean_output(self, output: str) -> str:
        """Cleans output by removing UUIDs and specific metadata, preserving content and formatting."""
        if not output:
            logger.info(f"Empty output received for cleaning (Execution ID: {self.execution_id})")
            return ""

        try:
            # Remove UUIDs
            cleaned = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '', output)
            # Remove specific metadata phrases, preserving formatting
            metadata_phrases = ["output from", "task result", "agent output"]
            for phrase in metadata_phrases:
                cleaned = cleaned.replace(phrase, "").replace(phrase.title(), "").replace(phrase.upper(), "")
            # Remove excessive whitespace while preserving newlines
            cleaned = re.sub(r'\s*\n\s*\n\s*', '\n\n', cleaned.strip())
            if not cleaned.strip():
                logger.warning(f"Cleaned output is empty (Execution ID: {self.execution_id})")
                return ""
            logger.info(f"Cleaned output: '{self._sanitize_for_logging(cleaned[:100])}{'...' if len(cleaned) > 100 else ''}' (Execution ID: {self.execution_id})")
            return cleaned
        except Exception as e:
            logger.error(f"Error cleaning output: {self._sanitize_for_logging(e)} (Execution ID: {self.execution_id})")
            return output

    def execute_task(self, user_input: str, file_path: Optional[str] = None) -> str:
        """Executes multi-agent orchestration with manager delegating tasks in sequence."""
        try:
            if len(self.worker_agents) < 2:
                logger.error(f"At least two worker agents are required (Execution ID: {self.execution_id})")
                return "Error: At least two worker agents are required."

            logger.info(f"Starting task execution with user_input: '{self._sanitize_for_logging(user_input)}' (Execution ID: {self.execution_id})")
            if self.log_url:
                logger.debug(f"Log URL: {self.log_url} (Execution ID: {self.execution_id})")

            # Prepare file content (if any)
            file_content = ""
            if file_path:
                logger.warning(f"File handling not implemented in this version: {self._sanitize_for_logging(file_path)} (Execution ID: {self.execution_id})")
                file_content = "[File handling placeholder]"

            # Prepare worker metadata
            worker_metadata = [
                {
                    "id": config["id"],
                    "name": config["name"],
                    "role": config["role"],
                    "instructions": config["instructions"],
                    "expectedOutput": config["expectedOutput"]
                }
                for config in self.worker_agent_configs
            ]
            logger.info(f"Worker metadata prepared: {self._sanitize_for_logging(json.dumps([{'id': w['id'], 'name': w['name']} for w in worker_metadata], indent=2))} (Execution ID: {self.execution_id})")

            # Use agent_ids from multi_agent_config
            agent_ids = self.multi_agent_config.get("agent_ids", [])
            if not agent_ids:
                logger.error(f"No agent IDs specified in multi_agent_config (Execution ID: {self.execution_id})")
                return "Error: No agent IDs specified in multi_agent_config"

            # Validate agent IDs
            available_agent_ids = [w["id"] for w in worker_metadata]
            missing_agents = [aid for aid in agent_ids if aid not in available_agent_ids]
            if missing_agents:
                logger.error(f"Missing required agents with IDs: {missing_agents} (Execution ID: {self.execution_id})")
                return f"Error: Missing required agents with IDs: {', '.join(missing_agents)}"

            # Order agents based on agent_ids
            agent_sequence = []
            for aid in agent_ids:
                for meta in worker_metadata:
                    if meta["id"] == aid and meta not in agent_sequence:
                        agent_sequence.append(meta)
                        break

            if len(agent_sequence) < 2:
                logger.error(f"Insufficient valid agents in sequence: {len(agent_sequence)} (Execution ID: {self.execution_id})")
                return "Error: At least two valid agents are required."

            # Construct manager task description
            instructions = [f"Original User Input: '{self._sanitize_for_logging(user_input)}'"]
            if file_content:
                instructions.append(f"File Content: {file_content}")

            instructions.append("\nFollow these steps exactly:")
            for i, agent in enumerate(agent_sequence):
                if i == 0:
                    instructions.append(
                        f"{i+1}. Delegate to '{agent['name']}' to process the user input.\n"
                        f"   - Role: {agent['role']}\n"
                        f"   - Instructions: {agent['instructions']}\n"
                        f"   - Expected output: {agent['expectedOutput']}"
                    )
                else:
                    instructions.append(
                        f"{i+1}. Pass the output from '{agent_sequence[i-1]['name']}' to '{agent['name']}'.\n"
                        f"   - Role: {agent['role']}\n"
                        f"   - Instructions: {agent['instructions']}\n"
                        f"   - Expected output: {agent['expectedOutput']}"
                    )
            instructions.append(
                f"{len(agent_sequence)+1}. Collect the output from each agent and format the final result as follows:\n"
                f"{'-' * 40}\n" +
                "\n".join([f"{agent['name']} Output: <output from {agent['name']}>" for agent in agent_sequence]) + "\n" +
                f"{'-' * 40}\n"
                "Do not modify or rephrase any of the agent outputs. Display each exactly as received."
            )

            manager_task_description = f"{self.multi_agent_config.get('description', 'Coordinate the processing of the user request.')}\n\n" + "\n".join(instructions)

            manager_task = Task(
                description=manager_task_description,
                expected_output=self.multi_agent_config.get("expected_output"),
                agent=self.manager_agent
            )

            # Create crew with manager and workers
            crew = Crew(
                agents=[self.manager_agent] + self.worker_agents,
                tasks=[manager_task],
                process=Process.sequential,
                manager=self.manager_agent,
                verbose=True
            )

            # Execute crew
            logger.info(f"Starting crew execution (Execution ID: {self.execution_id})")
            result = crew.kickoff()
            logger.info(f"Crew execution completed (Execution ID: {self.execution_id})")

            # Clean and return result
            raw_result = str(getattr(result, 'raw', result)).strip()
            final_result = self.clean_output(raw_result)
            logger.info(f"Final cleaned output: '{self._sanitize_for_logging(final_result[:100])}{'...' if len(final_result) > 100 else ''}' (Execution ID: {self.execution_id})")
            if not final_result:
                logger.warning(f"Empty result after cleaning (Execution ID: {self.execution_id})")
                return "No output generated."
            return final_result

        except Exception as e:
            logger.error(f"Error during execution: {self._sanitize_for_logging(e)} (Execution ID: {self.execution_id})", exc_info=True)
            if "RateLimitError" in str(type(e).__name__):
                logger.warning(f"Gemini API rate limit exceeded (Execution ID: {self.execution_id})")
                return "Error: API rate limit exceeded. Please try again later."
            return f"An error occurred: {str(e)}"