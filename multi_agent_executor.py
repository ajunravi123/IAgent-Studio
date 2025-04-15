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

load_dotenv()

# Disable CrewAI telemetry
os.environ["CREWAI_TELEMETRY_ENABLED"] = "false"
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logger.info("CrewAI telemetry disabled")

class MultiAgentExecutor:
    """
    Orchestrates multiple agents with a manager agent that delegates tasks dynamically.
    Handles user input, preserves context, and ensures robust error handling.
    """
    def __init__(
        self,
        multi_agent_config: Dict[str, Any],
        worker_agent_configs: List[Dict[str, Any]]
    ):
        self.multi_agent_config = multi_agent_config
        self.worker_agent_configs = worker_agent_configs
        self._validate_configs()

        # Initialize LLM client
        self.llm_client = LLM(
            model="gemini/gemini-2.0-flash",
            api_key=self._get_api_key(),
            max_retries=3,
            retry_delay=34
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
            logger.info(f"Initialized Worker Agent: {agent.role} (ID: {config['id']}, Name: {config['name']})")

        if not self.worker_agents:
            logger.warning("No worker agents initialized.")

    def _validate_configs(self):
        """Validates configurations."""
        required_manager_fields = ["role", "goal", "backstory", "description", "expected_output"]
        required_worker_fields = ["id", "role", "goal", "backstory", "instructions", "expectedOutput"]

        for field in required_manager_fields:
            if field not in self.multi_agent_config:
                logger.warning(f"Missing manager config field: {field}. Using default.")
                self.multi_agent_config[field] = (
                    f"Default {field}" if field != "expected_output"
                    else "Formatted output containing each agent's result as specified in the description."
                )

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

    def _load_agent_tools(self, agent_config: Dict[str, Any]) -> List:
        """Loads tools for an agent."""
        from langchain.tools import Tool
        tools = []
        tools_config = agent_config.get("tools", [])
        agent_id = agent_config.get("id", "unknown")

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
                            payload = {"input": input_text}

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

    def clean_output(self, output: str) -> str:
        """Cleans output by removing only UUIDs and specific metadata, preserving content and formatting."""
        if not output:
            logger.info("Empty output received for cleaning")
            return ""

        try:
            # Remove UUIDs
            cleaned = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', '', output)
            # Remove specific metadata phrases, preserving formatting
            metadata_phrases = ["output from", "task result", "agent output"]
            for phrase in metadata_phrases:
                cleaned = cleaned.replace(phrase, "").replace(phrase.title(), "").replace(phrase.upper(), "")
            # Minimal trimming to preserve newlines and formatting
            cleaned = cleaned.strip('[]')
            if not cleaned.strip():
                logger.warning("Cleaned output is empty")
                return ""
            logger.info(f"Cleaned output: '{cleaned}'")
            return cleaned
        except Exception as e:
            logger.error(f"Error cleaning output: {e}")
            return output

    def execute_task(self, user_input: str, file_path: Optional[str] = None) -> str:
        """Executes multi-agent orchestration with manager delegating tasks in sequence."""
        try:
            if len(self.worker_agents) < 1:
                logger.error("At least one worker agent is required.")
                return "Error: At least one worker agent is required."

            # Prepare file content (if any)
            file_content = ""
            if file_path:
                logger.warning("File handling not implemented in this version.")
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
            logger.info(f"Worker metadata prepared: {json.dumps([{'id': w['id'], 'name': w['name']} for w in worker_metadata], indent=2)}")

            # Parse agent names from manager description
            manager_description = self.multi_agent_config.get(
                "description",
                "Coordinate the processing of the user request by delegating to worker agents."
            )
            # Extract quoted agent names (e.g., "Tom Agent", "Translator")
            agent_names = re.findall(r'"([^"]+)"', manager_description)
            if not agent_names:
                logger.error("No agent names found in manager description.")
                return "Error: No agent names specified in manager description."

            # Validate agent names
            available_agent_names = [w["name"] for w in worker_metadata]
            missing_agents = [name for name in agent_names if name not in available_agent_names]
            if missing_agents:
                logger.error(f"Missing required agents: {missing_agents}")
                return f"Error: Missing required agents: {', '.join(missing_agents)}"

            # Order agents based on appearance in description
            agent_sequence = []
            for name in agent_names:
                for meta in worker_metadata:
                    if meta["name"] == name and meta not in agent_sequence:
                        agent_sequence.append(meta)
                        break

            if not agent_sequence:
                logger.error("No valid agent sequence constructed.")
                return "Error: No valid agent sequence found."

            # Construct manager task description
            instructions = [f"Original User Input: '{user_input}'"]
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

            manager_task_description = f"{manager_description}\n\n" + "\n".join(instructions)

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
            logger.info("Starting crew execution")
            result = crew.kickoff()
            logger.info("Crew execution completed")

            # Clean and return result
            raw_result = str(getattr(result, 'raw', result)).strip()
            final_result = self.clean_output(raw_result)
            logger.info(f"Final cleaned output: '{final_result}'")
            if not final_result:
                logger.warning("Empty result after cleaning")
                return "No output generated."
            return final_result

        except Exception as e:
            logger.error(f"Error during execution: {e}", exc_info=True)
            if "RateLimitError" in str(type(e).__name__):
                logger.warning("Gemini API rate limit exceeded.")
                return "Error: API rate limit exceeded. Please try again later."
            return f"An error occurred: {str(e)}"