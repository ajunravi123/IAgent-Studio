# IAgent Studio

IAgent Studio is a web application for creating, managing, and deploying AI agents, built with FastAPI and a dynamic vanilla JavaScript frontend.

## Features

*   **Agent Management:** Create, configure, edit, duplicate, and delete AI agents.
*   **Tool Integration:** Define and manage custom tools (using OpenAPI schemas) or utilize built-in integrations.
*   **Agent Configuration:** Specify LLM provider, model, API keys, role, backstory, instructions, and select tools for each agent.
*   **Marketplace:** Discover and import pre-built agents (requires `/api/marketplace/agents` endpoint).
*   **User Management:** Placeholder for managing users and roles.
*   **Settings:** Placeholder for managing account and subscription details.
*   **Dynamic Frontend:** Single Page Application (SPA) experience using vanilla JavaScript for page loading and UI updates.
*   **Notifications:** In-app notification system.

## Technology Stack

*   **Backend:** Python, FastAPI
*   **Frontend:** HTML, CSS, Vanilla JavaScript
*   **Data Storage:** JSON files (for agents, tools, notifications)

## Project Structure

```
/
├── static/
│   ├── css/             # CSS stylesheets (main, marketplace, users, settings, etc.)
│   ├── data/            # JSON data files (e.g., notifications.json)
│   ├── images/          # Icons and illustrations
│   ├── js/              # JavaScript files (main.js, marketplace.js)
│   ├── pages/           # HTML fragments for different pages (agents.html, tools.html, etc.)
│   └── index.html       # Main HTML shell
├── tool_schemas/        # Directory for storing tool OpenAPI schemas (JSON)
├── agents.json          # Agent data store
├── tools.json           # Built-in tool data store
├── custom_tools.json    # Custom tool data store
├── main.py              # FastAPI application entry point
├── requirements.txt     # Python dependencies
└── README.md            # This file
```

## Setup and Running

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: You might need to create `requirements.txt` if it doesn't exist. Based on `main.py`, it should at least contain `fastapi`, `uvicorn[standard]`, `pydantic`)*

4.  **Run the FastAPI application:**
    ```bash
    uvicorn main:app --reload
    ```
    The `--reload` flag enables auto-reloading when code changes, useful for development.

5.  **Access the application:**
    Open your web browser and navigate to `http://localhost:8002` (or the address provided by uvicorn).

## How to Contribute

(Optional: Add guidelines for contributing if this is an open project).

---
*This README was generated based on the project structure and features observed.* 