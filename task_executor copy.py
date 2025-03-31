import json
from crewai import Crew, Process, Task, Agent as CrewAgent, LLM
from langchain.tools import Tool
import os
import requests
from dotenv import load_dotenv
import json
import re
from datetime import datetime
import pytz

load_dotenv()

def generate_payload_from_schema(user_input: str, schema: dict, llm: LLM) -> dict | str:
    """
    Generates a JSON payload based on a provided OpenAPI schema and user input,
    using a CrewAI agent to intelligently fill the payload fields, with checks for missing keys.

    Args:
        user_input (str): The user's input or query.
        schema (dict): The JSON schema defining the expected payload structure.
        llm (LLM): An instance of the CrewAI LLM class.

    Returns:
        dict: A dictionary representing the generated JSON payload, or
        str: An error message if payload generation fails.
    """
    try:
        properties = schema.get("properties", {})
        required_fields = schema.get("required", [])
        payload = {}

        llm_agent = CrewAgent(
            role="Payload Generator",
            goal="Generate a valid JSON payload based on user input and schema.",
            backstory="You are an expert in understanding JSON schemas and generating data that conforms to them, while also being relevant to user requests.",
            llm=llm,
            verbose=False  # Keep agent output silent within this function
        )

        for field, prop_schema in properties.items():
            if not isinstance(prop_schema, dict):
                print(f"Warning: Property '{field}' schema is not a dictionary. Skipping.")
                continue

            description = prop_schema.get("description", f"the {field}")
            field_type = prop_schema.get("type", "string")
            enum_values = prop_schema.get("enum")

            prompt = f"User input: '{user_input}'. Field: '{field}' (type: {field_type}). Description: '{description}'. "
            if enum_values:
                prompt += f"Allowed values: {enum_values}. Please provide the best value from this list."
            else:
                prompt += "Please generate a suitable value for this field based on the user input and the field's description."

            task = Task(
                description=prompt,
                expected_output=f"A valid value for the '{field}' field, conforming to its type and constraints.",
                agent=llm_agent
            )
            crew = Crew(agents=[llm_agent], tasks=[task], process=Process.sequential)
            result = crew.kickoff()
            field_value = result.tasks_output[0].raw.strip()

            # Basic type handling and enum validation (you might need more robust checks)
            if enum_values and field_value not in enum_values:
                print(f"Warning: LLM generated '{field_value}' for field '{field}', which is not in the allowed values: {enum_values}. Skipping this field.")
            elif field_type == "integer":
                try:
                    payload[field] = int(field_value)
                except ValueError:
                    print(f"Warning: LLM generated non-integer value '{field_value}' for integer field '{field}'. Skipping.")
            elif field_type == "number":
                try:
                    payload[field] = float(field_value)
                except ValueError:
                    print(f"Warning: LLM generated non-numeric value '{field_value}' for number field '{field}'. Skipping.")
            elif field_type == "boolean":
                if field_value.lower() in ["true", "false"]:
                    payload[field] = field_value.lower() == "true"
                else:
                    print(f"Warning: LLM generated non-boolean value '{field_value}' for boolean field '{field}'. Skipping.")
            else:
                payload[field] = field_value

        # Ensure required fields are present
        for req_field in required_fields:
            if req_field not in payload:
                print(f"Warning: Required field '{req_field}' could not be generated.")

        return payload

    except Exception as e:
        return f"Error generating payload: {e}"

class TaskExecutorOld:
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
        llm = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEYS["gemini"])

        # Initialize tools and create a name-to-tool mapping
        self.tools = []
        self.tool_name_map = {}  # Map tool names to Tool instances
        if tools_config:
            for tool_config in tools_config:
                tool_schema = tool_config.get("schema", {})  # Use .get() with default empty dict
                tool_info = tool_schema.get("info", {})
                tool_title = tool_info.get("title", "Unnamed Tool")
                tool_headers = tool_config.get("auth", {}).get("headers", {})
                tool_params = tool_config.get("auth", {}).get("params", {})
                tool_name = tool_title.lower()  # Use schema title as tool name

                def create_api_caller(schema, headers, params, llm):
                    """Creates a callable API caller for a specific tool."""
                    def api_caller(input_text: str) -> str:
                        """Dynamically calls an API based on schema and input."""
                        try:
                            paths = schema.get("paths", {})
                            if not paths:
                                return "Error: No paths defined in the OpenAPI schema."
                            path = list(paths.keys())[0]
                            methods = paths.get(path, {})
                            if not methods:
                                return f"Error: No methods defined for path '{path}'."
                            method = list(methods.keys())[0].lower()

                            servers = schema.get("servers", [{}])
                            base_url = servers[0].get("url", "")
                            endpoint_url = base_url + path

                            request_body_content = methods.get(method, {}).get("requestBody", {}).get("content", {})
                            request_body_schema = request_body_content.get("application/json", {}).get("schema")

                            request_data = {}
                            if method == "post" and request_body_schema:
                                request_data = generate_payload_from_schema(input_text, request_body_schema, llm)
                                if isinstance(request_data, str):  # Check for error message
                                    return request_data
                            elif method == "post":
                                request_data = {"input": input_text}

                            response = requests.request(
                                method,
                                endpoint_url,
                                headers=headers,
                                params=params,
                                json=request_data if method == "post" else None,
                            )
                            response.raise_for_status()
                            return response.text  # Return the raw response text

                        except requests.exceptions.RequestException as e:
                            return f"API request failed: {e}"
                        except Exception as e:
                            return f"An unexpected error occurred: {e}"
                    return api_caller

                api_tool = Tool(
                    name=tool_name,
                    func=create_api_caller(tool_schema, tool_headers, tool_params, llm),
                    description=f"Calls API: {tool_title}. Input should be relevant to the API's expected parameters.",
                    # You can set result_as_answer=True here if you want the raw output
                    # to be directly used as the answer. However, formatting in the tool's
                    # function might be better for control.
                )
                self.tools.append(api_tool)
                self.tool_name_map[tool_name.lower()] = api_tool  # Store in map for lookup

        # Create the CrewAgent
        self.agent = CrewAgent(
            role=agent_config["role"],
            goal=agent_config["goal"],
            backstory=agent_config["backstory"],
            llm=llm,
            tools=self.tools  # Initially assign all tools; we'll filter later if needed
        )

    def get_task_descriptions(self, description, expected_output, task_name=None, **kwargs):
        """
        Process task description and expected output, replacing placeholders with kwargs.
        """
        if task_name:
            try:
                if kwargs:
                    for key, value in kwargs.items():
                        placeholder = "{{" + key + "}}"
                        description = description.replace(placeholder, str(value))
                        expected_output = expected_output.replace(placeholder, str(value))
                return {"description": description, "expected_output": expected_output}
            except Exception as e:
                print(f"Error processing task '{task_name}': {e}. Using provided description.")
                return {"description": description, "expected_output": expected_output}
        return {"description": description, "expected_output": expected_output}

    def extract_tools_from_description(self, description):
        """
        Extract tool names mentioned in the description using a simple regex pattern.
        Returns a list of Tool instances that match the names.
        """
        # Look for patterns like "use the 'tool name' tool" or just "'tool name'"
        pattern = r"(?:use the\s+)?['\"](\w+(?:\s+\w+)*)['\"]\s*(?:tool)?"
        matches = re.findall(pattern, description.lower())

        # Map matched tool names to actual Tool instances
        selected_tools = []
        for match in matches:
            if match in self.tool_name_map:
                selected_tools.append(self.tool_name_map[match])
            else:
                print(f"Warning: Tool '{match}' mentioned in description but not found in available tools.")

        # If no tools are explicitly mentioned, return all tools
        return selected_tools if selected_tools else self.tools

    def execute_task(self, description, expected_output, task_name=None, **kwargs):
        """
        Execute a task using the CrewAI framework, utilizing tools mentioned in the description.
        """
        task_info = self.get_task_descriptions(description, expected_output, task_name, **kwargs)
        processed_description = task_info["description"]
        processed_expected_output = task_info["expected_output"]

        # Extract tools mentioned in the description
        task_tools = self.extract_tools_from_description(processed_description)

        # Update the agent's tools for this specific task
        self.agent.tools = task_tools

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