from crewai import Crew, Process, Task, Agent as CrewAgent
from crewai import LLM
from langchain.tools import Tool
import os
import requests
from dotenv import load_dotenv

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
        llm = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEYS["gemini"])

        # Initialize tools properly
        self.tools = []
        if tools_config:
            for tool_config in tools_config:
                tool_schema = tool_config["schema"]
                tool_headers = tool_config.get("auth", {}).get("headers", {})
                tool_params = tool_config.get("auth", {}).get("params", {})

                def api_caller(url=tool_schema["paths"], headers=tool_headers, params=tool_params):
                    """Dynamically calls an API based on schema configuration."""
                    try:
                        response = requests.post(url, headers=headers, params=params)
                        return response.json()
                    except Exception as e:
                        return {"error": str(e)}

                self.tools.append(
                    Tool(
                        name=f"API Tool for {tool_schema['info']['title']}",
                        func=api_caller,
                        description=f"Calls API: {tool_schema['info']['title']}. Input: {{input}}"
                    )
                )

        # Create the CrewAgent
        self.agent = CrewAgent(
            role=agent_config["role"],
            goal=agent_config["goal"],
            backstory=agent_config["backstory"],
            llm=llm,
            tools=self.tools if self.tools else []
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
                        expected_output = expected_output.replace(placeholder, str(value))  # ✅ Modify expected output too!
                return {"description": description, "expected_output": expected_output}
            except Exception as e:
                print(f"Error processing task '{task_name}': {e}. Using provided description.")
                return {"description": description, "expected_output": expected_output}
        return {"description": description, "expected_output": expected_output}


    def execute_task(self, description, expected_output, task_name=None, **kwargs):
        """
        Execute a task using the CrewAI framework.
        """
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
