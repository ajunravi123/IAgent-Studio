// Main JavaScript file for the FastAPI application

// Keep track of loaded stylesheets
const loadedStylesheets = new Set();

// Global variable for tracking selected tools
let selectedTools = new Set();
let selectedAdvancedTools = new Set();

// Function to update the active state of sidebar links
function updateActiveLink() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.sidebar nav a');
    // Add main stylesheet URL to prevent accidental removal if needed
    document.querySelectorAll('head > link[rel="stylesheet"]').forEach(link => loadedStylesheets.add(link.href));

    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Function to dynamically load CSS if needed
function loadStylesheet(href) {
    if (!loadedStylesheets.has(href)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        loadedStylesheets.add(href);
        console.log(`Loaded stylesheet: ${href}`);
    }
}

function loadPage(pagePath) {
    updateActiveLink();
    const app = document.getElementById('app');
    if (app) {
        const basePage = pagePath.replace(/^\//, '').split('?')[0] || 'home'; // Default to home if path is "/"
        
        // Fetch the HTML fragment from the new endpoint
        fetch(`/pages/${basePage}`) 
            .then(response => {
                if (!response.ok) {
                    // If fragment not found, maybe show a 404 message in #app
                    throw new Error(`Fragment not found: /pages/${basePage}`);
                }
                return response.text();
            })
            .then(html => {
                // Parse the HTML fragment to find stylesheets
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const fragmentStyles = doc.querySelectorAll('link[rel="stylesheet"]');
                
                fragmentStyles.forEach(link => {
                    const absoluteHref = new URL(link.getAttribute('href'), window.location.origin).href;
                    loadStylesheet(absoluteHref);
                });

                // Inject the HTML content
                app.innerHTML = html;

                // Add a small delay to ensure DOM is fully loaded for JS initializations
                // setTimeout(() => {
                    // Page specific JS initializations
                    if (basePage === 'agents') {
                    loadAgents();
                        // Initialize search for agents page
                        const searchInput = document.querySelector('.page.agents .search-bar input'); // Assuming this selector is correct for the agents page search bar
                        if (searchInput && !searchInput.dataset.listenerAttached) {
                            searchInput.addEventListener('input', (e) => searchAgents(e.target.value));
                            searchInput.dataset.listenerAttached = 'true'; // Prevent attaching multiple listeners
                        }
                    } else if (basePage === 'multi-agents') {
                        initializeMultiAgentPage(); // Call the new initializer
                    } else if (basePage === 'launch-multi-agent') {
                        // Initialize the multi-agent launch interface
                        console.log('Initializing Multi-Agent Launch Page...');
                        initializeMultiAgentLaunchPage(); // Call the initializer from main.js
                    } else if (basePage === 'create-agent') {
                    loadTools();
                    loadAdvancedTools(); // Ensure advanced tools are loaded
                        // Check if we're editing an agent
                        const isEditing = pagePath.includes('?edit=true');
                        const buttonText = document.getElementById('buttonText');
                        if (buttonText) {
                            buttonText.textContent = isEditing ? 'Save' : 'Create Agent';
                        }
                        // Initialize search functionality for tools
                        const searchInput = document.querySelector('.search-bar input[type="text"]');
                        if (searchInput) {
                            searchInput.addEventListener('input', (e) => searchAgentTools(e.target.value));
                        }
                        // Initialize LLM provider change handler
                        handleLLMProviderChange();
                        // Verify form elements are present
                        const formElements = [
                            'agentName',
                            'agentDescription',
                            'llmProvider',
                            'llmModel',
                            'apiKey',
                            'agentRole',
                            'agentBackstory',
                            'agentInstructions',
                            'managerAgent'
                        ];
                        formElements.forEach(id => {
                            const element = document.getElementById(id);
                            if (!element) {
                                console.error(`Form element ${id} not found`);
                            }
                        });
                    } else if (basePage === 'tools') {
                        loadExternalTools();
                        loadAdvancedTools(); // Always refresh advanced tools when visiting the Tools tab
                        // Initialize search for tools page if needed
                        const searchInput = document.querySelector('.page.tools .search-bar input');
                        if (searchInput && !searchInput.dataset.listenerAttached) {
                            searchInput.addEventListener('input', (e) => searchExternalTools(e.target.value));
                            searchInput.dataset.listenerAttached = 'true'; // Prevent attaching multiple listeners
                        }
                    } else if (basePage === 'marketplace') {
                         // Initialize search for marketplace page if needed
                         const searchInput = document.querySelector('.page.marketplace .search-bar input');
                         if (searchInput && !searchInput.dataset.listenerAttached) {
                            searchInput.addEventListener('input', (e) => searchMarketplaceAgents(e.target.value));
                            searchInput.dataset.listenerAttached = 'true'; // Prevent attaching multiple listeners
                         }
                         // Marketplace JS likely initializes itself via DOMContentLoaded listener in marketplace.js
                         // If not, explicitly call its init function here: loadMarketplace(); 
                    }
                    // Add other page specific initializations here
                    else if (basePage === 'data-connectors') {
                        // Ensure the main container for this page exists before initializing
                        const container = document.getElementById('dataConnectorsGrid');
                        if (container) {
                        initializeDataConnectorsPage();
                        } else {
                            console.error('Data Connectors container not found after loading fragment!');
                        }
                    }

                // }, 100); // Removed fixed timeout, initialize directly if container exists
            })
            .catch(error => {
                app.innerHTML = '<p>Error loading page content.</p>';
                console.error('Error loading page fragment:', error);
            });
    }
}

function refreshAgents() {
    loadAgents();
}

// Updated createNewAgent function
function createNewAgent() {
    // Clear selected tools before loading the create agent page
    selectedTools.clear();
    selectedAdvancedTools.clear();
    loadPage('create-agent');
} 

function goBack() {
    // Check if we were viewing a multi-agent launch page first
    if (document.querySelector('.launch-multi-agent')) {
        // We're on the multi-agent launch page
        sessionStorage.removeItem('selectedMultiAgentId');
        window.selectedMultiAgentId = null;
        loadPage('multi-agents');
        return;
    }
    
    // Otherwise handle other back scenarios
    if (window.location.pathname === '/launch-agent') {
        selectedAgentId = null;
        loadPage('agents');
    } else if (window.selectedMultiAgentId || sessionStorage.getItem('selectedMultiAgentId')) {
        // If we have a multi-agent ID in memory or session storage, we came from multi-agent launch
        sessionStorage.removeItem('selectedMultiAgentId');
        window.selectedMultiAgentId = null;
        loadPage('multi-agents');
    } else {
        // Default to agents page if we can't determine the source
        loadPage('agents');
    }
}

let selectedAgentId = null;

function loadAgents() {
    // First get multi-agent configurations to check for agent usage
    fetch('/api/multi-agents')
        .then(response => response.json())
        .then(multiAgents => {
            // Create a set of agent IDs that are used in multi-agent configurations
            const usedInMultiAgents = new Set();
            multiAgents.forEach(ma => {
                if (ma.agent_ids && Array.isArray(ma.agent_ids)) {
                    ma.agent_ids.forEach(id => usedInMultiAgents.add(id));
                }
            });
            
            // Now fetch the agents and mark those that are used in multi-agents
            return fetch('/api/agents')
        .then(response => response.json())
        .then(agents => {
            const agentsContent = document.querySelector('.agents-content');
            if (agents.length === 0) {
                agentsContent.innerHTML = `
                    <div class="empty-state">
                        <img src="/static/images/ufo-illustration.svg" alt="No agents found" class="empty-illustration">
                        <h2>No Agents found</h2>
                        <button class="btn-primary" onclick="createNewAgent()">
                            + Create new
                        </button>
                    </div>
                `;
            } else {
                        agentsContent.innerHTML = agents.map(agent => {
                            // Check if agent is used in a multi-agent
                            const isUsedInMultiAgent = usedInMultiAgents.has(agent.id);
                            
                            // Add badge for agents used in multi-agent configs
                            const multiAgentBadge = isUsedInMultiAgent ? 
                                `<div class="multi-agent-badge" title="This agent is used in one or more Multi-Agent Orchestrations">
                                    <i class="fas fa-network-wired"></i> Used in Orchestration
                                </div>` : '';
                                
                            return `
                    <div class="agent-card">
                        <div class="agent-card-header">
                            <div class="agent-info">
                                <div class="agent-icon">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <div class="agent-details">
                                    <h3>${agent.name}</h3>
                                    <p>${agent.description}</p>
                                </div>
                            </div>
                            <div class="agent-actions">
                                <button class="btn-more" onclick="showAgentMenu(event, '${agent.id}')">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </div>
                        <div class="agent-card-content">
                            <div class="agent-stats">
                                <div class="stat-left">
                                    <span class="stat-label">Model</span>
                                    <span class="stat-value">${agent.llmModel}</span>
                                </div>
                                <div class="stat-right">
                                    <span class="stat-label">Tools</span>
                                    <span class="stat-value">${agent.tools ? agent.tools.length : 0}</span>
                                </div>
                            </div>
                                    ${multiAgentBadge}
                        </div>
                    </div>
                            `;
                        }).join('');

                        // Add CSS for the new layout and multi-agent badge
                const style = document.createElement('style');
                style.textContent = `
                    .agent-stats {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                    }
                    .stat-left, .stat-right {
                        display: flex;
                        flex-direction: column;
                    }
                    .stat-label {
                        color: var(--text-secondary);
                        font-size: 12px;
                    }
                    .stat-value {
                        color: var(--text-primary);
                        font-size: 14px;
                        font-weight: 500;
                    }
                            .multi-agent-badge {
                                margin-top: 12px;
                                padding: 5px 10px;
                                background-color: rgba(59, 130, 246, 0.15);
                                color: rgba(59, 130, 246, 0.9);
                                border-radius: 10px;
                                font-size: 12px;
                                font-weight: 500;
                                display: inline-flex;
                                align-items: center;
                                gap: 5px;
                                border: 1px solid rgba(59, 130, 246, 0.3);
                                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                            }
                            body.light-theme .multi-agent-badge {
                                background-color: rgba(59, 130, 246, 0.1);
                                color: rgba(37, 99, 235, 0.9);
                                border-color: rgba(37, 99, 235, 0.2);
                                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                            }
                            .multi-agent-badge i {
                                font-size: 11px;
                    }
                `;
                document.head.appendChild(style);
                    }
                });
        })
        .catch(error => {
            console.error('Error loading agents:', error);
            const agentsContent = document.querySelector('.agents-content');
            if (agentsContent) {
                agentsContent.innerHTML = `<p>Error loading agents: ${error.message}</p>`;
            }
        });
}

function showAgentMenu(event, agentId) {
    event.stopPropagation();
    const menu = document.getElementById('agentActionsMenu');
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    selectedAgentId = agentId;
    
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left - 180}px`;
    menu.classList.add('show');
    
    // Close menu when clicking outside
    document.addEventListener('click', closeAgentMenu);
}

function closeAgentMenu() {
    const menu = document.getElementById('agentActionsMenu');
    menu.classList.remove('show');
    document.removeEventListener('click', closeAgentMenu);
}

function launchAgent(agentId) {
    selectedAgentId = agentId;
    loadPage('launch-agent');
    
    // Fetch agent data and populate the form
    showLoading();
    fetch(`/api/agents/${agentId}`)
        .then(response => response.json())
        .then(agent => {
            setTimeout(() => {

                hideLoading();

                // Update page title
                const header = document.querySelector('.page-header h1');
                if (header) {
                    header.textContent = ` ${agent.name} ⛳ Playground`;
                }
                
                // Fill form fields - Check if element exists before setting value
                const agentNameInput = document.getElementById('agentName');
                if (agentNameInput) {
                    agentNameInput.value = agent.name;
                }
                
                const agentDescriptionInput = document.getElementById('agentDescription');
                if (agentDescriptionInput) {
                    agentDescriptionInput.value = agent.description;
                }

                const llmProviderSelect = document.getElementById('llmProvider');
                if (llmProviderSelect) {
                    llmProviderSelect.value = agent.llmProvider;
                }

                const llmModelSelect = document.getElementById('llmModel');
                if (llmModelSelect) {
                    llmModelSelect.value = agent.llmModel;
                }

                const apiKeyInput = document.getElementById('apiKey');
                if (apiKeyInput) {
                    apiKeyInput.value = agent.apiKey;
                }

                const agentRoleInput = document.getElementById('agentRole');
                if (agentRoleInput) {
                    agentRoleInput.value = agent.role;
                }

                const agentGoalInput = document.getElementById('agentGoal');
                if (agentGoalInput) {
                    agentGoalInput.value = agent.goal || '';
                }

                const expectedOutputInput = document.getElementById('expectedOutput');
                if (expectedOutputInput) {
                    expectedOutputInput.value = agent.expectedOutput || '';
                }
                
                const agentBackstoryInput = document.getElementById('agentBackstory');
                if (agentBackstoryInput) {
                    agentBackstoryInput.value = agent.backstory || '';
                }
                
                const agentInstructionsInput = document.getElementById('agentInstructions');
                if (agentInstructionsInput) {
                    agentInstructionsInput.value = agent.instructions;
                }
                
                // Initialize LLM provider change handler
                handleLLMProviderChange();
                
                // Initialize selectedTools with agent's tools
                selectedTools = new Set(agent.tools || []);
                
                // Initialize selectedAdvancedTools with agent's advanced tools (check both naming conventions)
                selectedAdvancedTools = new Set();
                if (Array.isArray(agent.advanced_tools)) {
                    agent.advanced_tools.forEach(toolId => selectedAdvancedTools.add(toolId));
                } else if (Array.isArray(agent.advancedTools)) {
                    agent.advancedTools.forEach(toolId => selectedAdvancedTools.add(toolId));
                }
                
                // Load agent tools (combine both normal and advanced tools)
                const allToolIds = [...selectedTools, ...selectedAdvancedTools];
                loadAgentTools(allToolIds);
            }, 100); // Keeping the timeout for now, but the checks add safety
        });
}

function loadAgentTools(toolIds) {
    const colorClasses = ['blue', 'green', 'purple', 'yellow', 'red', 'orange'];
    let colorIndex = 0;

    // Fetch both normal and advanced tools
    Promise.all([
        fetch('/api/tools').then(response => response.json()),
        fetch('/api/advanced-tools').then(response => response.json())
    ]).then(([normalTools, advancedTools]) => {
        const allTools = [...normalTools, ...advancedTools];
        const agentTools = allTools.filter(tool => toolIds.includes(tool.id));
        const toolsGrid = document.getElementById('agentTools');
        
        toolsGrid.innerHTML = agentTools.map(tool => {
            const colorClass = colorClasses[colorIndex];
            colorIndex = (colorIndex + 1) % colorClasses.length;
            
            const firstLetter = tool.name.charAt(0).toUpperCase();
            
            return `
                <div class="tool-card" data-tool="${tool.id}" onclick="viewTool('${tool.id}')" style="cursor: pointer;">
                    <div class="tool-content">
                        <div class="tool-icon-wrapper ${colorClass}">
                            ${firstLetter}
                        </div>
                        <div class="tool-info">
                            <div class="tool-name ltool">${tool.name}</div>
                            <div class="tool-description">${tool.description || 'No description available'}</div>
                            <div class="tool-tags">
                                ${tool.tags ? tool.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    });
}

function getRandomColor() {
    const colors = ['yellow', 'green', 'purple'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Clear input
    chatInput.value = '';
    
    // TODO: Send message to backend and get response
    // For now, just add a mock response
    setTimeout(() => {
        addMessageToChat('agent', 'I understand your message. Let me help you with that.');
    }, 1000);
}

function addMessageToChat(type, message) {
    const chatContainer = document.getElementById('chatContainer');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    messageElement.innerHTML = `
        <div class="message-avatar ${type}">
            <i class="fas ${type === 'user' ? 'fa-user' : 'fa-robot'}"></i>
        </div>
        <div class="message-content ${type}">
            ${message}
        </div>
    `;
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function refreshAgent() {
    if (selectedAgentId) {
        launchAgent(selectedAgentId);
    }
}

function duplicateAgent(agentId) {
    showLoading("Please wait..");
    fetch(`/api/agents/${agentId}`)
        .then(response => response.json())
        .then(agent => {
            hideLoading();
            const duplicatedAgent = {
                ...agent,
                name: `${agent.name} (Copy)`,
                description: agent.description
            };
            delete duplicatedAgent.id;

            return fetch('/api/agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(duplicatedAgent)
            });
        })
        .then(() => {
            loadAgents();
        });
}

function searchAgents(query) {
    const agentCards = document.querySelectorAll('.agents-content .agent-card');
    const searchQuery = query.toLowerCase().trim();

    agentCards.forEach(card => {
        // Find relevant elements within the card
        const nameElement = card.querySelector('.agent-details h3');
        const descriptionElement = card.querySelector('.agent-details p');
        const modelElement = card.querySelector('.agent-stats .stat:nth-child(1) .stat-value'); // Assuming model is first stat
        const providerElement = card.querySelector('.agent-stats .stat:nth-child(2) .stat-value'); // Assuming provider is second stat

        // Extract text content, checking if elements exist
        const name = nameElement ? nameElement.textContent.toLowerCase() : '';
        const description = descriptionElement ? descriptionElement.textContent.toLowerCase() : '';
        const model = modelElement ? modelElement.textContent.toLowerCase() : '';
        const provider = providerElement ? providerElement.textContent.toLowerCase() : '';

        // Check for matches
        const matches = name.includes(searchQuery) || 
                       description.includes(searchQuery) ||
                       model.includes(searchQuery) ||
                       provider.includes(searchQuery);

        // Show or hide the card
        card.style.display = matches ? '' : 'none'; 
    });
}

// Custom Tool functions
function showAddCustomTool() {
    const modal = document.getElementById('addCustomToolModal');
    // Update modal title and button
    modal.querySelector('.modal-header h2').textContent = 'Add Custom Tool';
    modal.querySelector('.modal-footer .btn-primary').textContent = 'Add Tool';
    
    // Clear form
    document.getElementById('toolName').value = '';
    document.getElementById('toolDescription').value = '';
    document.getElementById('toolTags').value = 'Custom';
    
    // Add error message element if it doesn't exist
    if (!modal.querySelector('#tool-modal-error')) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'tool-modal-error';
        errorDiv.classList.add('alert', 'alert-danger');
        errorDiv.style.display = 'none';
        errorDiv.style.color = 'red';
        errorDiv.style.marginBottom = '15px';
        modal.querySelector('.modal-body').insertBefore(errorDiv, modal.querySelector('.modal-body').firstChild);
    }
    
    // Create default schema
    const defaultSchema = {
        "openapi": "3.0.0",
        "info": {
            "title": "Custom Tool API",
            "description": "A custom tool API for your agent",
            "version": "1.0.0"
        },
        "servers": [
            {
                "url": "https://api.example.com",
                "description": "Production server"
            }
        ],
        "paths": {
            "/sample": {
                "get": {
                    "summary": "Sample endpoint",
                    "description": "This is a sample endpoint",
                    "parameters": [
                        {
                            "name": "param1",
                            "in": "query",
                            "description": "Sample parameter",
                            "required": false,
                            "schema": {
                                "type": "string"
                            }
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "message": {
                                                "type": "string"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    
    document.getElementById('toolSchema').value = JSON.stringify(defaultSchema, null, 2);
    
    // Reset save button to handle new tool creation
    const saveButton = modal.querySelector('.modal-footer .btn-primary');
    saveButton.onclick = saveCustomTool;
    
    // Load data connectors for dropdown
    loadDataConnectorsForCustomTool();
    
    // Show the modal
    modal.classList.add('show');
}

function closeAddCustomTool() {
    const modal = document.getElementById('addCustomToolModal');
    modal.classList.remove('show');
    
    // Clear form
    document.getElementById('toolName').value = '';
    document.getElementById('toolDescription').value = '';
    document.getElementById('toolTags').value = '';
    document.getElementById('toolSchema').value = '';
}

function validateOpenAPISchema(schema) {
    try {
        const parsedSchema = JSON.parse(schema);
        
        // Basic validation
        if (!parsedSchema.openapi || !parsedSchema.openapi.startsWith('3.')) {
            throw new Error('Invalid OpenAPI version. Must be 3.x');
        }
        
        if (!parsedSchema.info || !parsedSchema.info.title || !parsedSchema.info.version) {
            throw new Error('Missing required info fields (title, version)');
        }
        
        if (!parsedSchema.paths) {
            throw new Error('Missing paths object');
        }
        
        return true;
    } catch (error) {
        alert('Invalid OpenAPI Schema: ' + error.message);
        return false;
    }
}

async function saveCustomTool() {
    const name = document.getElementById('toolName').value.trim();
    const description = document.getElementById('toolDescription').value.trim();
    // const icon = document.getElementById('toolIcon').value.trim();
    const tags = document.getElementById('toolTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const schema = document.getElementById('toolSchema').value.trim();
    const dataConnectorId = document.getElementById('toolDataConnector').value;
    
    // Find the error message element within the modal
    const modal = document.getElementById('addCustomToolModal');
    const errorElement = modal ? modal.querySelector('#tool-modal-error') : null;

    // Clear previous error messages
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    // Client-side Validation
    if (!name) {
        if (errorElement) {
            errorElement.textContent = 'Tool name is required';
            errorElement.style.display = 'block';
        } else {
        alert('Tool name is required');
        }
        document.getElementById('toolName').focus();
        return;
    }
    
    if (!description) {
         if (errorElement) {
            errorElement.textContent = 'Description is required';
            errorElement.style.display = 'block';
        } else {
        alert('Description is required');
        }
        document.getElementById('toolDescription').focus();
        return;
    }
    
    if (!schema || !validateOpenAPISchema(schema)) {
        // validateOpenAPISchema already shows an alert, 
        // but we can also update the modal error element if it exists
         if (errorElement && !schema) { 
             errorElement.textContent = 'OpenAPI Schema is required.';
             errorElement.style.display = 'block';
         } else if (errorElement && schema && !validateOpenAPISchema(schema)) {
             // Attempt to show the validation error reason in the modal too
             try { JSON.parse(schema) } catch (e) { errorElement.textContent = 'Invalid OpenAPI Schema: ' + e.message; }
             errorElement.style.display = 'block';
         }
        document.getElementById('toolSchema').focus();
        return;
    }
    
    // Prepare tool data
    const toolData = {
        name,
        description,
        // icon: icon || `/static/images/default-tool-icon.svg`,
        tags: tags.length > 0 ? tags : ['Custom'],
        schema: JSON.parse(schema),
        is_custom: true
    };
    
    // Add data connector if selected
    if (dataConnectorId) {
        toolData.data_connector_id = dataConnectorId;
    }
    
    try {
        const response = await fetch('/api/tools/custom', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(toolData)
        });
        
        if (response.ok) {
            closeAddCustomTool();
            loadExternalTools(); // Refresh tools list
        } else {
            const error = await response.json();
            const errorMessage = error.detail || 'Failed to save tool. Please check the details.'; // Use detail from FastAPI HTTPException
            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.style.display = 'block';
            } else {
                alert(errorMessage); // Fallback to alert if element not found
            }
        }
    } catch (error) {
        console.error('Error saving custom tool:', error);
        const errorMessage = 'An unexpected error occurred. Please try again.';
         if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
        } else {
            alert(errorMessage); // Fallback
        }
    }
}

// Add this helper function to generate a consistent color from a string
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 45%)`; // Using HSL for vibrant but consistent colors
}

let selectedToolId = null;

function validateToolData(name, description, schema) {
    if (!name) {
        alert('Tool name is required');
        return false;
    }
    if (!description) {
        alert('Description is required');
        return false;
    }
    if (!schema || !validateOpenAPISchema(schema)) {
        return false;
    }
    return true;
}

function showToolMenu(event, toolId) {
    event.stopPropagation();
    const menu = document.getElementById('toolActionsMenu');
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    selectedToolId = toolId;
    
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left - 180}px`;
    menu.classList.add('show');
    
    // Close menu when clicking outside
    document.addEventListener('click', closeToolMenu);
}

function closeToolMenu() {
    const menu = document.getElementById('toolActionsMenu');
    menu.classList.remove('show');
    document.removeEventListener('click', closeToolMenu);
}

function editTool(toolId) {
    // Close the view modal if it's open
    closeViewTool();
    
    if (document.getElementById('toolActionsMenu')) {
        closeToolMenu();
    }
    showLoading("Please wait..");
    
    // First load data connectors
    loadDataConnectorsForCustomTool().then(() => {
        fetch(`/api/tools/${toolId}`)
            .then(response => response.json())
            .then(tool => {
                // Get tool metadata to check for data connector
                return fetch(`/api/tools/${toolId}/metadata`)
                    .then(metaResponse => metaResponse.json())
                    .then(metadata => {
                        hideLoading();
                        const modal = document.getElementById('addCustomToolModal');
                        // Update modal title and button
                        modal.querySelector('.modal-header h2').textContent = 'Edit Tool';
                        modal.querySelector('.modal-footer .btn-primary').textContent = 'Save';
                        
                        // Fill form with tool data
                        document.getElementById('toolName').value = tool.name;
                        document.getElementById('toolDescription').value = tool.description;
                        document.getElementById('toolTags').value = tool.tags.join(', ');
                        
                        // Set data connector if present in metadata
                        const dataConnectorSelect = document.getElementById('toolDataConnector');
                        if (metadata && metadata.data_connector_id) {
                            dataConnectorSelect.value = metadata.data_connector_id;
                        } else {
                            dataConnectorSelect.value = '';
                        }
                        
                        // Get and set schema
                        return fetch(`/api/tools/${toolId}/schema`)
                            .then(response => response.json())
                            .then(schema => {
                                document.getElementById('toolSchema').value = JSON.stringify(schema, null, 2);
                                
                                // Update save button to handle edit
                                const saveButton = modal.querySelector('.modal-footer .btn-primary');
                                saveButton.onclick = () => updateTool(toolId);
                                
                                // Show the modal
                                modal.classList.add('show');
                            });
                    });
            })
            .catch(error => {
                hideLoading();
                console.error("Error fetching tool data:", error);
                alert("Failed to load tool data. Please try again.");
            });
    });
}

function updateTool(toolId) {
    const name = document.getElementById('toolName').value.trim();
    const description = document.getElementById('toolDescription').value.trim();
    const tags = document.getElementById('toolTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const schema = document.getElementById('toolSchema').value.trim();
    const dataConnectorId = document.getElementById('toolDataConnector').value;
    
    if (!validateToolData(name, description, schema)) return;
    
    const toolData = {
        name,
        description,
        icon: `/static/images/default-tool-icon.svg`,
        tags: tags.length > 0 ? tags : ['Custom'],
        schema: JSON.parse(schema),
        is_custom: true
    };
    
    // Add data connector if selected
    if (dataConnectorId) {
        toolData.data_connector_id = dataConnectorId;
    }

    showLoading("Please wait..");
    
    fetch(`/api/tools/${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData)
    })
    .then(response => {
        hideLoading();
        if (!response.ok) throw new Error('Failed to update tool');
        return response.json();
    })
    .then(() => {
        closeAddCustomTool();
        loadExternalTools(); // Refresh tools list
    })
    .catch(error => {
        hideLoading();
        console.error('Error updating tool:', error);
        alert('Failed to update tool. Please try again.');
    });
}

function cloneTool(toolId) {
    closeToolMenu();
    let toolData; // Store the original tool data

    showLoading("Please wait..");
    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
            toolData = tool; // Store the tool data for later use
            // Get the schema and metadata for the tool
            return Promise.all([
                fetch(`/api/tools/${toolId}/schema`).then(response => response.json()),
                fetch(`/api/tools/${toolId}/metadata`).then(response => response.json())
            ]);
        })
        .then(([schema, metadata]) => {
            const clonedTool = {
                name: `${toolData.name} (Copy)`,
                description: toolData.description,
                tags: toolData.tags,
                schema: schema,
                is_custom: true
            };
            
            // Include data connector if present in original
            if (metadata && metadata.data_connector_id) {
                clonedTool.data_connector_id = metadata.data_connector_id;
            }
            
            return fetch('/api/tools/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clonedTool)
            });
        })
        .then(response => {
            hideLoading();
            if (!response.ok) {
                throw new Error(`Failed to clone tool: ${response.statusText}`);
            }
            loadExternalTools(); // Refresh tools list
        })
        .catch(error => {
            hideLoading();
            console.error('Error cloning tool:', error);
            const toolName = toolData ? toolData.name : toolId;
            alert(`Failed to clone tool "${toolName}". Please try again.`);
        });
}

function deleteTool(toolId) {
    closeToolMenu();
    // First check if the tool is used by any agents
    fetch('/api/agents')
        .then(response => response.json())
        .then(agents => {
            const usedByAgents = agents.filter(agent => 
                agent.tools && agent.tools.includes(toolId)
            );
            
            if (usedByAgents.length > 0) {
                const agentNames = usedByAgents.map(a => a.name).join(', ');
                alert(`Cannot delete this tool as it is used by the following agents: ${agentNames}`);
                return;
            }
            
            if (confirm('Are you sure you want to delete this tool?')) {
                showLoading("Please wait..");
                fetch(`/api/tools/${toolId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) throw new Error('Failed to delete tool');
                    hideLoading(); // Add this line to hide the loading indicator after successful deletion
                    loadExternalTools(); // Refresh tools list
                })
                .catch(error => {
                    hideLoading();
                    console.error('Error deleting tool:', error);
                    alert('Failed to delete tool. Please try again.');
                });
            }
        });
}

function viewTool(toolId) {
    // Check if we're on the tools page
    const isToolsPage = window.location.pathname === '/tools';
    
    if (isToolsPage) {
        // If we're on the tools page, show view-only popup
        showLoading("Please wait..");
        fetch(`/api/tools/${toolId}`)
            .then(response => response.json())
            .then(tool => {
                // Get and set schema
                fetch(`/api/tools/${toolId}/schema`)
                    .then(response => response.json())
                    .then(schema => {
                        hideLoading();
                        const modal = document.getElementById('viewToolModal');
                        if (!modal) {
                            // Create modal if it doesn't exist
                            createViewToolModal();
                        }
                        
                        // Update modal content
                        const viewModal = document.getElementById('viewToolModal');
                        viewModal.innerHTML = `
                            <div class="modal-content">
                                <div class="modal-header">
                                    <div class="tool-header-content">
                                        <div class="tool-icon" style="background: ${stringToColor(tool.name)}">
                                            ${tool.name.charAt(0).toUpperCase()}
                                        </div>
                                        <h2>${tool.name}</h2>
                                    </div>
                                    <button class="btn-close" onclick="closeViewTool()">×</button>
                                </div>
                                <div class="modal-body">
                                    <div class="tool-info-section">
                                        <h3>Description</h3>
                                        <p>${tool.description || 'No description available'}</p>
                                    </div>
                                    <div class="tool-tags-section">
                                        <h3>Tags</h3>
                                        <div class="tags-container">
                                            ${tool.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                        </div>
                                    </div>
                                    <div class="tool-schema-section">
                                        <h3>OpenAPI Schema</h3>
                                        <pre><code class="language-json">${JSON.stringify(schema, null, 2)}</code></pre>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button class="btn-secondary" onclick="closeViewTool()">Close</button>
                                    <button class="btn-primary" onclick="editTool('${toolId}')">Edit</button>
                                </div>
                            </div>
                        `;
                        
                        // Show the modal
                        viewModal.classList.add('show');
                    });
            });
    } else {
        // If we're on any other page (like agent test), open in new window
        showLoading("Please wait..");
        fetch(`/api/tools/${toolId}`)
            .then(response => response.json())
            .then(tool => {
                // Get and set schema
                fetch(`/api/tools/${toolId}/schema`)
                    .then(response => response.json())
                    .then(schema => {
                        hideLoading();
                        // Create a new window with the tool details
                        const toolWindow = window.open('/tools', '_blank');
                        toolWindow.onload = function() {
                            // Wait for the page to load, then edit the tool
                            setTimeout(() => {
                                toolWindow.editTool(toolId);
                            }, 100);
                        };
                    });
            });
    }
}

function createViewToolModal() {
    const modal = document.createElement('div');
    modal.id = 'viewToolModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
    
    // Add styles if not already present
    if (!document.getElementById('viewToolModalStyles')) {
        const style = document.createElement('style');
        style.id = 'viewToolModalStyles';
        style.textContent = `
            #viewToolModal.show {
                display: block;
                background: rgba(0, 0, 0, 0.5);
            }
            #viewToolModal .modal-content {
                background: var(--background);
                border-radius: 8px;
                max-width: 800px;
                margin: 50px auto;
                max-height: 90vh;
                overflow-y: auto;
            }
            #viewToolModal .modal-header {
                padding: 20px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #viewToolModal .tool-header-content {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            #viewToolModal .tool-icon {
                width: 40px;
                height: 40px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
            }
            #viewToolModal .btn-close {
                background: none;
                border: none;
                color: var(--text-color);
                cursor: pointer;
                font-size: 24px;
                line-height: 1;
                padding: 0;
                opacity: 0.5;
                transition: opacity 0.2s;
            }
            #viewToolModal .btn-close:hover {
                opacity: 1;
            }
            #viewToolModal .modal-body {
                padding: 20px;
            }
            #viewToolModal .tool-info-section,
            #viewToolModal .tool-tags-section,
            #viewToolModal .tool-schema-section {
                margin-bottom: 20px;
            }
            #viewToolModal .tags-container {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 10px;
            }
            #viewToolModal pre {
                background: var(--code-background);
                padding: 15px;
                border-radius: 6px;
                overflow-x: auto;
            }
            #viewToolModal .modal-footer {
                padding: 20px;
                border-top: 1px solid var(--border-color);
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
        `;
        document.head.appendChild(style);
    }
}

function closeViewTool() {
    const modal = document.getElementById('viewToolModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function loadExternalTools() {
    // First get all data connectors for later lookup
    fetch('/api/data-connectors')
        .then(response => response.json())
        .then(connectors => {
            // Create a map of connector IDs to names for quick lookup
            const connectorMap = {};
            connectors.forEach(connector => {
                connectorMap[connector.id] = {
                    name: connector.uniqueName,
                    type: connector.connectorType
                };
            });
            
            // Now fetch all tools - excluding advanced tools for now
            return fetch('/api/tools')
                .then(response => response.json())
                .then(async tools => {
                    const toolsGrid = document.getElementById('externalToolsGrid');
                    if (!toolsGrid) return;
        
                    // Create an array to store HTML for each tool card
                    const toolCards = [];
                    
                    // Process each tool one by one to fetch its metadata
                    for (const tool of tools) {
                        const firstLetter = tool.name.charAt(0).toUpperCase();
                        
                        // Fetch metadata for this tool
                        let connectorHtml = '';
                        try {
                            const metadataResponse = await fetch(`/api/tools/${tool.id}/metadata`);
                            const metadata = await metadataResponse.json();
                            
                            // If the tool has a data connector, add connector info to the card
                            if (metadata && metadata.data_connector_id) {
                                const connectorId = metadata.data_connector_id;
                                const connectorInfo = connectorMap[connectorId] || { name: 'Unknown', type: 'database' };
                                
                                connectorHtml = `
                                    <div class="tool-connector">
                                        <i class="fas fa-database"></i>
                                        <span>Connected to ${connectorInfo.name} (${connectorInfo.type})</span>
                                    </div>
                                `;
                            }
                        } catch (error) {
                            console.error(`Error fetching metadata for tool ${tool.id}:`, error);
                        }
                        
                        // Create the tool card HTML
                        const cardHtml = `
                            <div class="tool-integration-card">
                                <div class="tool-header">
                                    <div class="tool-info tool-tab-title">
                                        <div class="tool-logo" style="background: ${stringToColor(tool.name)}">
                                            ${firstLetter}
                                        </div>
                                        <h3>${tool.name}</h3>
                                    </div>
                                    <button class="btn-more" onclick="showToolMenu(event, '${tool.id}')">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                </div>
                                <p class="tool-description">${tool.description || 'No description available'}</p>
                                
                                <div>${connectorHtml}</div>
                                <div class="tool-tags tool-underline">
                                    ${(tool.tags || ['Dev-Tools']).map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        `;
                        
                        toolCards.push(cardHtml);
                    }
                    
                    // Update the grid with all tool cards
                    toolsGrid.innerHTML = toolCards.join('');
                    
                    // Add CSS for connector display if it doesn't exist
                    if (!document.getElementById('connector-styles')) {
                        const style = document.createElement('style');
                        style.id = 'connector-styles';
                        style.textContent = `
                            .tool-connector {
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                margin-bottom: 10px;
                                font-size: 0.85rem;
                                color: #4facfe;
                            }
                            .tool-connector i {
                                font-size: 0.9rem;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                });
        })
        .catch(error => {
            console.error("Error loading data connectors:", error);
            // Fall back to the regular tool loading without connector info
            return fetch('/api/tools')
                .then(response => response.json())
                .then(tools => {
                    const toolsGrid = document.getElementById('externalToolsGrid');
                    if (!toolsGrid) return;
                    
                    toolsGrid.innerHTML = tools.map(tool => {
                        const firstLetter = tool.name.charAt(0).toUpperCase();
                        return `
                            <div class="tool-integration-card">
                                <div class="tool-header">
                                    <div class="tool-info tool-tab-title">
                                        <div class="tool-logo" style="background: ${stringToColor(tool.name)}">
                                            ${firstLetter}
                                        </div>
                                        <h3>${tool.name}</h3>
                                    </div>
                                    <button class="btn-more" onclick="showToolMenu(event, '${tool.id}')">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                </div>
                                <p class="tool-description">${tool.description || 'No description available'}</p>
                                <div class="tool-tags tool-underline">
                                    ${(tool.tags || ['Dev-Tools']).map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        `;
                    }).join('');
                });
        });
}

function searchExternalTools(query) {
    const toolCards = document.querySelectorAll('.tool-integration-card');
    const searchQuery = query.toLowerCase();

    toolCards.forEach(card => {
        const toolName = card.querySelector('h3').textContent.toLowerCase();
        const toolDescription = card.querySelector('.tool-description').textContent.toLowerCase();
        const toolTags = Array.from(card.querySelectorAll('.tag'))
            .map(tag => tag.textContent.toLowerCase());

        const matches = toolName.includes(searchQuery) || 
                       toolDescription.includes(searchQuery) ||
                       toolTags.some(tag => tag.includes(searchQuery));

        card.style.display = matches ? '' : 'none';
    });
}

function refreshTools() {
    if (document.querySelector('.page.tools')) {
        loadExternalTools();
    } else {
        loadTools();
    }
}

function loadTools() {
    try {
        // First get all data connectors for later lookup
        fetch('/api/data-connectors')
            .then(response => response.json())
            .then(connectors => {
                // Create a map of connector IDs to names for quick lookup
                const connectorMap = {};
                connectors.forEach(connector => {
                    connectorMap[connector.id] = {
                        name: connector.uniqueName,
                        type: connector.connectorType
                    };
                });
                
                // Fetch only regular tools, skipping advanced tools
                fetch('/api/tools')
                    .then(response => response.json())
                    .then(async (normalTools) => {
                        const toolsGrid = document.querySelector('.tools-grid');
                        if (!toolsGrid) return;
        
                        // First, fetch metadata for all normal tools
                        const toolMetadataPromises = normalTools.map(tool =>
                            fetch(`/api/tools/${tool.id}/metadata`)
                                .then(response => response.json())
                                .catch(() => ({})) // Return empty object if metadata fetch fails
                        );
                        
                        const toolMetadataResults = await Promise.all(toolMetadataPromises);
                        
                        // Then render normal tools with connector info
                        let toolsHtml = normalTools.map((tool, index) => {
                            const isSelected = selectedTools.has(tool.id);
                            const firstLetter = tool.name.charAt(0).toUpperCase();
                            const metadata = toolMetadataResults[index];
                            const hasConnector = metadata && metadata.data_connector_id;
                            let connectorHtml = '';
                            
                            if (hasConnector) {
                                const connectorId = metadata.data_connector_id;
                                const connectorInfo = connectorMap[connectorId] || { name: 'Unknown', type: 'database' };
                                
                                connectorHtml = `
                                    <div class="connector-info">
                                        <i class="fas fa-database"></i>
                                        <span>Connected to ${connectorInfo.name} (${connectorInfo.type})</span>
                                    </div>
                                `;
                            }
                            
                            return `
                                <div class="tool-card ${isSelected ? 'selected' : ''}" data-tool-id="${tool.id}">
                                    <div class="tool-content">
                                        <div class="tool-header">
                                            <div class="tool-header-left">
                                                <div class="tool-icon" style="background: ${stringToColor(tool.name)}">
                                                    ${firstLetter}
                                                </div>
                                                <div class="tool-title">
                                                    <h3 class="tool-name">${tool.name}</h3>
                                                    ${hasConnector ? connectorHtml : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="tool-description">${tool.description || 'No description available'}</div>
                                        <div class="tool-tags">
                                            ${(tool.tags || ['Dev-Tools']).map(tag => `<span class="tag">${tag}</span>`).join('')}
                                        </div>
                                        <button class="view-btn" onclick="viewTool('${tool.id}')">View</button>
                                    </div>
                                    <div class="checkbox ${isSelected ? 'checked' : ''}" onclick="toggleTool('${tool.id}', event)">
                                        <i class="fas fa-check"></i>
                                    </div>
                                </div>
                            `;
                        }).join('');
        
                        // Advanced Tools section has been removed
        
                        toolsGrid.innerHTML = toolsHtml;
        
                        // Add CSS for connector info if it doesn't exist
                        if (!document.getElementById('connector-info-styles')) {
                            const style = document.createElement('style');
                            style.id = 'connector-info-styles';
                            style.textContent = `
                                .connector-info {
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    font-size: 0.85rem;
                                    color: #4facfe;
                                    margin-top: 4px;
                                }
                                .tool-title {
                                    display: flex;
                                    flex-direction: column;
                                }
                                .tool-header-left {
                                    display: flex;
                                    align-items: flex-start;
                                    gap: 10px;
                                }
                                .connector-info i {
                                    font-size: 0.9rem;
                                }
                            `;
                            document.head.appendChild(style);
                        }
        
                        // Add click event listeners for normal tools
                        toolsGrid.querySelectorAll('.tool-card').forEach(card => {
                            card.addEventListener('click', (event) => {
                                if (!event.target.closest('.checkbox') && !event.target.closest('.view-btn')) {
                                    const toolId = card.dataset.toolId;
                                    toggleTool(toolId, event);
                                }
                            });
                        });
                    });
            })
            .catch(error => {
                console.error("Error loading data connectors:", error);
                // Fall back to the original implementation without connector info
                loadToolsWithoutConnectors();
            });
    } catch (error) {
        console.error("Error in loadTools:", error);
        // Fall back to the original implementation without connector info
        loadToolsWithoutConnectors();
    }
}

// Fallback function if data connectors can't be loaded
function loadToolsWithoutConnectors() {
    // Fetch only regular tools
    fetch('/api/tools')
        .then(response => response.json())
        .then(normalTools => {
            const toolsGrid = document.querySelector('.tools-grid');
            if (!toolsGrid) return;

            // Render tools without connector info
            let toolsHtml = normalTools.map(tool => {
                const isSelected = selectedTools.has(tool.id);
                const firstLetter = tool.name.charAt(0).toUpperCase();
                return `
                    <div class="tool-card ${isSelected ? 'selected' : ''}" data-tool-id="${tool.id}">
                        <div class="tool-content">
                            <div class="tool-header">
                                <div class="tool-header-left">
                                    <div class="tool-icon" style="background: ${stringToColor(tool.name)}">
                                        ${firstLetter}
                                    </div>
                                    <h3 class="tool-name">${tool.name}</h3>
                                </div>
                            </div>
                            <div class="tool-description">${tool.description || 'No description available'}</div>
                            <div class="tool-tags">
                                ${(tool.tags || ['Dev-Tools']).map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>
                            <button class="view-btn" onclick="viewTool('${tool.id}')">View</button>
                        </div>
                        <div class="checkbox ${isSelected ? 'checked' : ''}" onclick="toggleTool('${tool.id}', event)">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                `;
            }).join('');

            // Advanced Tools section removed

            toolsGrid.innerHTML = toolsHtml;

            // Add click event listeners for normal tools
            toolsGrid.querySelectorAll('.tool-card').forEach(card => {
                card.addEventListener('click', (event) => {
                    if (!event.target.closest('.checkbox') && !event.target.closest('.view-btn')) {
                        const toolId = card.dataset.toolId;
                        toggleTool(toolId, event);
                    }
                });
            });
        });
}

// Add toggle function for advanced tools section
function toggleAdvancedTools() {
    const header = document.querySelector('.advanced-tools-header');
    const grid = document.querySelector('.advanced-tools-grid');
    const isExpanded = header.classList.contains('expanded');

    if (isExpanded) {
        header.classList.remove('expanded');
        grid.style.display = 'none';
    } else {
        header.classList.add('expanded');
        grid.style.display = 'grid';
    }
}

function searchTools(query) {
    const toolCards = document.querySelectorAll('.tool-integration-card');
    const searchQuery = query.toLowerCase();

    toolCards.forEach(card => {
        const toolName = card.querySelector('h3').textContent.toLowerCase();
        const toolDescription = card.querySelector('.tool-description').textContent.toLowerCase();
        const toolTags = Array.from(card.querySelectorAll('.tag'))
            .map(tag => tag.textContent.toLowerCase());

        const matches = toolName.includes(searchQuery) || 
                       toolDescription.includes(searchQuery) ||
                       toolTags.some(tag => tag.includes(searchQuery));

        card.style.display = matches ? 'block' : 'none';
    });
}

async function addTool(toolId) {
    try {
        const response = await fetch('/api/tools/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tool_id: toolId })
        });

        if (response.ok) {
            const button = document.querySelector(`[onclick="addTool('${toolId}')"]`);
            button.textContent = 'Added';
            button.disabled = true;
            button.style.background = '#2563EB';
            button.style.borderColor = '#2563EB';
        } else {
            console.error('Failed to add tool');
        }
    } catch (error) {
        console.error('Error adding tool:', error);
    }
}

function saveAgent() {
    // --- Field Validation --- 
    const requiredFields = {
        'agentName': 'Agent Name',
        'agentDescription': 'Description',
        'agentRole': 'Role',
        'agentGoal': 'Goal',
        'expectedOutput': 'Expected Output',
        'agentBackstory': 'Backstory',
        'agentInstructions': 'Instructions',
        'llmProvider': 'LLM Provider',
        'llmModel': 'LLM Model',
        'apiKey': 'API Key'
    };

    for (const id in requiredFields) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Validation Error: Element with ID '${id}' not found.`);
            alert(`An error occurred. Could not find field: ${requiredFields[id]}`);
            return; // Stop if a field element is unexpectedly missing
        }
        // Check if the trimmed value is empty
        if (element.value.trim() === '') {
            alert(`${requiredFields[id]} is required.`);
            element.focus(); 
            return; // Stop the save process
        }
    }
    // --- End Validation ---

    const agentData = {
        name: document.getElementById('agentName').value,
        description: document.getElementById('agentDescription').value,
        llmProvider: document.getElementById('llmProvider').value,
        llmModel: document.getElementById('llmModel').value,
        apiKey: document.getElementById('apiKey').value,
        role: document.getElementById('agentRole').value,
        goal: document.getElementById('agentGoal').value,
        expectedOutput: document.getElementById('expectedOutput').value,
        backstory: document.getElementById('agentBackstory').value,
        instructions: document.getElementById('agentInstructions').value,
        verbose: document.getElementById('managerAgent').checked,
        tools: Array.from(selectedTools),
        advanced_tools: Array.from(selectedAdvancedTools), // Changed from advancedTools to advanced_tools
        features: {
            knowledgeBase: document.getElementById('knowledgeBase').checked,
            dataQuery: document.getElementById('dataQuery').checked
        }
    };

    console.log("Saving agent data:", JSON.stringify(agentData, null, 2));

    const method = selectedAgentId ? 'PUT' : 'POST';
    const url = selectedAgentId ? `/api/agents/${selectedAgentId}` : '/api/agents';

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to save agent');
        return response.json();
    })
    .then(() => {
        selectedAgentId = null;
        selectedTools.clear();
        selectedAdvancedTools.clear();
        loadPage('agents'); // Changed from loadPage('/agents') to match argument style
    })
    .catch(error => {
        console.error('Error saving agent:', error);
        alert('Failed to save agent. Please try again.');
    });
}

function editAgent(agentId) {
    selectedAgentId = agentId;
    showLoading("Please wait..");
    fetch(`/api/agents/${agentId}`)
        .then(response => response.json())
        .then(agent => {
            hideLoading();
            
            console.log("Agent data received from server:", JSON.stringify(agent, null, 2));
            
            // Load the create-agent page with edit parameter
            loadPage('create-agent?edit=true');

            // Show loading indicator
            showLoading("Please wait..");

            // Function to update UI with retry mechanism
            function updateUI(retries = 5, delay = 200) {
                setTimeout(() => {
                    const pageHeader = document.querySelector('.page-header h1');
                    const buildButton = document.querySelector('.build-section .btn-primary');
                    const buttonText = document.getElementById('buttonText');

                    // Check if all required elements are present
                    if (buildButton && pageHeader && buttonText) {
                        // Hide loader once elements are found
                        hideLoading();

                        // Update UI elements
                        pageHeader.textContent = agent.name;
                        buildButton.textContent = 'Save';
                        buttonText.textContent = 'Save';

                        // Fill form fields
                        document.getElementById('agentName').value = agent.name;
                        document.getElementById('agentDescription').value = agent.description;
                        document.getElementById('llmProvider').value = agent.llmProvider;
                        document.getElementById('llmModel').value = agent.llmModel;
                        document.getElementById('apiKey').value = agent.apiKey;
                        document.getElementById('agentRole').value = agent.role;
                        document.getElementById('agentGoal').value = agent.goal || '';
                        document.getElementById('expectedOutput').value = agent.expectedOutput || '';
                        document.getElementById('agentBackstory').value = agent.backstory || '';
                        document.getElementById('agentInstructions').value = agent.instructions;
                        document.getElementById('managerAgent').checked = agent.verbose;
                        document.getElementById('knowledgeBase').checked = agent.features.knowledgeBase;
                        document.getElementById('dataQuery').checked = agent.features.dataQuery;

                        // Clear any existing selected tools
                        selectedTools.clear();
                        selectedAdvancedTools.clear();
                        
                        // Set selected tools and advanced tools
                        if (Array.isArray(agent.tools)) {
                            agent.tools.forEach(toolId => selectedTools.add(toolId));
                        }
                        
                        // Handle both formats (advancedTools or advanced_tools) for backward compatibility
                        if (Array.isArray(agent.advanced_tools)) {
                            agent.advanced_tools.forEach(toolId => selectedAdvancedTools.add(toolId));
                        } else if (Array.isArray(agent.advancedTools)) {
                            agent.advancedTools.forEach(toolId => selectedAdvancedTools.add(toolId));
                        }
                        
                        console.log("Selected tools:", Array.from(selectedTools));
                        console.log("Selected advanced tools:", Array.from(selectedAdvancedTools));
                        
                        // Load tools with the selections
                        loadTools();
                    } else if (retries > 0) {
                        // Retry with increased delay if elements aren't found
                        updateUI(retries - 1, delay * 2);
                    } else {
                        // Hide loader and show error if retries are exhausted
                        hideLoading();
                        console.error('Failed to find required DOM elements after retries');
                        const app = document.getElementById('app');
                        if (app) {
                            app.innerHTML = '<p>Failed to load agent editor. Please try again.</p>';
                        }
                    }
                }, delay);
            }

            // Start the update process
            updateUI();
        })
        .catch(error => {
            // Hide loader and handle fetch errors
            hideLoading();
            console.error('Error in editAgent:', error);
            const app = document.getElementById('app');
            if (app) {
                app.innerHTML = '<p>Failed to load agent data. Please try again.</p>';
            }
        });
}

function deleteAgent(agentId) {
    if (confirm('Are you sure you want to delete this agent?')) {
        showLoading("Checking agent usage...");
        
        // First check if the agent is used in any multi-agent configuration
        fetch('/api/multi-agents')
            .then(response => response.json())
            .then(multiAgents => {
                // Check if this agent is used in any multi-agent configuration
                const isUsedInMultiAgent = multiAgents.some(ma => 
                    Array.isArray(ma.agent_ids) && ma.agent_ids.includes(agentId)
                );
                
                if (isUsedInMultiAgent) {
                    hideLoading();
                    // Show error message
                    const toast = document.createElement('div');
                    toast.className = 'toast error';
                    toast.innerHTML = '<i class="fas fa-exclamation-circle"></i> Cannot delete this agent because it is used in one or more multi-agent configurations. Remove it from all multi-agents first.';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 5000);
                    return;
                }
                
                // If not used in any multi-agent, proceed with deletion
                return fetch(`/api/agents/${agentId}`, {
            method: 'DELETE'
                });
        })
            .then(response => {
                if (response && response.ok) {
            hideLoading();
            loadAgents();
                    
                    // Show success message
                    const toast = document.createElement('div');
                    toast.className = 'toast success';
                    toast.innerHTML = '<i class="fas fa-check-circle"></i> Agent deleted successfully';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 3000);
                }
        })
        .catch(error => {
            hideLoading();
            console.error('Error deleting agent:', error);
                
                // Show error message
                const toast = document.createElement('div');
                toast.className = 'toast error';
                toast.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to delete agent';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
        });
    }
}

function toggleTool(toolId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    if (selectedTools.has(toolId)) {
        selectedTools.delete(toolId);
    } else {
        selectedTools.add(toolId);
    }
    
    // Update UI - find the tool card using data attribute (either normal or advanced)
    const toolCard = document.querySelector(`.tool-card[data-tool-id="${toolId}"]`);
    if (toolCard) {
        const isSelected = selectedTools.has(toolId);
        toolCard.classList.toggle('selected', isSelected);
        const checkbox = toolCard.querySelector('.checkbox');
        if (checkbox) {
            checkbox.classList.toggle('checked', isSelected);
        }
    }
}

function toggleAdvancedTool(toolId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    console.log(`Toggling advanced tool: ${toolId}`);
    
    if (selectedAdvancedTools.has(toolId)) {
        selectedAdvancedTools.delete(toolId);
        console.log(`Removed tool: ${toolId}`);
    } else {
        selectedAdvancedTools.add(toolId);
        console.log(`Added tool: ${toolId}`);
    }
    
    // Update UI for advanced tools
    const toolCard = document.querySelector(`.advanced-tool-card[data-tool-id="${toolId}"]`);
    if (toolCard) {
        const isSelected = selectedAdvancedTools.has(toolId);
        console.log(`Setting selected state to: ${isSelected}`);
        
        toolCard.classList.toggle('selected', isSelected);
        const checkbox = toolCard.querySelector('.checkbox');
        if (checkbox) {
            checkbox.classList.toggle('checked', isSelected);
        }
    } else {
        console.error(`Could not find advanced tool card for ID: ${toolId}`);
    }
}

// Profile dropdown functionality
function initializeProfileDropdown() {
    const profileBtn = document.querySelector('.profile-btn');
    const profileMenu = document.querySelector('.profile-menu');

    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
                profileMenu.classList.remove('show');
            }
        });
    }
}

// Notifications API handling
const NotificationsAPI = {
    async getNotifications() {
        try {
            const response = await fetch('/api/notifications');
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    },

    async markAsRead(notificationId) {
        try {
            showLoading("Please wait..");
            const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('Failed to mark notification as read');
            }
            hideLoading();
            const data = await response.json();
            return { success: true };
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return { success: false };
        }
    },

    async markAllAsRead() {
        try {
            showLoading("Please wait..");
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('Failed to mark all notifications as read');
            }
            hideLoading();
            const data = await response.json();
            return { success: true };
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return { success: false };
        }
    }
};

// Notifications functionality
let notifications = [];

async function fetchNotifications() {
    try {
        notifications = await NotificationsAPI.getNotifications();
        updateNotificationBadge();
        renderNotifications();
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderNotifications() {
    const notificationsList = document.querySelector('.notifications-list');
    if (!notificationsList) return;

    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }

    notificationsList.innerHTML = notifications
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(notification => `
            <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon ${notification.type || 'info'}">
                    <i class="fas ${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <p>${notification.message}</p>
                    <div class="notification-time">${formatNotificationTime(notification.timestamp)}</div>
                </div>
            </div>
        `).join('');
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check';
        case 'warning': return 'fa-exclamation-triangle';
        case 'error': return 'fa-times-circle';
        default: return 'fa-info-circle';
    }
}

function formatNotificationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    }
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    // More than 24 hours
    return date.toLocaleDateString();
}

function initializeNotifications() {
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationsMenu = document.querySelector('.notifications-menu');
    const markAllReadBtn = document.querySelector('.mark-all-read');

    if (notificationBtn && notificationsMenu) {
        // Fetch notifications when initialized
        fetchNotifications();

        // Refresh notifications every 5 minutes
        setInterval(fetchNotifications, 5 * 60 * 1000);

        // Toggle notifications menu
        notificationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            notificationsMenu.classList.toggle('show');
            
            // Fetch latest notifications when opening the menu
            if (notificationsMenu.classList.contains('show')) {
                fetchNotifications();
            }
        });

        // Close notifications when clicking outside
        document.addEventListener('click', function(e) {
            if (!notificationsMenu.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationsMenu.classList.remove('show');
            }
        });

        // Handle mark all as read
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async function() {
                const result = await NotificationsAPI.markAllAsRead();
                if (result.success) {
                    notifications.forEach(n => n.read = true);
                    updateNotificationBadge();
                    renderNotifications();
                }
            });
        }

        // Handle individual notification clicks
        notificationsMenu.addEventListener('click', async function(e) {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem && !notificationItem.classList.contains('read')) {
                const notificationId = notificationItem.dataset.id;
                const result = await NotificationsAPI.markAsRead(notificationId);
                if (result.success) {
                    const notification = notifications.find(n => n.id === notificationId);
                    if (notification) {
                        notification.read = true;
                        updateNotificationBadge();
                        renderNotifications();
                    }
                }
            }
        });
    }
}

function searchAgentTools(query) {
    const toolCards = document.querySelectorAll('#availableTools .tool-card');
    const searchQuery = query.toLowerCase().trim();

    toolCards.forEach(card => {
        const name = card.querySelector('.tool-name').textContent.toLowerCase();
        const description = card.querySelector('.tool-description').textContent.toLowerCase();
        const tags = Array.from(card.querySelectorAll('.tag')).map(tag => tag.textContent.toLowerCase());

        const matches = name.includes(searchQuery) || 
                       description.includes(searchQuery) || 
                       tags.some(tag => tag.includes(searchQuery));

        card.style.display = matches ? 'flex' : 'none';
    });
}

// --- Multi-Agent Connectors Page Functions ---

let allMultiAgents = []; // Store fetched multi-agents for searching
let allAvailableAgents = []; // Store fetched agents for selection

function initializeMultiAgentPage() {
    console.log('Initializing Multi-Agent page...');
    loadMultiAgents();
    setupMultiAgentEventListeners();
    loadAvailableAgentsForModal(); // Pre-load agents for the modal
}

function setupMultiAgentEventListeners() {
    const createBtn = document.getElementById('createMultiAgentBtn');
    const refreshBtn = document.getElementById('refreshMultiAgentsBtn');
    const searchInput = document.getElementById('searchMultiAgentsInput');
    const modal = document.getElementById('multiAgentModal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const cancelModalBtn = modal.querySelector('.cancel-btn');
    const form = document.getElementById('multiAgentForm');

    if (createBtn && !createBtn.dataset.listenerAttached) {
        createBtn.addEventListener('click', showCreateMultiAgentModal);
        createBtn.dataset.listenerAttached = 'true';
    }
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
        refreshBtn.addEventListener('click', loadMultiAgents);
        refreshBtn.dataset.listenerAttached = 'true';
    }
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.addEventListener('input', (e) => searchMultiAgents(e.target.value));
        searchInput.dataset.listenerAttached = 'true';
    }
    if (closeModalBtn && !closeModalBtn.dataset.listenerAttached) {
        closeModalBtn.addEventListener('click', closeMultiAgentModal);
        closeModalBtn.dataset.listenerAttached = 'true';
    }
    if (cancelModalBtn && !cancelModalBtn.dataset.listenerAttached) {
        cancelModalBtn.addEventListener('click', closeMultiAgentModal);
        cancelModalBtn.dataset.listenerAttached = 'true';
    }
    if (form && !form.dataset.listenerAttached) {
        form.addEventListener('submit', handleMultiAgentFormSubmit);
        form.dataset.listenerAttached = 'true';
    }

    // Add event listener for clicks outside the modal to close it
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeMultiAgentModal();
        }
    });

    // Removed event delegation for dynamically added elements (edit/delete buttons)
}

async function loadMultiAgents() {
    console.log("=============================================");
    console.log("STARTING loadMultiAgents FUNCTION");
    const multiAgentList = document.getElementById('multiAgentList');
    if (!multiAgentList) {
        console.error("Multi-agent list container not found!");
        return;
    }
    console.log("multiAgentList element found:", multiAgentList);
    
    multiAgentList.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading Multi-Agents...</div>';
    console.log("Loading placeholder added");

    let fetchedMultiAgents = [];
    let agentMap = {};

    try {
        // Fetch multi-agents
        console.log("Attempting to fetch /api/multi-agents endpoint...");
        const response = await fetch('/api/multi-agents');
        console.log("API Response status:", response.status);
        console.log("API Response headers:", [...response.headers.entries()]);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch multi-agents:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log("Raw API response data:", responseData);
        
        fetchedMultiAgents = responseData;
        console.log("Fetched Multi-Agents:", fetchedMultiAgents);
        allMultiAgents = fetchedMultiAgents; // Update global store

        // Fetch all single agents to get details like names
        console.log("Fetching /api/agents...");
        const agentResponse = await fetch('/api/agents');
        if (!agentResponse.ok) {
             console.error('Failed to fetch agents:', agentResponse.status, await agentResponse.text());
            throw new Error(`HTTP error fetching agents! status: ${agentResponse.status}`);
        }
        const allAgents = await agentResponse.json();
        console.log("Fetched Agents:", allAgents);
        agentMap = allAgents.reduce((map, agent) => {
            if (agent && agent.id) { // Add check for valid agent object
                 map[agent.id] = agent; // Map agent ID to agent object
            }
            return map;
        }, {});
        console.log("Created Agent Map:", agentMap);

        // Render using fetched data
        console.log("Calling renderMultiAgents with:", fetchedMultiAgents, agentMap);
        renderMultiAgents(fetchedMultiAgents, agentMap);
        console.log("Rendering completed");

    } catch (error) {
        console.error("Error loading multi-agents data:", error);
        multiAgentList.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Failed to load multi-agents. Please check the console and try refreshing.</div>';
    }
    console.log("loadMultiAgents FUNCTION COMPLETED");
    console.log("=============================================");
}

function renderMultiAgents(multiAgentsToRender, agentDetailMap) {
    const multiAgentList = document.getElementById('multiAgentList');
     if (!multiAgentList) {
        console.error("Cannot render: Multi-agent list container not found!");
        return;
    }
    console.log("Rendering multi-agents with:", multiAgentsToRender, agentDetailMap);

    if (!Array.isArray(multiAgentsToRender) || multiAgentsToRender.length === 0) {
        multiAgentList.innerHTML = `
            <div class="empty-state">
                <img src="/static/images/ufo-illustration.svg" alt="No multi-agents found" class="empty-illustration">
                <h2>No Multi-Agents configured yet</h2>
                <button class="btn-primary" id="createEmptyStateBtn">
                    + Create New
                </button>
            </div>
        `;
        // Add event listener for the create button in empty state
        const createEmptyStateBtn = document.getElementById('createEmptyStateBtn');
        if (createEmptyStateBtn) {
            createEmptyStateBtn.addEventListener('click', showCreateMultiAgentModal);
        }
        return;
    }

    multiAgentList.innerHTML = multiAgentsToRender.map(ma => {
        // Defensive checks for multi-agent structure
        const multiAgentId = ma && ma.id ? ma.id : 'unknown-' + Math.random();
        const multiAgentName = ma && ma.name ? ma.name : 'Unnamed Multi-Agent';
        const multiAgentDesc = ma && ma.description ? ma.description : 'No description provided.';
        const agentIds = (ma && Array.isArray(ma.agent_ids)) ? ma.agent_ids : [];

        // Get the names of connected agents
        const connectedAgents = agentIds.map(id => {
            const agent = agentDetailMap[id];
            return agent ? agent.name : 'Unknown Agent';
        });

        const connectedAgentsList = connectedAgents.length > 0 
            ? connectedAgents.map(name => `<span class="agent-tag">${name}</span>`).join('') 
            : '<span class="no-agents">No agents connected</span>';
        
        // Generate a gradient background for the card based on the agent's name
        const gradientColor = stringToGradient(multiAgentName);

        return `
            <div class="agent-card multi-agent-card" data-id="${multiAgentId}">
                <div class="card-highlight" style="background: ${gradientColor}"></div>
                <div class="agent-card-header">
                    <div class="agent-info">
                        <div class="agent-icon">
                            <i class="fas fa-project-diagram"></i>
                        </div>
                        <div class="agent-details">
                            <h3>${multiAgentName}</h3>
                            <p>${multiAgentDesc}</p>
                        </div>
                    </div>
                </div>
                <div class="multi-agent-card-content">
                    <div class="connected-agents-container">
                        <h4>Connected Agents:</h4>
                        <div class="connected-agents-list">
                            ${connectedAgentsList}
                        </div>
                    </div>
                    <div class="magent-stats">
                        <div class="stat-left">
                            <span class="stat-label">Status</span>
                            <span class="stat-value"><i class="fas fa-circle status-active"></i> Active</span>
                        </div>
                        <div class="stat-right">
                            <span class="stat-label">Agents</span>
                            <span class="stat-value">${agentIds.length}</span>
                        </div>
                    </div>
                    <div class="multi-agent-actions">
                        <button class="btn-launch-multi-agent" onclick="launchMultiAgent('${multiAgentId}')">
                            <i class="fas fa-play"></i> Launch
                        </button>
                        <button class="btn-clone-multi-agent" onclick="cloneMultiAgent('${multiAgentId}')">
                            <i class="fas fa-copy"></i> Clone
                        </button>
                        <button class="btn-edit-multi-agent" onclick="editMultiAgentAction('${multiAgentId}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete-multi-agent" onclick="deleteMultiAgentAction('${multiAgentId}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add CSS for the multi-agent cards
    if (!document.getElementById('multi-agent-cards-style')) {
        const style = document.createElement('style');
        style.id = 'multi-agent-cards-style';
        style.textContent = `
            .multi-agent-card {
                position: relative;
                background: linear-gradient(145deg, #141b2d, #1a2035);
                border: 1px solid rgba(99, 179, 237, 0.15);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            
            .multi-agent-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            }
            
            .multi-agent-card .card-highlight {
                position: absolute;
                top: 0;
                left: 0;
                height: 4px;
                width: 100%;
                background: linear-gradient(90deg, #3182ce, #63b3ed);
            }
            
            .multi-agent-card .agent-icon {
                background: linear-gradient(135deg, #4299e1, #3182ce);
                color: white;
                box-shadow: 0 4px 10px rgba(66, 153, 225, 0.3);
            }
            
            .connected-agents-container {
                margin-bottom: 15px;
            }
            
            .connected-agents-container h4 {
                font-size: 14px;
                margin-bottom: 10px;
                color: rgba(255, 255, 255, 0.7);
                font-weight: normal;
            }
            
            .connected-agents-list {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            
            .agent-tag {
                background: rgba(66, 153, 225, 0.15);
                border: 1px solid rgba(66, 153, 225, 0.2);
                color: rgba(255, 255, 255, 0.9);
                border-radius: 12px;
                padding: 3px 10px;
                font-size: 12px;
                white-space: nowrap;
            }
            
            .no-agents {
                color: rgba(255, 255, 255, 0.5);
                font-style: italic;
                font-size: 12px;
            }
            
            .status-active {
                color: #48BB78;
                font-size: 10px;
                margin-right: 4px;
            }
            
            .magent-stats {
                display: flex;
                justify-content: space-between;
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .stat-label {
                display: block;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 4px;
            }
            
            .stat-value {
                font-size: 14px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
            }
            
            .multi-agent-actions {
                display: flex;
                gap: 10px;
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                flex-wrap: wrap;
            }
            
            .btn-edit-multi-agent,
            .btn-delete-multi-agent,
            .btn-clone-multi-agent,
            .btn-launch-multi-agent {
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s ease;
            }
            
            .btn-edit-multi-agent {
                background-color: rgba(66, 153, 225, 0.2);
                color: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(66, 153, 225, 0.3);
            }
            
            .btn-edit-multi-agent:hover {
                background-color: rgba(66, 153, 225, 0.3);
                transform: translateY(-2px);
            }
            
            .btn-clone-multi-agent {
                background-color: rgba(139, 92, 246, 0.2);
                color: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(139, 92, 246, 0.3);
            }
            
            .btn-clone-multi-agent:hover {
                background-color: rgba(139, 92, 246, 0.3);
                transform: translateY(-2px);
            }
            
            .btn-launch-multi-agent {
                background-color: rgba(72, 187, 120, 0.2);
                color: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(72, 187, 120, 0.3);
            }
            
            .btn-launch-multi-agent:hover {
                background-color: rgba(72, 187, 120, 0.3);
                transform: translateY(-2px);
            }
            
            .btn-delete-multi-agent {
                background-color: rgba(229, 62, 62, 0.2);
                color: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(229, 62, 62, 0.3);
                margin-left: auto;
            }
            
            .btn-delete-multi-agent:hover {
                background-color: rgba(229, 62, 62, 0.3);
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
    }
}

// Helper function to generate a gradient based on string input
function stringToGradient(str) {
    // Generate a hash from the input string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate two distinct hues
    const hue1 = hash % 360;
    const hue2 = (hash * 7) % 360; // Use a multiplier to get a different but related hue
    
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`;
}

function searchMultiAgents(query) {
    const searchQuery = query.toLowerCase().trim();
    const filteredMultiAgents = allMultiAgents.filter(ma => {
        const nameMatch = ma.name.toLowerCase().includes(searchQuery);
        const descriptionMatch = (ma.description || '').toLowerCase().includes(searchQuery);
        // You could also add search by connected agent names if needed
        return nameMatch || descriptionMatch;
    });

    // Re-fetch agent map or pass it if stored globally/higher scope
    fetch('/api/agents').then(r => r.json()).then(allAgents => {
         const agentMap = allAgents.reduce((map, agent) => {
            map[agent.id] = agent; return map;
        }, {});
        renderMultiAgents(filteredMultiAgents, agentMap);
    });
}

async function loadAvailableAgentsForModal() {
    try {
        const response = await fetch('/api/agents');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allAvailableAgents = await response.json(); // Store globally
        populateAgentSelectionList(allAvailableAgents);
    } catch (error) {
        console.error("Error loading available agents:", error);
        const agentSelectionList = document.getElementById('agentSelectionList');
        agentSelectionList.innerHTML = '<p class="error-message">Failed to load agents.</p>';
    }
}

function populateAgentSelectionList(agents, selectedAgentIds = []) {
    const agentSelectionList = document.getElementById('agentSelectionList');
    if (!agentSelectionList) {
        console.error('Agent selection list container not found in modal!');
        return;
    }

    // First, add the central manager node and clear existing arrows
    let centralNode = agentSelectionList.querySelector('.central-agent-node');
    if (!centralNode) {
        centralNode = document.createElement('div');
        centralNode.className = 'central-agent-node';
        centralNode.innerHTML = '<i class="fas fa-brain"></i>';
        agentSelectionList.appendChild(centralNode);
    }
    
    // Clear any existing arrows
    agentSelectionList.querySelectorAll('.agent-arrow').forEach(arrow => arrow.remove());

    if (!Array.isArray(agents) || agents.length === 0) {
        agentSelectionList.innerHTML = '<p class="empty-state">No agents available to connect.</p>';
        return;
    }

    agentSelectionList.innerHTML = `
        <div class="central-agent-node">
            <i class="fas fa-brain"></i>
                    </div>
        <div class="central-node-label">Manager Agent</div>
    ` + agents.map(agent => {
        // Basic check for agent data validity
        const agentId = agent && agent.id ? agent.id : 'invalid-' + Math.random();
        const agentName = agent && agent.name ? agent.name : 'Unnamed Agent';
        const agentDesc = agent && agent.description ? agent.description : 'No description';
        const agentModel = agent && agent.llmModel ? agent.llmModel : 'Unknown Model';
        const agentProvider = agent && agent.llmProvider ? agent.llmProvider : 'Unknown Provider';
        const isChecked = selectedAgentIds.includes(agentId);

        // Generate a consistent color for the agent icon based on the name
        const iconColor = stringToGradient(agentName);

        // Note: ID for label/input needs to be unique
        const checkboxId = `agent-select-${agentId}`;

        return `
        <div class="agent-selection-item ${isChecked ? 'selected' : ''}" data-agent-id="${agentId}">
            <input type="checkbox" id="${checkboxId}" name="selectedAgents" value="${agentId}" ${isChecked ? 'checked' : ''}>
            <label for="${checkboxId}" class="agent-selection-card">
                <div class="agent-card-header">
                    <div class="agent-icon" style="background: ${iconColor}">
                        <i class="fas fa-robot"></i>
                </div>
                    <div class="agent-header-content">
                        <div class="agent-name">${agentName}</div>
                    </div>
                </div>
                <div class="multi-agent-selection-content">
                    <div class="agent-description">${agentDesc}</div>
                    <div class="agent-meta">
                        <div class="agent-model">
                            <i class="fas fa-microchip"></i> ${agentModel}
                        </div>
                        <div class="agent-provider">
                            ${capitalizeFirstLetter(agentProvider)}
                        </div>
                    </div>
                </div>
            </label>
                </div>
            `;
    }).join('');

    // Get the central node again after HTML was updated
    centralNode = agentSelectionList.querySelector('.central-agent-node');

    // Add direct click event listeners to each card
    agentSelectionList.querySelectorAll('.agent-selection-item').forEach(item => {
        // Make the cards directly clickable
        item.addEventListener('click', (event) => {
            // Don't process click if it was on the checkbox (let default behavior happen)
            if (event.target.tagName === 'INPUT') {
                return;
            }
            
            // Prevent default for label clicks to avoid double-toggling
            if (event.target.tagName === 'LABEL' || event.target.closest('label')) {
                event.preventDefault();
            }
            
            event.stopPropagation();
            
            // Get the checkbox
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                // Toggle the checkbox
                checkbox.checked = !checkbox.checked;
                
                // Update the visual state
                item.classList.toggle('selected', checkbox.checked);
                
                console.log(`Card clicked: ${item.dataset.agentId}, checked: ${checkbox.checked}`);
                
                // Trigger the change event to update arrows and other UI
                checkbox.dispatchEvent(new Event('change'));
            }
        });
    });

    // Add event listeners for checkbox changes (separate from click)
    agentSelectionList.querySelectorAll('.agent-selection-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const agentItem = this.closest('.agent-selection-item');
            
            // Toggle the selected class based on checkbox state
            agentItem.classList.toggle('selected', this.checked);
            
            // Update arrows for all selected agents
            updateAgentArrows(agentSelectionList);
        });
    });

    // Initial arrows update for pre-selected agents
    setTimeout(() => updateAgentArrows(agentSelectionList), 100);
}

// Function to update the connection arrows between selected agents and the central node
function updateAgentArrows(container) {
    // Remove existing arrows
    container.querySelectorAll('.agent-arrow').forEach(arrow => arrow.remove());
    
    const centralNode = container.querySelector('.central-agent-node');
    const selectedAgents = container.querySelectorAll('.agent-selection-item.selected');
    
    // If no selected agents, hide the central node
    if (selectedAgents.length === 0) {
        centralNode.classList.remove('visible');
        return;
    }
    
    // Show the central node if there are any selected agents
    centralNode.classList.add('visible');
    
    // Calculate central node position, accounting for scroll
    const centralRect = centralNode.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    
    const centralX = centralRect.left + centralRect.width/2 - containerRect.left;
    const centralY = centralRect.top + centralRect.height/2 - containerRect.top + scrollTop;
    
    // Create arrows for each selected agent
    selectedAgents.forEach(agent => {
        const agentRect = agent.getBoundingClientRect();
        
        // Calculate agent center position relative to container, accounting for scroll
        const agentX = agentRect.left + agentRect.width/2 - containerRect.left + scrollLeft;
        const agentY = agentRect.top + agentRect.height/2 - containerRect.top + scrollTop;
        
        // Calculate distance and angle
        const dx = centralX - agentX;
        const dy = centralY - agentY;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Create arrow element
        const arrow = document.createElement('div');
        arrow.className = 'agent-arrow';
        
        // Position and rotate the arrow
        arrow.style.left = `${agentX}px`;
        arrow.style.top = `${agentY}px`;
        arrow.style.width = `${distance - 50}px`; // Adjust length to not overlap with central node
        arrow.style.transform = `rotate(${angle}deg)`;
        
        // Add arrow with animation delay
        container.appendChild(arrow);
        
        // Trigger animation
    setTimeout(() => {
            arrow.style.opacity = '1';
        }, 50);
    });
    
    // Add scroll event listener to update arrows when scrolling
    container.onscroll = function() {
        // Debounce the scroll event to improve performance
        clearTimeout(container.scrollTimer);
        container.scrollTimer = setTimeout(() => {
            updateAgentArrows(container);
        }, 100);
    };
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function showCreateMultiAgentModal() {
    const modal = document.getElementById('multiAgentModal');
    document.getElementById('modalTitle').textContent = 'Create New Multi-Agent';
    document.getElementById('multiAgentForm').reset();
    document.getElementById('multiAgentId').value = ''; // Clear hidden ID field
    populateAgentSelectionList(allAvailableAgents); // Populate with all agents, none selected
    modal.style.display = 'block';
}

function showEditMultiAgentModal(multiAgent) {
    const modal = document.getElementById('multiAgentModal');
    document.getElementById('modalTitle').textContent = 'Edit Multi-Agent';
    document.getElementById('multiAgentId').value = multiAgent.id;
    document.getElementById('multiAgentName').value = multiAgent.name;
    document.getElementById('multiAgentDescription').value = multiAgent.description;
    // Populate new fields, using defaults if not present
    document.getElementById('multiAgentRole').value = multiAgent.role || 'Coordinator'; 
    document.getElementById('multiAgentGoal').value = multiAgent.goal || ''; 
    document.getElementById('multiAgentBackstory').value = multiAgent.backstory || ''; 
    document.getElementById('multiAgentExpectedOutput').value = multiAgent.expected_output || ''; // Populate expected output
    
    // Populate agent list and check the ones that are part of this multi-agent
    populateAgentSelectionList(allAvailableAgents, multiAgent.agent_ids || []);
    modal.style.display = 'block';
}

function closeMultiAgentModal() {
    const modal = document.getElementById('multiAgentModal');
    modal.style.display = 'none';
    document.getElementById('multiAgentForm').reset(); // Reset form on close
}

async function handleMultiAgentFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const multiAgentId = form.querySelector('#multiAgentId').value;
    const name = form.querySelector('#multiAgentName').value.trim();
    const description = form.querySelector('#multiAgentDescription').value.trim();
    const role = form.querySelector('#multiAgentRole').value.trim(); // Get role
    const goal = form.querySelector('#multiAgentGoal').value.trim(); // Get goal
    const backstory = form.querySelector('#multiAgentBackstory').value.trim(); // Get backstory
    const expected_output = form.querySelector('#multiAgentExpectedOutput').value.trim(); // Get expected output
    const selectedAgentCheckboxes = form.querySelectorAll('input[name="selectedAgents"]:checked');
    const agent_ids = Array.from(selectedAgentCheckboxes).map(cb => cb.value);

    if (!name || !description) {
        alert('Name and Description are required.');
        return;
    }
    if (!expected_output) { // Validate expected output
        alert('Expected Output is required.');
        return;
    }
    if (agent_ids.length === 0) {
        alert('Please select at least one agent to connect.');
        return;
    }

    // Include new fields in the data payload
    const multiAgentData = { 
        name,
        description,
        agent_ids,
        role: role || "Coordinator", // Default if empty
        goal: goal || "Efficiently manage and delegate tasks.", // Default if empty
        backstory: backstory || "Orchestrator for connected agents.", // Default if empty
        expected_output // Add expected output
    };

    const url = multiAgentId ? `/api/multi-agents/${multiAgentId}` : '/api/multi-agents';
    const method = multiAgentId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(multiAgentData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        closeMultiAgentModal();
        loadMultiAgents(); // Refresh the list
    } catch (error) {
        console.error('Error saving multi-agent:', error);
        alert(`Failed to save multi-agent: ${error.message}`);
    }
}

async function editMultiAgentAction(multiAgentId) {
    try {
        const response = await fetch(`/api/multi-agents/${multiAgentId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const multiAgent = await response.json();
        showEditMultiAgentModal(multiAgent);
    } catch (error) {
        console.error("Error fetching multi-agent for edit:", error);
        alert("Failed to load multi-agent details for editing.");
    }
}

async function deleteMultiAgentAction(multiAgentId) {
    if (!confirm('Are you sure you want to delete this multi-agent configuration?')) {
        return;
    }

    try {
        const response = await fetch(`/api/multi-agents/${multiAgentId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        loadMultiAgents(); // Refresh the list
    } catch (error) {
        console.error("Error deleting multi-agent:", error);
        alert(`Failed to delete multi-agent: ${error.message}`);
    }
}

// Context Menu for Multi-Agent Cards
function createMultiAgentContextMenu() {
    // Remove existing menu if present
    const existingMenu = document.getElementById('multiAgentActionsMenu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Create new menu
    const menu = document.createElement('div');
    menu.id = 'multiAgentActionsMenu';
    menu.className = 'agent-actions-menu';

    const menuItems = [
        { id: 'edit-multi-agent', icon: 'fa-edit', text: 'Edit', action: 'editMultiAgent' },
        { id: 'duplicate-multi-agent', icon: 'fa-copy', text: 'Duplicate Agent', action: 'duplicateMultiAgent' },
        { id: 'delete-multi-agent', icon: 'fa-trash', text: 'Delete', action: 'deleteMultiAgent' }
    ];

    menuItems.forEach((item, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'agent-action-item';
        menuItem.id = item.id;
        menuItem.innerHTML = `<i class="fas ${item.icon}"></i> ${item.text}`;
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMultiAgentContextMenu();
            window[item.action](selectedMultiAgentId);
        });
        menu.appendChild(menuItem);
        
        // Add divider after each item except the last one
        if (index < menuItems.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'menu-divider';
            menu.appendChild(divider);
        }
    });

    document.body.appendChild(menu);
}

function showMultiAgentMenu(event, multiAgentId) {
    event.stopPropagation();
    const menu = document.getElementById('multiAgentActionsMenu');
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    selectedMultiAgentId = multiAgentId;
    
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left - 180}px`;
    menu.classList.add('show');
    
    // Close menu when clicking outside
    document.addEventListener('click', closeMultiAgentContextMenu);
}

function closeMultiAgentContextMenu() {
    const menu = document.getElementById('multiAgentActionsMenu');
    menu.classList.remove('show');
    document.removeEventListener('click', closeMultiAgentContextMenu);
}

function initializeProfileDropdown() {
    const profileBtn = document.querySelector('.profile-btn');
    const profileMenu = document.querySelector('.profile-menu');

    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
                profileMenu.classList.remove('show');
            }
        });
    }
}

// Initialize chat features when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeChatFeatures();
});

// Also initialize when the hash changes (for single-page app navigation)
window.addEventListener('hashchange', function() {
    if (window.location.hash.startsWith('#launch-agent')) {
        initializeChatFeatures();
    }
});

// Initialize all components
function init() {
    // Initialize notifications
    initializeNotifications();
    
    // Initialize profile dropdown
    initializeProfileDropdown();

    // Add the main stylesheet to the set initially
    document.querySelectorAll('head > link[rel="stylesheet"]').forEach(link => loadedStylesheets.add(link.href));

    // Handle sidebar navigation clicks using event delegation
    const sidebarNav = document.querySelector('.sidebar nav');
    if (sidebarNav) {
        sidebarNav.addEventListener('click', (event) => {
            const link = event.target.closest('a');
            if (link) { // Check if a link was clicked
                event.preventDefault();
                const pagePath = link.getAttribute('href');
                
                // Check if user is navigating to the Tools tab
                const isNavigatingToTools = pagePath === '/tools';
                
                // Check if it's the currently active page to prevent unnecessary reload
                if (pagePath !== window.location.pathname) {
                    window.history.pushState({ path: pagePath }, '', pagePath);
                    loadPage(pagePath);
                } else if (isNavigatingToTools) {
                    // If already on Tools page but clicked again, still refresh advanced tools
                    loadAdvancedTools();
                }
            }
        });
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
        const path = window.location.pathname;
        loadPage(path);
    });

    // Load initial page based on the current URL
    const initialPath = window.location.pathname;
    // Redirect root path to '/home' or your default page
    const pageToLoad = (initialPath === '/' || initialPath === '') ? '/home' : initialPath;
    // Update history state for the initial load if it was root
    if (initialPath === '/' || initialPath === '') {
        window.history.replaceState({ path: pageToLoad }, '', pageToLoad);
    }
    loadPage(pageToLoad);
}

document.addEventListener('DOMContentLoaded', init); 


function openROIALLY() {
    window.open('http://ajunsmachine.theworkpc.com:8000/v1', '_blank');
}

// Utility Functions
let agentLoaderInstance = null;

function showLoading(message = 'Loading...') {
    if (!agentLoaderInstance) {
        agentLoaderInstance = new AgentProcessingLoader(message);
    }
}

function hideLoading() {
    if (agentLoaderInstance) {
        agentLoaderInstance.remove();
        agentLoaderInstance = null;
    }
}

function toggleEditMode() {
    const editButton = document.getElementById('editButton');
    const saveButton = document.getElementById('saveButton');
    const fields = document.querySelectorAll('.form-input, .form-textarea');
    
    if (editButton.classList.contains('active')) {
        // Switching to view mode
        editButton.classList.remove('active');
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        saveButton.style.display = 'none';
        fields.forEach(field => {
            field.readOnly = true;
            field.classList.remove('editing');
        });
    } else {
        // Switching to edit mode
        editButton.classList.add('active');
        editButton.innerHTML = '<i class="fas fa-times"></i> Cancel';
        saveButton.style.display = 'inline-flex';
        fields.forEach(field => {
            if (field.id !== 'apiKey' && field.id !== 'llmProvider' && field.id !== 'llmModel') {
                field.readOnly = false;
                field.classList.add('editing');
            }
        });
    }
}

function saveAgentChanges() {
    const agentData = {
        name: document.getElementById('agentName').value,
        description: document.getElementById('agentDescription').value,
        role: document.getElementById('agentRole').value,
        goal: document.getElementById('agentGoal').value,
        expectedOutput: document.getElementById('expectedOutput').value,
        backstory: document.getElementById('agentBackstory').value,
        instructions: document.getElementById('agentInstructions').value,
        llmProvider: document.getElementById('llmProvider').value,
        llmModel: document.getElementById('llmModel').value,
        apiKey: document.getElementById('apiKey').value,
        tools: Array.from(selectedTools),
        features: {
            knowledgeBase: document.getElementById('knowledgeBase')?.checked || false,
            dataQuery: document.getElementById('dataQuery')?.checked || false
        }
    };

    showLoading("Saving changes...");

    fetch(`/api/agents/${selectedAgentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to save changes');
        return response.json();
    })
    .then(() => {
        hideLoading();
        // Switch back to view mode
        toggleEditMode();
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.innerHTML = '<i class="fas fa-check-circle"></i> Changes saved successfully';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    })
    .catch(error => {
        hideLoading();
        console.error('Error saving changes:', error);
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to save changes';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    });
}

const style = document.createElement('style');
style.innerHTML = `
@keyframes unique-fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}

.unique-bubble-container {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 10px;
}

.unique-bubble {
    width: 20px;
    height: 20px;
    background: radial-gradient(circle, cyan, blue);
    border-radius: 50%;
    box-shadow: 0 0 10px cyan;
    animation: unique-floatUp 2s infinite ease-in-out;
}

.unique-bubble:nth-child(1) { animation-delay: 0s; }
.unique-bubble:nth-child(2) { animation-delay: 0.2s; }
.unique-bubble:nth-child(3) { animation-delay: 0.4s; }
.unique-bubble:nth-child(4) { animation-delay: 0.6s; }
.unique-bubble:nth-child(5) { animation-delay: 0.8s; }

@keyframes unique-floatUp {
    0% { transform: translateY(0); opacity: 1; }
    50% { transform: translateY(-15px); opacity: 0.7; }
    100% { transform: translateY(0); opacity: 1; }
}

.unique-text {
    color: cyan;
    font-size: 18px;
    font-family: 'Arial', sans-serif;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.9;
    margin: 0;
    text-align: center;
}
`;
document.head.appendChild(style);

// Add this function to handle LLM provider changes
function handleLLMProviderChange() {
    const llmProvider = document.getElementById('llmProvider');
    const apiKeyInput = document.getElementById('apiKey');
    
    if (!llmProvider || !apiKeyInput) return;
    
    llmProvider.addEventListener('change', function() {
        if (this.value === 'impact') {
            apiKeyInput.value = '*******************************************';
            apiKeyInput.readOnly = true;
            apiKeyInput.style.backgroundColor = 'var(--input-disabled-bg)';
        } else {
            apiKeyInput.value = '';
            apiKeyInput.readOnly = false;
            apiKeyInput.style.backgroundColor = 'var(--input-bg)';
        }
    });
    
    // Trigger the change event on initial load
    if (llmProvider.value === 'impact') {
        apiKeyInput.value = '*******************************************';
        apiKeyInput.readOnly = true;
        apiKeyInput.style.backgroundColor = 'var(--input-disabled-bg)';
    }
}

// Add this function to create and show the API popup
function showAgentAPIPopup() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('agentAPIModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'agentAPIModal';
        modal.className = 'modal';
        
        const sampleCurl = `curl -X POST "${window.location.origin}/api/agent/infer" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: your_api_key_here" \\
    -d '{
        "agentId": "${selectedAgentId}",
        "userInput": "Specify the input here"
    }'`;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="header-content">
                        <h2>Agent API Reference</h2>
                        <p class="api-description">Use this API endpoint to interact with your agent programmatically.</p>
                    </div>
                    <button class="btn-close" onclick="closeAgentAPIPopup()">×</button>
                </div>
                <div class="modal-body">
                    <div class="api-section">
                        <h3>Endpoint</h3>
                        <div class="endpoint-info">
                            <code>POST /api/agent/infer</code>
                        </div>
                    </div>
                    <div class="api-section">
                        <h3>Sample Request</h3>
                        <div class="code-block">
                            <div class="code-header">
                                <span class="code-language">cURL</span>
                                <button class="copy-code" onclick="copyAPICode(this)">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <pre><code class="language-bash">${sampleCurl}</code></pre>
                        </div>
                    </div>
                    <div class="api-section">
                        <h3>Request Body Parameters</h3>
                        <table class="api-params">
                            <thead>
                                <tr>
                                    <th>Parameter</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>agentId</td>
                                    <td>string</td>
                                    <td>The unique identifier of your agent</td>
                                </tr>
                                <tr>
                                    <td>userInput</td>
                                    <td>string</td>
                                    <td>The message or query to send to the agent</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('agentAPIModalStyles')) {
            const style = document.createElement('style');
            style.id = 'agentAPIModalStyles';
            style.textContent = `
                #agentAPIModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: none;
                    z-index: 1000;
                    overflow-y: auto;
                    padding: 20px;
                }

                #agentAPIModal.show {
                    display: block;
                }

                #agentAPIModal .modal-content {
                    background: linear-gradient(145deg, #1a1f35, #2a2f45);
                    border: 1px solid rgba(99, 179, 237, 0.1);
                    border-radius: 16px;
                    box-shadow: 0 0 40px rgba(0, 0, 0, 0.3),
                                inset 0 0 20px rgba(99, 179, 237, 0.1);
                    backdrop-filter: blur(10px);
                    max-width: 800px;
                    margin: 20px auto;
                    position: relative;
                    max-height: calc(100vh - 40px);
                    display: flex;
                    flex-direction: column;
                }

                #agentAPIModal .modal-header {
                    background: linear-gradient(180deg, rgba(26, 31, 53, 0.8), transparent);
                    padding: 24px;
                    border-bottom: 1px solid rgba(99, 179, 237, 0.1);
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    backdrop-filter: blur(5px);
                }

                #agentAPIModal .modal-body {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                }

                #agentAPIModal .modal-content::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, 
                        transparent, 
                        rgba(99, 179, 237, 0.2), 
                        transparent);
                }

                #agentAPIModal h2 {
                    color: #63b3ed;
                    font-size: 24px;
                    margin: 0;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-shadow: 0 0 10px rgba(99, 179, 237, 0.3);
                }

                #agentAPIModal .api-description {
                    color: #a0aec0;
                    margin-top: 8px;
                    font-size: 14px;
                    line-height: 1.5;
                }

                #agentAPIModal .api-section {
                    margin-bottom: 32px;
                    animation: fadeInUp 0.5s ease-out;
                }

                #agentAPIModal .api-section h3 {
                    color: #63b3ed;
                    font-size: 18px;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                #agentAPIModal .api-section h3::before {
                    content: '';
                    display: block;
                    width: 4px;
                    height: 16px;
                    background: #63b3ed;
                    border-radius: 2px;
                }

                #agentAPIModal .endpoint-info {
                    background: rgba(26, 31, 53, 0.6);
                    border: 1px solid rgba(99, 179, 237, 0.2);
                    border-radius: 8px;
                    padding: 16px;
                    font-family: 'Monaco', monospace;
                    color: #63b3ed;
                    position: relative;
                    overflow: hidden;
                }

                #agentAPIModal .endpoint-info::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(
                        45deg,
                        transparent,
                        rgba(99, 179, 237, 0.1),
                        transparent
                    );
                    animation: shimmer 2s linear infinite;
                    pointer-events: none;
                }

                #agentAPIModal .code-block {
                    background: rgba(26, 31, 53, 0.6);
                    border: 1px solid rgba(99, 179, 237, 0.2);
                    border-radius: 8px;
                    overflow: hidden;
                }

                #agentAPIModal .code-header {
                    background: rgba(26, 31, 53, 0.8);
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(99, 179, 237, 0.2);
                }

                #agentAPIModal .code-language {
                    color: #63b3ed;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                #agentAPIModal .copy-code {
                    background: rgba(99, 179, 237, 0.1);
                    border: 1px solid rgba(99, 179, 237, 0.2);
                    color: #63b3ed;
                    border-radius: 4px;
                    padding: 6px 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                #agentAPIModal .copy-code:hover {
                    background: rgba(99, 179, 237, 0.2);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(99, 179, 237, 0.2);
                }

                #agentAPIModal pre {
                    margin: 0;
                    padding: 20px;
                    overflow-x: auto;
                }

                #agentAPIModal code {
                    color: #a0aec0;
                    font-family: 'Monaco', monospace;
                    line-height: 1.5;
                }

                #agentAPIModal .api-params {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid rgba(99, 179, 237, 0.2);
                }

                #agentAPIModal .api-params th {
                    background: rgba(26, 31, 53, 0.8);
                    color: #63b3ed;
                    font-weight: 500;
                    text-align: left;
                    padding: 16px;
                    border-bottom: 1px solid rgba(99, 179, 237, 0.2);
                }

                #agentAPIModal .api-params td {
                    padding: 16px;
                    color: #a0aec0;
                    border-bottom: 1px solid rgba(99, 179, 237, 0.1);
                    background: rgba(26, 31, 53, 0.4);
                }

                #agentAPIModal .api-params tr:last-child td {
                    border-bottom: none;
                }

                #agentAPIModal .btn-close {
                    background: none;
                    border: none;
                    color: #63b3ed;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                #agentAPIModal .btn-close:hover {
                    background: rgba(99, 179, 237, 0.1);
                    transform: rotate(90deg);
                }

                #agentAPIModal .btn-close:before {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(circle, rgba(99, 179, 237, 0.2) 0%, transparent 70%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                #agentAPIModal .btn-close:hover:before {
                    opacity: 1;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%) rotate(45deg);
                    }
                    100% {
                        transform: translateX(100%) rotate(45deg);
                    }
                }

                /* Scrollbar styling */
                #agentAPIModal pre::-webkit-scrollbar,
                #agentAPIModal .modal-body::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }

                #agentAPIModal pre::-webkit-scrollbar-track,
                #agentAPIModal .modal-body::-webkit-scrollbar-track {
                    background: rgba(26, 31, 53, 0.4);
                    border-radius: 4px;
                }

                #agentAPIModal pre::-webkit-scrollbar-thumb,
                #agentAPIModal .modal-body::-webkit-scrollbar-thumb {
                    background: rgba(99, 179, 237, 0.3);
                    border-radius: 4px;
                }

                #agentAPIModal pre::-webkit-scrollbar-thumb:hover,
                #agentAPIModal .modal-body::-webkit-scrollbar-thumb:hover {
                    background: rgba(99, 179, 237, 0.5);
                }
            `;
            document.head.appendChild(style);
        }
        document.body.appendChild(modal);
    } else {
        // If modal exists, just update the code with current agent ID
        const codeBlock = modal.querySelector('code');
        const sampleCurl = `curl -X POST "<HOST>/api/agent/infer" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: your_api_key_here" \\
    -d '{
        "agentId": "${selectedAgentId}",
        "userInput": "What is the weather like today?"
    }'`;
        codeBlock.textContent = sampleCurl;
    }
    
    // Show the modal
    modal.classList.add('show');
}

async function loadDataConnectorsForCustomTool() {
    try {
        const response = await fetch('/api/data-connectors');
        const connectors = await response.json();
        
        const select = document.getElementById('toolDataConnector');
        
        // Clear existing options except the first one (None)
        while (select.options.length > 1) {
            select.options.remove(1);
        }
        
        // Add connectors to dropdown
        connectors.forEach(connector => {
            const option = document.createElement('option');
            option.value = connector.id;
            option.textContent = connector.uniqueName;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading data connectors:', error);
    }
}
