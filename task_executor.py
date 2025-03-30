from crewai import Crew, Process, Agent, Task

import os
from crewai import LLM
from dotenv import load_dotenv

load_dotenv()

class TaskExecutor:
    def __init__(self, agent, llm_client):
        """Initialize the TaskExecutor with an agent and LLM client."""
        self.agent = agent  # The CrewAI Agent instance
        self.llm_client = llm_client
        
        # Assign the llm_client to the agent if not already set
        if not hasattr(self.agent, 'llm') or self.agent.llm is None:
            self.agent.llm = self.llm_client

    def get_task_descriptions(self, description, expected_output, task_name=None, **kwargs):
        """
        Process task description and expected output, replacing placeholders with kwargs.
        Args:
            description (str): The task description with optional {{placeholders}}.
            expected_output (str): The expected output format or content.
            task_name (str, optional): Name of the task (for future JSON lookup or logging).
            **kwargs: Dynamic arguments to replace placeholders in the description.
        Returns:
            dict: Dictionary with processed description and expected_output.
        """
        if task_name:
            try:
                # Replace {{key}} placeholders dynamically based on kwargs
                if kwargs:
                    for key, value in kwargs.items():
                        placeholder = "{{" + key + "}}"
                        description = description.replace(placeholder, str(value))
                return {"description": description, "expected_output": expected_output}
            except Exception as e:
                # Fallback to unformatted description if something goes wrong
                print(f"Error processing task '{task_name}': {e}. Using provided description.")
                return {"description": description, "expected_output": expected_output}
        return {"description": description, "expected_output": expected_output}

    def execute_task(self, description, expected_output, task_name=None, **kwargs):
        """
        Execute a task using the CrewAI framework with the provided LLM client.
        Args:
            description (str): The task description with optional {{placeholders}}.
            expected_output (str): The expected output format or content.
            task_name (str, optional): Name of the task for identification.
            **kwargs: Dynamic arguments to replace placeholders in the description.
        Returns:
            str: The raw output from the task execution.
        """
        # Get processed task info
        task_info = self.get_task_descriptions(description, expected_output, task_name, **kwargs)
        processed_description = task_info["description"]
        processed_expected_output = task_info["expected_output"]

        # Create the task
        task = Task(
            description=processed_description,
            expected_output=processed_expected_output,
            agent=self.agent
        )

        # Set up and run the crew
        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=Process.sequential
        )
        result = crew.kickoff()

        # Extract and return the raw output
        raw_output = result.tasks_output[0].raw.strip()
        if task_name:
            print(f"Raw LLM output for task '{task_name}': {raw_output}")
        else:
            print(f"Raw LLM output: {raw_output}")
        return raw_output


# Example usage
# if __name__ == "__main__":
#     from crewai import Agent
#     # Assuming API_KEYS is defined or loaded elsewhere
#     API_KEYS = {"gemini": os.getenv("GEMINI_API_KEY")}
    
#     # Initialize the LLM client
#     llm_client = LLM(model="gemini/gemini-2.0-flash", api_key=API_KEYS["gemini"])

#     # Define your agent with the llm_client
#     llm_agent = Agent(
#         role="Polite Rewriter",
#         goal="Transform sentences into polite, courteous versions while preserving meaning.",
#         backstory="A linguistic expert trained in etiquette and diplomacy, dedicated to making communication kinder and more respectful.",
#         llm=llm_client  # Directly assign the llm_client here
#     )

#     # Create an instance of TaskExecutor
#     task_executor = TaskExecutor(agent=llm_agent, llm_client=llm_client)

#     # Example: Rewrite a sentence politely
#     output = task_executor.execute_task(
#         description="Rewrite the following sentence in a polite manner: {{text}}",
#         expected_output="A politely rephrased version of the original sentence.",
#         task_name="polite_rewrite",
#         text="Get this done now!"
#     )
#     print(f"Result: {output}")