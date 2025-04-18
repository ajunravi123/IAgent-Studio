// Main JavaScript file for the FastAPI application

// Keep track of loaded stylesheets
const loadedStylesheets = new Set();

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

function createNewAgent() {
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
let selectedTools = new Set();

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
                
                // Load agent tools
                loadAgentTools(agent.tools);
            }, 100); // Keeping the timeout for now, but the checks add safety
        });
}

function loadAgentTools(toolIds) {
    const colorClasses = ['blue', 'green', 'purple', 'yellow', 'red', 'orange'];
    let colorIndex = 0;

    fetch('/api/tools')
        .then(response => response.json())
        .then(tools => {
            const agentTools = tools.filter(tool => toolIds.includes(tool.id));
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
    // Reset form and update title/button for new tool
    modal.querySelector('.modal-header h2').textContent = 'Add Custom Tool';
    modal.querySelector('.modal-footer .btn-primary').textContent = '+ Add Tool';
    
    // Clear form fields
    document.getElementById('toolName').value = '';
    document.getElementById('toolDescription').value = '';
    // document.getElementById('toolIcon').value = '';
    document.getElementById('toolTags').value = '';
    
    // Set default OpenAPI schema template
    const defaultSchema = {
        "openapi": "3.0.0",
        "info": {
            "title": "Sample API",
            "version": "1.0.0",
            "description": "A sample API specification"
        },
        "servers": [
            {
                "url": "https://api.example.com/v1",
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
    
    // Show the modal
    modal.classList.add('show');
}

function closeAddCustomTool() {
    const modal = document.getElementById('addCustomToolModal');
    modal.classList.remove('show');
    
    // Clear form
    document.getElementById('toolName').value = '';
    document.getElementById('toolDescription').value = '';
    // document.getElementById('toolIcon').value = '';
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
    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
            hideLoading();
            const modal = document.getElementById('addCustomToolModal');
            // Update modal title and button
            modal.querySelector('.modal-header h2').textContent = 'Edit Tool';
            modal.querySelector('.modal-footer .btn-primary').textContent = 'Save';
            
            // Fill form with tool data
            document.getElementById('toolName').value = tool.name;
            document.getElementById('toolDescription').value = tool.description;
            document.getElementById('toolTags').value = tool.tags.join(', ');
            
            // Get and set schema
            fetch(`/api/tools/${toolId}/schema`)
                .then(response => response.json())
                .then(schema => {
                    document.getElementById('toolSchema').value = JSON.stringify(schema, null, 2);
                });
            
            // Update save button to handle edit
            const saveButton = modal.querySelector('.modal-footer .btn-primary');
            saveButton.onclick = () => updateTool(toolId);
            
            // Show the modal
            modal.classList.add('show');
        });
}

function updateTool(toolId) {
    const name = document.getElementById('toolName').value.trim();
    const description = document.getElementById('toolDescription').value.trim();
    const tags = document.getElementById('toolTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const schema = document.getElementById('toolSchema').value.trim();
    
    if (!validateToolData(name, description, schema)) return;
    
    const toolData = {
        name,
        description,
        icon: `/static/images/default-tool-icon.svg`,
        tags: tags.length > 0 ? tags : ['Custom'],
        schema: JSON.parse(schema),
        is_custom: true
    };

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
    let originalToolName = ''; // Store the original name for better error messages

    showLoading("Please wait..");
    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
            hideLoading();
            originalToolName = tool.name;
            // Get the schema for the tool
            return fetch(`/api/tools/${toolId}/schema`)
                .then(response => response.json()) // Assuming schema endpoint always returns JSON
                .then(schema => {
                    const clonedTool = {
                        name: `${tool.name} (Copy)`,
                        description: tool.description,
                        icon: tool.icon,
                        tags: tool.tags,
                        schema: schema,
                        is_custom: true
                    };
                    
                    return fetch('/api/tools/custom', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(clonedTool)
                    });
                });
        })
        .then(async response => { // Make this async to use await for response.json()
            if (!response.ok) { 
                 // Try to get specific error from API response
                 let errorMessage = `Failed to clone tool '${originalToolName}'.`;
                 try {
                     const errorData = await response.json();
                     // Use the detail field from FastAPI's HTTPException
                     errorMessage += ` Reason: ${errorData.detail || response.statusText}`;
                 } catch (e) {
                     // If response is not JSON or empty
                     errorMessage += ` Status: ${response.statusText}`;
                 }
                 throw new Error(errorMessage); // Throw error to be caught below
            }
            return response.json(); // Return the created tool data
        })
        .then(() => {
            loadExternalTools(); // Use loadExternalTools to refresh the main tools page
        })
        .catch(error => {
            hideLoading();
            console.error('Error cloning tool:', error);
            // Display the specific error message from the Error object
            alert(error.message || 'An unexpected error occurred while cloning the tool.');
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
    fetch('/api/tools')
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
        fetch('/api/tools')
            .then(response => response.json())
            .then(tools => {
                const toolsGrid = document.querySelector('.tools-grid');
                if (!toolsGrid) return;

                toolsGrid.innerHTML = tools.map(tool => {
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
                            <div class="checkbox" onclick="toggleTool('${tool.id}', event)">
                                <i class="fas fa-check"></i>
                            </div>
                        </div>
                    `;
                }).join('');

                // Add click event listeners
                toolsGrid.querySelectorAll('.tool-card').forEach(card => {
                    card.addEventListener('click', (event) => {
                        if (!event.target.closest('.checkbox') && !event.target.closest('.view-btn')) {
                            const toolId = card.dataset.toolId;
                            toggleTool(toolId, event);
                        }
                    });
                });
            });
    } catch (error) {
        console.error('Error loading tools:', error);
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
        features: {
            knowledgeBase: document.getElementById('knowledgeBase').checked,
            dataQuery: document.getElementById('dataQuery').checked
        }
    };

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

                        // Set selected tools and load them
                        selectedTools = new Set(agent.tools || []);
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
    
    // Update UI - find the specific tool card using data attribute
    const toolCard = document.querySelector(`.tool-card[data-tool-id="${toolId}"]`);
    if (toolCard) {
        const isSelected = selectedTools.has(toolId);
        toolCard.classList.toggle('selected', isSelected);
        const checkbox = toolCard.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = isSelected;
        }
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


function showMultiAgentAPIPopup() {
    let modal = document.getElementById('agentAPIModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'agentAPIModal';
        modal.className = 'modal';
        
        // Use the multi-agent endpoint and ID
        const sampleCurl = `curl -X POST "${window.location.origin}/api/multi_agent/infer" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: your_api_key_here" \\
    -d '{ 
        "multi_agent_id": "${window.selectedMultiAgentId || 'your_multi_agent_id'}",
        "userInput": "Specify the input here"
    }'`;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="header-content">
                        <h2>Multi-Agent API Reference</h2>
                        <p class="api-description">Use this API endpoint to interact with your multi-agent orchestration programmatically.</p>
                    </div>
                    <button class="btn-close" onclick="closeAgentAPIPopup()">×</button>
                </div>
                <div class="modal-body">
                    <div class="api-section">
                        <h3>Endpoint</h3>
                        <div class="endpoint-info">
                            <code>POST /api/multi_agent/infer</code>
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
                                    <td>multi_agent_id</td>
                                    <td>string</td>
                                    <td>The unique identifier of your multi-agent orchestration</td>
                                </tr>
                                <tr>
                                    <td>userInput</td>
                                    <td>string</td>
                                    <td>The message or query to send to the multi-agent orchestration</td>
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
        const sampleCurl = `curl -X POST "<HOST>/api/multi_agent/infer" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: your_api_key_here" \\
    -d '{ 
        "multi_agent_id": "${window.selectedMultiAgentId || 'your_multi_agent_id'}",
        "userInput": "Specify the input here"
    }'`;
        codeBlock.textContent = sampleCurl;
    }
    
    // Show the modal
    modal.classList.add('show');
}

function closeAgentAPIPopup() {
    const modal = document.getElementById('agentAPIModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function copyAPICode(button) {
    const codeBlock = button.closest('.code-block').querySelector('code');
    if (!codeBlock) {
        console.error("Could not find code block to copy.");
        return;
    }
    const codeToCopy = codeBlock.textContent;
    
    // Use modern Clipboard API
    navigator.clipboard.writeText(codeToCopy).then(() => {
        // Success: Show feedback
        const icon = button.querySelector('i');
        if (icon) {
            const originalIconClass = icon.className;
            icon.className = 'fas fa-check';
            button.disabled = true; // Briefly disable button
            setTimeout(() => {
                icon.className = originalIconClass;
                button.disabled = false;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback or error message (optional)
        alert('Failed to copy code. Please try copying manually.');
    });
}

// Add event listener for the API link
document.addEventListener('click', function(event) {
    const apiLink = event.target.closest('.agent-api-link');
    if (apiLink) {
        event.preventDefault();
        showAgentAPIPopup();
    }
});


document.addEventListener('click', function(event) {
    const apiLink = event.target.closest('.multi-agent-api-link');
    if (apiLink) {
        event.preventDefault();
        showMultiAgentAPIPopup();
    }
});

// Add API Keys page to the routes
const routes = {
    '/': 'pages/home.html',
    '/agents': 'pages/agents.html',
    '/tools': 'pages/tools.html',
    '/models': 'pages/models.html',
    '/marketplace': 'pages/marketplace.html',
    '/reports': 'pages/reports.html',
    '/statistics': 'pages/statistics.html',
    '/settings': 'pages/settings.html',
    '/api-keys': 'pages/api-keys.html'  // Add this line
};

// API Key Management Functions
function copyApiKey(id, button) {
    const input = document.getElementById(id);
    if (input) {
        input.select();
        document.execCommand('copy');
        button.className = 'copied'; // Example of setting a class
    } else {
        console.error(`Element with ID ${id} not found.`);
    }
}

function toggleApiKeyVisibility(id, button) {
    const input = document.getElementById(id);
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            button.className = 'visible'; // Example of setting a class
        } else {
            input.type = 'password';
            button.className = 'hidden'; // Example of setting a class
        }
    } else {
        console.error(`Element with ID ${id} not found.`);
    }
}

// Initialize the loader when the application starts
document.addEventListener('DOMContentLoaded', () => {
    new StudioLoader();
});







document.addEventListener("change", function(event) {
    if (event.target && event.target.id === "fileInput") {
        handleFileChange(event);
    }
});

document.addEventListener("click", function(event) {
    if (event.target && event.target.id === "preview_box") {
        document.getElementById("fileInput").click();
    }
    
    if (event.target && event.target.getAttribute("title") === "clear_selected_file") {
        event.stopPropagation(); // Prevent opening file input
        clearFileSelection();
    }
});

function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById("my_file").textContent = file.name;
        document.getElementById("preview_box").style.display = "flex";
        document.querySelector("[title='clear_selected_file']").style.display = "inline";
    }
}

function clearFileSelection() {
    const fileInput = document.getElementById("fileInput");
    fileInput.value = ""; // Reset file input
    document.getElementById("preview_box").style.display = "none";
    document.querySelector("[title='clear_selected_file']").style.display = "none";
}





// Add theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        
        // Ensure light theme CSS is loaded
        ensureLightThemeCSS();
    }
    
    // Update the toggle button based on the current theme
    updateToggleButton();
    
    themeToggle.addEventListener('click', function() {
        const isLightTheme = document.body.classList.toggle('light-theme');
        
        // Save theme preference
        localStorage.setItem('theme', isLightTheme ? 'light' : 'dark');
        
        // Ensure light theme CSS is loaded when switching to light theme
        if (isLightTheme) {
            ensureLightThemeCSS();
        }
        
        // Update button appearance
        updateToggleButton();
    });
}

// Function to ensure light theme CSS is loaded
function ensureLightThemeCSS() {
    const lightThemeCSSPath = '/static/css/light-theme.css';
    
    // Check if the light theme CSS is already loaded
    const existingLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .find(link => link.href.includes('light-theme.css'));
        
    if (!existingLink) {
        // Load the light theme CSS if it's not already loaded
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = lightThemeCSSPath;
        document.head.appendChild(link);
        console.log('Loaded light theme CSS');
    }
}

// Function to update toggle button appearance
function updateToggleButton() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        if (document.body.classList.contains('light-theme')) {
            themeToggle.innerHTML = '<i class="fas fa-sun light-icon"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fas fa-moon dark-icon"></i>';
        }
    }
}

// Add event handler functions for multi-agent actions
function editMultiAgent(multiAgentId) {
    editMultiAgentAction(multiAgentId);
}

function duplicateMultiAgent(multiAgentId) {
    // Fetch the multi agent and create a copy
    fetch(`/api/multi-agents/${multiAgentId}`)
        .then(response => response.json())
        .then(multiAgent => {
            const duplicatedMultiAgent = {
                ...multiAgent,
                name: `${multiAgent.name} (Copy)`,
                description: multiAgent.description
            };
            delete duplicatedMultiAgent.id;

            return fetch('/api/multi-agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(duplicatedMultiAgent)
            });
        })
        .then(() => {
            loadMultiAgents();
        })
        .catch(error => {
            console.error("Error duplicating multi-agent:", error);
            alert("Failed to duplicate multi-agent.");
        });
}

function deleteMultiAgent(multiAgentId) {
    deleteMultiAgentAction(multiAgentId);
}

// Add cloneMultiAgent function to duplicate an existing multi-agent
async function cloneMultiAgent(multiAgentId) {
    try {
        showLoading("Cloning multi-agent...");
        
        // Fetch the original multi-agent config
        const response = await fetch(`/api/multi-agents/${multiAgentId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const multiAgent = await response.json();
        
        // Create a copy with modified name
        const clonedMultiAgent = {
            ...multiAgent,
            name: `${multiAgent.name} (Copy)`,
            description: multiAgent.description,
            agent_ids: multiAgent.agent_ids
        };
        
        // Remove the ID to ensure a new one is generated
        delete clonedMultiAgent.id;
        
        // Post the cloned multi-agent to the API
        const createResponse = await fetch('/api/multi-agents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clonedMultiAgent)
        });
        
        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.detail || `Failed to create clone: ${createResponse.status}`);
        }
        
        hideLoading();
        
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.innerHTML = '<i class="fas fa-check-circle"></i> Multi-agent cloned successfully';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        
        // Refresh the multi-agents list
        loadMultiAgents();
        
    } catch (error) {
        hideLoading();
        console.error("Error cloning multi-agent:", error);
        
        // Show error message
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to clone multi-agent: ${error.message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

// Add launchMultiAgent function to navigate to the multi-agent playground
function launchMultiAgent(multiAgentId) {
    // Store the multi-agent ID in session storage for retrieval on the launch page
    sessionStorage.setItem('selectedMultiAgentId', multiAgentId);
    
    // Load the launch-multi-agent page without changing URL
    loadPage('launch-multi-agent');
}

// --- Multi-Agent Launch Page Functions ---

function initializeMultiAgentLaunchPage() {
    console.log('Initializing Multi-Agent launch page...');
    const multiAgentId = sessionStorage.getItem('selectedMultiAgentId');
    console.log('Retrieved multiAgentId from sessionStorage:', multiAgentId);
    if (!multiAgentId) {
        console.error('Multi-agent ID not found in session storage.');
        // appendMultiAgentMessage is specific to the page, handle error display differently or ensure it exists
        // Maybe just log or show a generic error on the page
        const agentListContainer = document.getElementById('connectedAgentsList');
        if(agentListContainer) agentListContainer.innerHTML = '<div class="error-message">Error: No Multi-Agent ID found. Please go back.</div>';
        return;
    }
    
    loadMultiAgentDetails(multiAgentId);
    setupMultiAgentLaunchPageEventListeners();
}

function setupMultiAgentLaunchPageEventListeners() {
    console.log('Setting up event listeners for Multi-Agent Launch page...');
    const userInput = document.getElementById('multiAgentUserInput');
    const fileUploadBtn = document.querySelector('.launch-multi-agent [data-action="upload-file"]');
    const sendBtn = document.querySelector('.launch-multi-agent [data-action="send-message"]');
    const editBtn = document.getElementById('multiAgentEditButton');
    const saveBtn = document.getElementById('multiAgentSaveButton');
    const refreshBtn = document.querySelector('.launch-multi-agent .header-actions .btn-secondary');
    const backBtn = document.querySelector('.launch-multi-agent .header-left .btn-back');

    if (userInput && !userInput.dataset.listenerAttached) {
        userInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleMultiAgentSendMessage();
            }
        });
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        userInput.dataset.listenerAttached = 'true';
    }

    if (fileUploadBtn && !fileUploadBtn.dataset.listenerAttached) {
        fileUploadBtn.addEventListener('click', function() {
            const fileInput = document.getElementById('multiAgentFileInput');
            if (fileInput) fileInput.click();
        });
        fileUploadBtn.dataset.listenerAttached = 'true';
    }

    if (sendBtn && !sendBtn.dataset.listenerAttached) {
        sendBtn.addEventListener('click', handleMultiAgentSendMessage);
        sendBtn.dataset.listenerAttached = 'true';
    }

    if (editBtn && !editBtn.dataset.listenerAttached) {
        // Change the event listener to call the new popup function
        editBtn.addEventListener('click', openMultiAgentEditPopup); 
        editBtn.dataset.listenerAttached = 'true';
    }
    
    // if (saveBtn && !saveBtn.dataset.listenerAttached) {
    //     saveBtn.addEventListener('click', saveMultiAgentChanges);
    //     saveBtn.dataset.listenerAttached = 'true';
    // }
    
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
        refreshBtn.addEventListener('click', refreshMultiAgent);
        refreshBtn.dataset.listenerAttached = 'true';
    }
    
    if (backBtn && !backBtn.dataset.listenerAttached) {
        backBtn.addEventListener('click', goBack);
        backBtn.dataset.listenerAttached = 'true';
    }
    
    console.log('Multi-Agent Launch page event listeners setup complete.');
}

// Load multi-agent details
function loadMultiAgentDetails(multiAgentId) {
    console.log(`Fetching details for multi-agent: ${multiAgentId}`);
    fetch(`/api/multi-agents/${multiAgentId}`)
        .then(response => {
            console.log(`Response status for /api/multi-agents/${multiAgentId}:`, response.status);
            if (!response.ok) throw new Error('Failed to load multi-agent details');
            return response.json();
        })
        .then(multiAgent => {
            console.log('Multi-agent details fetched:', multiAgent);
            const nameInput = document.getElementById('multiAgentName');
            const descTextarea = document.getElementById('multiAgentDescription');
            const roleInput = document.getElementById('multiAgentRoleDisplay'); // Get display element
            const goalTextarea = document.getElementById('multiAgentGoalDisplay'); // Get display element
            const backstoryTextarea = document.getElementById('multiAgentBackstoryDisplay'); // Get display element
            const expectedOutputTextarea = document.getElementById('multiAgentExpectedOutputDisplay'); // Get expected output display element
            
            if (nameInput) nameInput.value = multiAgent.name;
            if (descTextarea) descTextarea.value = multiAgent.description;
            // Populate the new display fields
            if (roleInput) roleInput.value = multiAgent.role || 'Coordinator';
            if (goalTextarea) goalTextarea.value = multiAgent.goal || 'Not specified';
            if (backstoryTextarea) backstoryTextarea.value = multiAgent.backstory || 'Not specified';
            if (expectedOutputTextarea) expectedOutputTextarea.value = multiAgent.expected_output || 'Not specified'; // Populate expected output
            
            // Store the ID for later use
            window.selectedMultiAgentId = multiAgentId;
            
            // Load the connected agents
            console.log('Calling loadConnectedAgents with agent_ids:', multiAgent.agent_ids);
            loadConnectedAgents(multiAgent.agent_ids);
        })
        .catch(error => {
            console.error('Error loading multi-agent details:', error);
            appendMultiAgentMessage('Error loading multi-agent details.', 'manager');
            const agentListContainer = document.getElementById('connectedAgentsList');
            if(agentListContainer) agentListContainer.innerHTML = `<div class="error-message">Error loading details: ${error.message}</div>`;
        });
}

// Load connected agents
function loadConnectedAgents(agentIds) {
    console.log('Loading connected agents for IDs:', agentIds);
    const connectedAgentsListContainer = document.getElementById('connectedAgentsList');
    
    if (!connectedAgentsListContainer) {
        console.error("Connected agents list container (#connectedAgentsList) not found!");
        return; 
    }
    
    if (!agentIds || !agentIds.length) {
         console.warn('No agent IDs provided for multi-agent.');
        connectedAgentsListContainer.innerHTML = '<div class="empty-state">No agents connected</div>';
        return;
    }
    
    connectedAgentsListContainer.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading agents...</div>';
    
    fetch('/api/agents') // Fetch all agents
        .then(response => {
            console.log('Response status for /api/agents:', response.status);
            if (!response.ok) throw new Error('Failed to fetch agents list');
            return response.json();
        })
        .then(allAgents => {
            console.log('Fetched all agents:', allAgents);
            // Filter agents based on IDs from the multi-agent config
            const connectedAgents = allAgents.filter(agent => agent && agent.id && agentIds.includes(agent.id));
            console.log('Filtered connected agents:', connectedAgents);
            renderConnectedAgents(connectedAgents);
        })
        .catch(error => {
            console.error('Error loading connected agents:', error);
            connectedAgentsListContainer.innerHTML = 
                `<div class="error-message">Failed to load connected agents: ${error.message}</div>`;
        });
}

// Render the connected agents
function renderConnectedAgents(agents) {
    console.log('Rendering connected agents:', agents);
    const connectedAgentsList = document.getElementById('connectedAgentsList');
    // const agentSelector = document.getElementById('activeAgentSelector');
    
     if (!connectedAgentsList) {
         console.error("Connected agents list container (#connectedAgentsList) not found during render!");
         return;
     }
    //  if (!agentSelector) {
    //      console.error("Agent selector dropdown (#activeAgentSelector) not found during render!");
    //      return;
    //  }
    
    if (!agents || !agents.length) {
        console.log('No connected agents to render.');
        connectedAgentsList.innerHTML = '<div class="empty-state">No agents connected</div>';
        return;
    }
    
    // Generate HTML for connected agents
    connectedAgentsList.innerHTML = agents.map(agent => {
        // Basic check for agent data validity
        const agentId = agent && agent.id ? agent.id : 'invalid-' + Math.random();
        const agentName = agent && agent.name ? agent.name : 'Unnamed Agent';
        const agentDesc = agent && agent.description ? agent.description : 'No description';
        const agentModel = agent && agent.llmModel ? agent.llmModel : 'Unknown';
        const agentProvider = agent && agent.llmProvider ? agent.llmProvider : 'Unknown';
        
        // Check if stringToGradient exists before calling
        const iconColor = typeof stringToGradient === 'function' ? stringToGradient(agentName) : 'grey'; 
        
        return `
            <div class="connected-agent-item" data-agent-id="${agentId}">
                <div class="connected-agent-icon" style="background: ${iconColor}">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="connected-agent-details">
                    <div class="connected-agent-name">${agentName}</div>
                    <div class="connected-agent-desc">${agentDesc}</div>
                    <div class="connected-agent-model">${agentModel} | ${agentProvider}</div>
                </div>
            </div>
        `;
    }).join('');
    console.log('Connected agents list updated in DOM.');
    
    // Also populate the agent selector dropdown
    // First clear existing options except for the manager
    // while (agentSelector.options.length > 1) {
    //     agentSelector.remove(1);
    // }
    
    // Add options for each agent
    // agents.forEach(agent => {
    //     const option = document.createElement('option');
    //     option.value = agent.id;
    //     option.text = agent.name;
    //     agentSelector.add(option);
    // });
    // console.log('Agent selector dropdown populated.');
}

// Handle sending messages in the multi-agent chat
function handleMultiAgentSendMessage() {
    const userInput = document.getElementById('multiAgentUserInput');
    if (!userInput) return;
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    appendMultiAgentMessage(message, 'user');
    
    // Clear the input
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Show "typing" indicator from the manager initially
    showTypingIndicator('manager');
    
    const multiAgentId = window.selectedMultiAgentId;
    if (!multiAgentId) {
        hideTypingIndicator();
        appendMultiAgentMessage('Error: No multi-agent selected', 'manager');
        return;
    }
    
    // Call the backend API
    fetch('/api/multi_agent/infer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            multi_agent_id: multiAgentId,
            user_input: message
        })
    })
    .then(response => {
        hideTypingIndicator(); // Hide indicator once response starts coming
        if (!response.ok) {
            // Try to get error details from the response body
            return response.json().then(err => { 
                throw new Error(err.detail || `HTTP error! status: ${response.status}`); 
            }).catch(() => { // Fallback if response body is not JSON or empty
                throw new Error(`HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Multi-agent API response:', data);
        // Assuming the response has a structure like { response: "...", sender_agent_name: "..." } or similar
        // Adjust parsing based on the actual API response format
        const responseText = data.response || 'No response text received.';
        const senderName = data.sender_agent_name || 'Manager Agent'; // Default to Manager if no specific agent name
        
        // Determine sender type based on name or default
        const senderType = senderName === 'Manager Agent' ? 'manager' : 'agent'; 
        
        appendMultiAgentMessage(responseText, senderType, senderName);
    })
    .catch(error => {
        hideTypingIndicator();
        console.error('Error calling multi-agent infer API:', error);
        appendMultiAgentMessage(`Error: ${error.message}`, 'manager');
    });
}

// Append message to the multi-agent chat
function appendMultiAgentMessage(message, sender, senderName = null) {
    const chatContainer = document.getElementById('multiAgentChatContainer');
     if (!chatContainer) {
         console.error("Chat container (#multiAgentChatContainer) not found!");
         return;
     }
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${sender === 'user' ? 'user' : (sender === 'manager' ? 'manager' : 'agent')}`;
    
    const icon = document.createElement('i');
    icon.className = sender === 'user' ? 'fas fa-user' : (sender === 'manager' ? 'fas fa-brain' : 'fas fa-robot');
    avatarDiv.appendChild(icon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${sender}`;
    
    // Add header if sender is not user and there's a sender name
    if (sender !== 'user' && senderName) {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.textContent = senderName;
        contentDiv.appendChild(headerDiv);
    }
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message;
    contentDiv.appendChild(textDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show typing indicator
function showTypingIndicator(sender, agentId = null) {
    const chatContainer = document.getElementById('multiAgentChatContainer');
    if (!chatContainer) {
        console.error("Chat container not found when trying to show typing indicator.");
        return;
    }
    
    // Remove any existing typing indicators
    document.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message typing-indicator';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${sender}`;
    
    const icon = document.createElement('i');
    icon.className = sender === 'user' ? 'fas fa-user' : (sender === 'manager' ? 'fas fa-brain' : 'fas fa-robot');
    avatarDiv.appendChild(icon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${sender}`;
    
    // Add header if there's an agent name
    if (sender === 'agent' && agentId) {
        const agentItems = document.querySelectorAll('.connected-agent-item');
        let agentName = 'Agent';
        
        agentItems.forEach(item => {
            if (item.dataset.agentId === agentId) {
                agentName = item.querySelector('.connected-agent-name').textContent;
            }
        });
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.textContent = agentName;
        contentDiv.appendChild(headerDiv);
    } else if (sender === 'manager') {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.textContent = 'Manager Agent';
        contentDiv.appendChild(headerDiv);
    }
    
    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    contentDiv.appendChild(dots);
    
    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(contentDiv);
    chatContainer.appendChild(typingDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    document.querySelectorAll('.typing-indicator').forEach(el => el.remove());
}

// Toggle edit mode for multi-agent details
function toggleMultiAgentEditMode() {
    const editButton = document.getElementById('multiAgentEditButton');
    const saveButton = document.getElementById('multiAgentSaveButton');
    const fields = document.querySelectorAll('.launch-multi-agent .form-input, .launch-multi-agent .form-textarea');
    
    if (!editButton || !saveButton || !fields) return;
    
    if (editButton.classList.contains('active')) {
        // Switch to view mode
        editButton.classList.remove('active');
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        saveButton.style.display = 'none';
        fields.forEach(field => {
            field.readOnly = true;
            field.classList.remove('editing');
        });
    } else {
        // Switch to edit mode
        editButton.classList.add('active');
        editButton.innerHTML = '<i class="fas fa-times"></i> Cancel';
        saveButton.style.display = 'inline-flex';
        fields.forEach(field => {
            field.readOnly = false;
            field.classList.add('editing');
        });
    }
}

// Save multi-agent changes
function saveMultiAgentChanges() {
    const multiAgentId = window.selectedMultiAgentId;
    if (!multiAgentId) {
        alert('No multi-agent selected');
        return;
    }

    // Get elements from the launch page
    const nameInput = document.getElementById('multiAgentName');
    const descTextarea = document.getElementById('multiAgentDescription');
    const roleInput = document.getElementById('multiAgentRoleDisplay');
    const goalTextarea = document.getElementById('multiAgentGoalDisplay');
    const backstoryTextarea = document.getElementById('multiAgentBackstoryDisplay');
    const expectedOutputTextarea = document.getElementById('multiAgentExpectedOutputDisplay');

    if (!nameInput || !descTextarea || !roleInput || !goalTextarea || !backstoryTextarea || !expectedOutputTextarea) {
        console.error("One or more required display elements not found on the launch page.");
        alert("Error: Could not find all necessary fields to save.");
        return;
    }

    const multiAgentData = {
        name: nameInput.value,
        description: descTextarea.value,
        role: roleInput.value,
        goal: goalTextarea.value,
        backstory: backstoryTextarea.value,
        expected_output: expectedOutputTextarea.value, // Include expected output
        agent_ids: [] // Start with an empty array
    };

    // Get the agent IDs from the connected agents list displayed on the page
    const connectedAgents = document.querySelectorAll('.connected-agent-item');
    multiAgentData.agent_ids = Array.from(connectedAgents).map(agent => agent.dataset.agentId);

    // Validation (Example - add more as needed)
    if (!multiAgentData.name || !multiAgentData.description || !multiAgentData.expected_output) {
         alert('Name, Description, and Expected Output are required.');
         return;
    }

    showLoading("Saving changes..."); // Show loading indicator

    fetch(`/api/multi-agents/${multiAgentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(multiAgentData)
    })
    .then(response => {
        hideLoading(); // Hide loading indicator on response
        if (!response.ok) {
             // Try to parse error detail
             return response.json().then(err => {
                 throw new Error(err.detail || 'Failed to save changes');
             }).catch(() => { // Fallback if not JSON
                 throw new Error(`Failed to save changes (Status: ${response.status})`);
             });
        }
        return response.json();
    })
    .then(() => {
        // Switch back to view mode
        toggleMultiAgentEditMode(); // Assuming this correctly toggles readonly/button states

        // Show success message
        showToast('Changes saved successfully', 'success');
    })
    .catch(error => {
        hideLoading(); // Ensure loader is hidden on error
        console.error('Error saving changes:', error);

        // Show error message
        showToast(`Failed to save changes: ${error.message}`, 'error');
    });
}

// Refresh the multi-agent page
function refreshMultiAgent() {
    const multiAgentId = window.selectedMultiAgentId;
    if (multiAgentId) {
        loadMultiAgentDetails(multiAgentId);
        
        // Add a refresh message to the chat
        appendMultiAgentMessage('Multi-agent interface refreshed', 'manager', 'Manager Agent');
    }
}

// Add CSS for typing indicator
const typingStyle = document.createElement('style');
typingStyle.textContent = `
    .typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 8px 0;
    }
    
    .typing-dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: rgba(99, 179, 237, 0.6);
        display: inline-block;
        animation: typingAnimation 1.3s infinite ease-in-out;
    }
    
    .typing-dots span:nth-child(1) {
        animation-delay: 0s;
    }
    
    .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typingAnimation {
        0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.6;
        }
        30% {
            transform: translateY(-5px);
            opacity: 1;
        }
    }
`;
if (!document.getElementById('typing-indicator-styles')) {
    typingStyle.id = 'typing-indicator-styles';
    document.head.appendChild(typingStyle);
}

// --- End Multi-Agent Launch Page Functions ---







function initializeChatFeatures() {
    console.log('Initializing chat features...');

    // Event delegation for the send message button
    document.addEventListener('click', function(event) {
        const sendButton = event.target.closest('[data-action="send-message"]');
        if (sendButton) {
            handleSendMessage();
        }

        // Handle file upload button click
        const uploadButton = event.target.closest('[data-action="upload-file"]');
        if (uploadButton) {
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.click();
            }
        }

        // Handle remove file button click
        const removeFileButton = event.target.closest('.remove-file');
        if (removeFileButton) {
            removeFilePreview();
        }
    });

    // Handle file selection
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                showFilePreview(file);
            }
        });
    }

    // Event listener for Enter key in chat input
    document.addEventListener('keydown', function(event) {
        if (event.target.id === 'userInput' && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-resize textarea as user types
    document.addEventListener('input', function(event) {
        if (event.target.id === 'userInput') {
            const textarea = event.target;
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    });
}

// Function to handle sending messages
function handleSendMessage() {
    console.log('Send button clicked!');
    const chatInput = document.getElementById('userInput');
    const fileInput = document.getElementById('fileInput');
    const chatContainer = document.getElementById('chatContainer');
    
    if (!chatInput || !chatContainer) {
        console.error('Required chat elements not found!');
        return;
    }

    const userInput = chatInput.value.trim();
    if (!userInput) {
        console.log('Empty input, not sending.');
        return;
    }

    if (!selectedAgentId) {
        console.error('No agent ID found');
        appendMessage({
            type: 'error',
            content: {
                message: 'Could not identify the agent',
                details: 'Please go back and select an agent.'
            }
        }, 'agent');
        return;
    }

    console.log('Agent ID:', selectedAgentId);

    // Add user message to chat
    appendMessage({
        type: 'text',
        content: {
            text: userInput
        }
    }, 'user');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Check if a file is selected
    const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

    // Show loading message
    showLoading("Agent is processing the request...");

    // Prepare FormData for the request
    const formData = new FormData();
    formData.append('agentId', selectedAgentId);
    formData.append('userInput', userInput);
    if (file) {
        formData.append('file', file);
        console.log('File attached:', file.name);
    }

    clearFileSelection();


    // Send to backend
    fetch('/api/agent/infer', {
        method: 'POST',
        body: formData // Use FormData instead of JSON.stringify
        // Note: Do not set 'Content-Type' header manually; let the browser set it to multipart/form-data with the correct boundary
    })
    .then(response => {
        hideLoading();
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        hideLoading();
        console.log('Response received:', data);
        appendMessage(data, 'agent');
        
        // Clear file input after successful submission
        if (file && fileInput) {
            fileInput.value = '';
            removeFilePreview();
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error:', error);
        appendMessage({
            type: 'error',
            content: {
                message: 'Error processing request',
                details: error.message
            }
        }, 'agent');
    });
}

// Function to handle file upload
function handleFileUpload(file) {
    console.log('File selected:', file.name);
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        appendMessage({
            type: 'error',
            content: {
                message: 'File too large',
                details: 'Maximum file size is 10MB'
            }
        }, 'agent');
        removeFilePreview();
        return;
    }

    // Create FormData object
    const formData = new FormData();
    formData.append('file', file);
    formData.append('agentId', selectedAgentId);

    // Show loading message
    appendMessage({
        type: 'text',
        content: {
            text: `Uploading file: ${file.name}...`
        }
    }, 'agent');

    // Send file to backend
    fetch('/api/agent/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        return response.json();
    })
    .then(data => {
        console.log('Upload response:', data);
        appendMessage(data, 'agent');
    })
    .catch(error => {
        console.error('Upload error:', error);
        appendMessage({
            type: 'error',
            content: {
                message: 'File upload failed',
                details: error.message
            }
        }, 'agent');
    })
    .finally(() => {
        removeFilePreview();
    });
}

// Function to show file preview
function showFilePreview(file) {
    const previewContainer = document.getElementById('filePreview');
    const imagePreview = document.getElementById('imagePreview');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = fileInfo.querySelector('.file-name');
    const fileSize = fileInfo.querySelector('.file-size');

    // Show preview container
    previewContainer.style.display = 'block';

    // Set file name
    fileName.textContent = file.name;

    // Set file size
    const size = formatFileSize(file.size);
    fileSize.textContent = size;

    // Handle image preview
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.style.display = 'none';
    }
}

// Function to remove file preview
function removeFilePreview() {
    const previewContainer = document.getElementById('filePreview');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');

    previewContainer.style.display = 'none';
    imagePreview.src = '';
    fileInput.value = '';
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to append messages to the chat
function appendMessage(messageData, sender) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${sender}`;
    const icon = document.createElement('i');
    icon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatarDiv.appendChild(icon);

    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${sender}`;

    // Handle different message types
    switch (messageData.type) {
        case 'text':
            contentDiv.textContent = messageData.content.text;
            break;
        case 'error':
            contentDiv.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <div class="error-content">
                        <div class="error-title">${messageData.content.message}</div>
                        ${messageData.content.details ? `<div class="error-details">${messageData.content.details}</div>` : ''}
                    </div>
                </div>
            `;
            break;
        case 'table':
            contentDiv.innerHTML = createTableHTML(messageData.content);
            break;
        case 'chart':
            contentDiv.innerHTML = createChartHTML(messageData.content);
            break;
        case 'code':
            contentDiv.innerHTML = `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${messageData.content.language}</span>
                        <button class="copy-code" onclick="copyCode(this)">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <pre><code class="language-${messageData.content.language}">${messageData.content.code}</code></pre>
                </div>
            `;
            break;
        case 'list':
            contentDiv.innerHTML = `
                <ul class="message-list">
                    ${messageData.content.items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            `;
            break;
        default:
            contentDiv.textContent = JSON.stringify(messageData.content);
    }

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Function to open the multi-agent edit popup
function openMultiAgentEditPopup() {
    const multiAgentId = window.selectedMultiAgentId;
    if (!multiAgentId) {
        console.error('No multi-agent selected to edit.');
        alert('Please select a multi-agent first.');
        return;
    }

    console.log(`Opening edit popup for multi-agent ID: ${multiAgentId}`);

    // Fetch current multi-agent data
    fetch(`/api/multi-agents/${multiAgentId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(multiAgentData => {
            // Assume a modal with ID 'multiAgentEditModal' exists
            const modal = document.getElementById('multiAgentEditModal');
            const nameInput = document.getElementById('editMultiAgentName');
            const descTextarea = document.getElementById('editMultiAgentDescription');
            // TODO: Add logic to populate agent selection/list in the modal
            // const agentListContainer = document.getElementById('editMultiAgentAgents');

            // if (!modal || !nameInput || !descTextarea /* || !agentListContainer */) {
            //     console.error('Edit modal or its elements not found!');
            //     alert('Edit functionality is not properly configured.');
            //     return;
            // }

            

            // Populate modal fields
            // nameInput.value = multiAgentData.name || '';
            // descTextarea.value = multiAgentData.description || '';
            // TODO: Populate agent list based on multiAgentData.agent_ids

            // Store the ID for saving
            // modal.dataset.editingId = multiAgentId;

            // Show the modal (assuming a function or class controls visibility)
            // modal.style.display = 'block'; // Or modal.classList.add('show');
            // TODO: Add logic to handle agent selection population

            // Attach save handler to the modal's save button (assuming ID 'editMultiAgentSaveChangesButton')
             const saveChangesButton = document.getElementById('editMultiAgentSaveChangesButton');
             if (saveChangesButton) {
                 // Remove previous listener to avoid duplicates
                 saveChangesButton.replaceWith(saveChangesButton.cloneNode(true));
                 document.getElementById('editMultiAgentSaveChangesButton').addEventListener('click', handleMultiAgentEditSave);
             }


             // Attach close handler (assuming a close button with class 'close-modal')
            //  const closeButton = modal.querySelector('.close-modal');
            //   if (closeButton) {
            //       closeButton.onclick = () => {
            //           modal.style.display = 'none'; // Or modal.classList.remove('show');
            //       };
            //   }
        })
        .catch(error => {
            console.error('Error fetching multi-agent details for edit:', error);
            alert('Failed to load multi-agent details for editing.');
        });
}

// Function to handle saving changes from the edit modal
function handleMultiAgentEditSave() {
    const modal = document.getElementById('multiAgentEditModal');
    const multiAgentId = modal.dataset.editingId;
    const nameInput = document.getElementById('editMultiAgentName');
    const descTextarea = document.getElementById('editMultiAgentDescription');
     // TODO: Get selected agent IDs from the modal's agent selection element

    if (!multiAgentId || !nameInput || !descTextarea) {
        console.error('Cannot save, missing data or elements.');
        alert('Could not save changes. Required information is missing.');
        return;
    }

    const updatedData = {
        name: nameInput.value,
        description: descTextarea.value,
        agent_ids: [] // TODO: Populate with selected agent IDs from the modal
    };

    console.log(`Saving changes for multi-agent ID: ${multiAgentId}`, updatedData);

    fetch(`/api/multi-agents/${multiAgentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
    })
    .then(response => {
        if (!response.ok) {
             return response.json().then(err => { throw new Error(err.detail || 'Failed to save changes') });
        }
        return response.json();
    })
    .then(() => {
        console.log('Multi-agent changes saved successfully.');
        modal.style.display = 'none'; // Close modal
         // Optionally show a success toast
        showToast('Changes saved successfully', 'success');

        // Refresh the multi-agent details on the main page
        loadMultiAgentDetails(multiAgentId);

         // Also refresh the multi-agent list in the sidebar
        // loadMultiAgents(); // Assuming this function exists and is needed
    })
    .catch(error => {
        console.error('Error saving multi-agent changes:', error);
        alert(`Failed to save changes: ${error.message}`);
         // Optionally show an error toast
         showToast(`Error: ${error.message}`, 'error');
    });
}

// Simple Toast Notification Function (Example)
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // Assumes CSS for .toast and .success/.error/.info
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000); // Remove after 3 seconds
}

// TODO: Ensure the event listener for 'multiAgentEditButton' calls openMultiAgentEditPopup()
// This might be in loadMultiAgentDetails or an initialization function. Example:
// const editButton = document.getElementById('multiAgentEditButton');
// if (editButton) {
//    editButton.onclick = openMultiAgentEditPopup;
// }

// --- Data Connectors Page Functions ---

function initializeDataConnectorsPage() {
    console.log('Initializing Data Connectors page...');
    loadDataConnectors(); // Load the available connector cards
    loadConfiguredConnectorsDisplay(); // Load the new display for configured connectors
    // Setup search listener
    const searchInput = document.getElementById('searchDataConnectorsInput');
    if (searchInput) {
        // Use debounce if needed for performance
        searchInput.addEventListener('input', (e) => searchDataConnectors(e.target.value));
    }
    ensureDataConnectorStyles(); // Ensure styles are loaded
}

async function loadDataConnectors() {
    const connectorsGrid = document.getElementById('dataConnectorsGrid');
    if (!connectorsGrid) {
        console.error("Connectors grid container not found!");
        return;
    }
    connectorsGrid.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading connectors...</div>';

    // --- MOCK DATA --- 
    // Replace this with an actual API call later
    const mockConnectors = [
        // { id: 'qdrant', name: 'Qdrant', description: 'Configure Qdrant Vector Store', icon: '/static/images/connectors/qdrant.svg', connections: 0, docsUrl: '#' },
        // { id: 'weaviate', name: 'Weaviate', description: 'Configure Weaviate Vector Store', icon: '/static/images/connectors/weaviate.svg', connections: 0, docsUrl: '#' },
        // { id: 'pgvector', name: 'PG-Vector', description: 'Configure PG-Vector Vector Store', icon: '/static/images/connectors/pgvector.svg', connections: 0, docsUrl: '#' },
        // { id: 'singlestore', name: 'Singlestore', description: 'Configure Singlestore Vector DB', icon: '/static/images/connectors/singlestore.svg', connections: 0, docsUrl: '#' },
        // { id: 'redshift', name: 'Redshift', description: 'A fully managed, petabyte-scale cloud-based data warehouse service, provided by Amazon Web Services.', icon: '/static/images/connectors/redshift.svg', connections: 0, docsUrl: '#' },
        { id: 'postgres', name: 'Postgres', description: 'An open source object-relational database system that uses and extends SQL.', icon: '/static/images/connectors/postgres.svg', connections: 0, docsUrl: '#' },
        { id: 'mysql', name: 'My SQL', description: 'An open-source relational database management system, developed by Oracle.', icon: '/static/images/connectors/mysql.svg', connections: 0, docsUrl: '#' },
        { id: 'bigquery', name: 'Big Query', description: 'A serverless and scalable multi-cloud data warehouse service, provided by Google Cloud.', icon: '/static/images/connectors/bigquery.svg', connections: 0, docsUrl: '#' },
        // Add more mock connectors as needed based on the image
    ];
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500)); 

    try {
        // In a real scenario, you would fetch from /api/data-connectors
        // const response = await fetch('/api/data-connectors');
        // if (!response.ok) throw new Error('Failed to fetch connectors');
        // const connectors = await response.json();
        renderDataConnectors(mockConnectors); // Use mock data for now
    } catch (error) {
        console.error("Error loading data connectors:", error);
        connectorsGrid.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Failed to load connectors.</div>';
    }
}

// --- New Function to Load Configured Connectors Display ---
async function loadConfiguredConnectorsDisplay() {
    const displayContainer = document.getElementById('configuredConnectorsDisplay');
    if (!displayContainer) {
        console.error("Display container for configured connectors not found!");
        return;
    }

    displayContainer.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading configured connections...</div>';

    try {
        const response = await fetch('/api/data-connectors');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const configuredConnectors = await response.json();

        if (!configuredConnectors || configuredConnectors.length === 0) {
            displayContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <p>No connections configured yet</p>
                </div>
            `;
        return;
    }

        // Create table structure with futuristic design
        displayContainer.innerHTML = `
            <div class="table-responsive">
                <div class="table-container">
                    <div class="table-glow"></div>
                    <table class="connectors-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Host</th>
                                <th>Port</th>
                                <th>Database</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${configuredConnectors.map(connector => `
                                <tr>
                                    <td>
                                        <div class="name-cell">
                                            <div class="cell-icon">
                                                <i class="fas fa-database"></i>
                </div>
                                            ${connector.uniqueName}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="connector-type ${connector.connectorType}">
                                            <i class="fas fa-plug"></i>
                                            ${connector.connectorType}
                                        </span>
                                    </td>
                                    <td>${connector.vectorStoreHost}</td>
                                    <td>${connector.vectorStorePort}</td>
                                    <td>${connector.vectorStoreDBName}</td>
                                    <td class="actions">
                                        <button class="btn-icon btn-edit" onclick="editConnector('${connector.id}', '${connector.connectorType}')" title="Edit">
                                            <i class="fas fa-edit"></i>
                </button>
                                        <button class="btn-icon btn-delete" onclick="deleteConnector('${connector.id}')" title="Delete">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
            </div>
            </div>
        `;

        // Add futuristic styles
        const style = document.createElement('style');
        style.textContent = `
            .table-responsive {
                margin: 20px 0;
                border-radius: 16px;
                overflow: hidden;
                background: linear-gradient(145deg, rgba(20, 21, 38, 0.95), rgba(17, 19, 31, 0.98));
                border: 1px solid rgba(99, 179, 237, 0.15);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                position: relative;
            }

            .table-container {
                overflow-x: auto;
                position: relative;
                z-index: 1;
            }

            .table-glow {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, 
                    rgba(99, 179, 237, 0),
                    rgba(99, 179, 237, 0.5),
                    rgba(99, 179, 237, 0)
                );
                box-shadow: 0 0 20px rgba(99, 179, 237, 0.3);
                z-index: 2;
            }

            .connectors-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                font-size: 14px;
            }

            .connectors-table th,
            .connectors-table td {
                padding: 18px 24px;
                text-align: left;
                border-bottom: 1px solid rgba(99, 179, 237, 0.1);
            }

            .connectors-table th {
                background: rgba(13, 14, 25, 0.9);
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
                text-transform: uppercase;
                font-size: 12px;
                letter-spacing: 1px;
                position: relative;
            }

            .connectors-table th::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, 
                    rgba(99, 179, 237, 0),
                    rgba(99, 179, 237, 0.3),
                    rgba(99, 179, 237, 0)
                );
            }

            .connectors-table tr {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                background: transparent;
            }

            .connectors-table tr:hover {
                background: rgba(99, 179, 237, 0.05);
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }

            .connectors-table td {
                color: rgba(255, 255, 255, 0.7);
            }

            .name-cell {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .cell-icon {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                background: rgba(99, 179, 237, 0.1);
                color: #63b3ed;
                font-size: 14px;
                transition: all 0.3s ease;
            }

            tr:hover .cell-icon {
                transform: scale(1.1);
                background: rgba(99, 179, 237, 0.15);
                box-shadow: 0 0 15px rgba(99, 179, 237, 0.2);
            }

            .connector-type {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                background: rgba(99, 179, 237, 0.1);
                color: #63b3ed;
                border: 1px solid rgba(99, 179, 237, 0.2);
                transition: all 0.3s ease;
            }

            tr:hover .connector-type {
                background: rgba(99, 179, 237, 0.15);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(99, 179, 237, 0.15);
            }

            .actions {
                display: flex;
                gap: 8px;
                opacity: 0.7;
                transition: all 0.3s ease;
            }

            tr:hover .actions {
                opacity: 1;
            }

            .btn-icon {
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.05);
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }

            .btn-icon::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .btn-icon:hover::before {
                opacity: 1;
            }

            .btn-edit:hover {
                background: rgba(99, 179, 237, 0.15);
                color: #63b3ed;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(99, 179, 237, 0.2);
            }

            .btn-delete:hover {
                background: rgba(245, 101, 101, 0.15);
                color: #f56565;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(245, 101, 101, 0.2);
            }

            .empty-state {
                text-align: center;
                padding: 60px 20px;
                background: linear-gradient(145deg, rgba(20, 21, 38, 0.95), rgba(17, 19, 31, 0.98));
                border-radius: 16px;
                border: 1px solid rgba(99, 179, 237, 0.15);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }

            .empty-state i {
                font-size: 48px;
                margin-bottom: 20px;
                color: #63b3ed;
                opacity: 0.8;
                text-shadow: 0 0 20px rgba(99, 179, 237, 0.4);
            }

            .empty-state p {
                color: rgba(255, 255, 255, 0.7);
                font-size: 16px;
                margin: 0;
            }

            .error-message {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 20px;
                background: rgba(245, 101, 101, 0.1);
                border: 1px solid rgba(245, 101, 101, 0.2);
                border-radius: 12px;
                color: #f56565;
                margin: 20px;
            }

            .error-message i {
                font-size: 24px;
                color: #f56565;
            }
        `;
        document.head.appendChild(style);

    } catch (error) {
        console.error("Error loading configured connectors:", error);
        displayContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                Failed to load connections: ${error.message}
            </div>
        `;
    }
}


// ... existing getConnectorIconClass, renderDataConnectors, searchDataConnectors ...


// Ensure styles are loaded/updated
function ensureDataConnectorStyles() {
    const styleId = 'data-connector-styles';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }

    // CSS includes styles for both available connectors grid AND the new configured connectors display
    styleElement.textContent = `
        /* General Page Styles */
            .page.data-connectors .page-description {
                margin-bottom: 25px;
                color: var(--text-secondary);
            max-width: 800px;
            }
            .page.data-connectors .quick-guide-link {
                color: var(--primary-accent);
                text-decoration: none;
                font-weight: 500;
            }
            .page.data-connectors .quick-guide-link:hover {
                text-decoration: underline;
            }
            .search-and-filter {
            margin-bottom: 20px; /* Reduced margin */
            }
            .search-and-filter .search-bar {
                max-width: 450px;
                background-color: var(--input-bg);
            }

        /* Configured Connectors Display Section */
        .configured-connectors-display-section {
            margin-bottom: 45px; /* Space before the "Add New" section */
        }
        .configured-connectors-display-section h2 {
            font-size: 20px; /* Slightly smaller title */
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--text-primary);
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color-light);
        }
        #configuredConnectorsDisplay {
            position: relative;
            min-height: 150px; /* Ensure space for loading/empty states */
            padding-bottom: 10px; /* Space for scrollbar */
        }
        .configured-items-list {
            display: flex;
            gap: 20px;
            overflow-x: auto; /* Enable horizontal scroll */
            padding: 5px 0 15px 0; /* Padding for scrollbar and item shadow */
            scrollbar-width: thin; /* Firefox */
            scrollbar-color: var(--primary-accent-light) var(--background);
        }
        /* Webkit Scrollbar */
        .configured-items-list::-webkit-scrollbar {
            height: 8px;
        }
        .configured-items-list::-webkit-scrollbar-track {
            background: var(--background-secondary);
            border-radius: 4px;
        }
        .configured-items-list::-webkit-scrollbar-thumb {
            background-color: var(--border-color-light);
            border-radius: 4px;
            border: 2px solid var(--background-secondary);
        }
        .configured-items-list::-webkit-scrollbar-thumb:hover {
            background-color: var(--primary-accent-light);
        }

        .configured-connector-item {
            flex: 0 0 auto; /* Prevent shrinking/growing */
            width: 280px; /* Fixed width for each card */
            background: linear-gradient(145deg, var(--background-secondary) 0%, var(--background-gradient-dark) 100%);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            transition: transform 0.25s ease, box-shadow 0.3s ease;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
            position: relative;
            overflow: hidden;
        }
        .configured-connector-item:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
            border-color: var(--primary-accent-faded);
        }
        .configured-connector-item .item-highlight {
            position: absolute;
            top: 0;
            left: 0;
            height: 3px;
            width: 100%;
            background: linear-gradient(90deg, var(--primary-accent), var(--primary-accent-light));
            opacity: 0.8;
        }
        .configured-connector-item .item-header {
            display: flex;
            align-items: center;
            margin-bottom: 18px;
            gap: 12px;
        }
        .configured-connector-item .item-icon {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: var(--primary-accent-faded);
            color: var(--primary-accent);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }
        /* Add specific icon colors if needed */
        .configured-connector-item .item-icon.postgres {
             background: rgba(52, 144, 220, 0.15);
             color: #3490dc;
        }
        .configured-connector-item .item-name {
            font-size: 17px;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0;
            flex-grow: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .configured-connector-item .item-actions {
            display: flex;
            align-items: center;
            margin-left: auto; /* Push actions to the right */
        }
        .configured-connector-item .btn-icon {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            margin-left: 5px;
            color: var(--text-secondary);
            font-size: 14px;
            transition: color 0.2s, transform 0.2s;
        }
        .configured-connector-item .btn-icon:hover {
            transform: scale(1.1);
        }
        .configured-connector-item .btn-edit:hover {
            color: #3b82f6; /* Blue */
        }
        .configured-connector-item .btn-delete:hover {
            color: #ef4444; /* Red */
        }
        .configured-connector-item .item-details {
            margin-bottom: 15px;
            flex-grow: 1; /* Allow details to take up space */
        }
        .configured-connector-item .detail-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 13px;
            color: var(--text-secondary);
        }
         .configured-connector-item .detail-row i {
             width: 14px; /* Align icons */
             text-align: center;
             color: var(--primary-accent-light);
         }
        .configured-connector-item .detail-label {
            font-weight: 500;
            display: inline-flex; /* Align icon and text */
            align-items: center;
            gap: 5px;
        }
        .configured-connector-item .detail-value {
            color: var(--text-primary);
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        .configured-connector-item .item-footer {
             margin-top: auto;
             padding-top: 12px;
             border-top: 1px solid var(--border-color-light);
             font-size: 12px;
             color: var(--text-secondary);
             display: flex;
             align-items: center;
             gap: 6px;
        }
        .configured-connector-item .item-footer i {
            color: var(--primary-accent-light);
        }

        /* Loading/Empty/Error States within the display */
        #configuredConnectorsDisplay .loading-placeholder,
        #configuredConnectorsDisplay .empty-state,
        #configuredConnectorsDisplay .error-message {
             display: flex;
             flex-direction: column;
             align-items: center;
             justify-content: center;
             text-align: center;
             padding: 30px 20px;
             color: var(--text-secondary);
             font-size: 15px;
             position: absolute; /* Center within container */
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             background: var(--background);
             border-radius: 8px;
             opacity: 0;
             visibility: hidden;
             transition: opacity 0.3s, visibility 0.3s;
         }
        #configuredConnectorsDisplay .loading-placeholder.active,
        #configuredConnectorsDisplay .empty-state[style*="block"],
        #configuredConnectorsDisplay .error-message.active {
            opacity: 1;
            visibility: visible;
        }
         #configuredConnectorsDisplay .loading-placeholder i,
         #configuredConnectorsDisplay .empty-state i {
             font-size: 28px;
             margin-bottom: 15px;
             display: block;
             color: var(--primary-accent-light);
         }
         .error-message.full-width {
             width: 100%;
             text-align: center;
             color: var(--error-color);
         }

        /* Add New Connector Section */
        .add-connectors-title {
             font-size: 20px;
             font-weight: 600;
             margin-top: 0; /* Reset top margin */
             margin-bottom: 20px;
             color: var(--text-primary);
             padding-bottom: 10px;
             border-bottom: 1px solid var(--border-color-light);
            }
            .connectors-grid {
                display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); /* Slightly smaller cards */
            gap: 20px;
            }
            .connector-card {
            /* Styles from previous iteration, adjust if needed */
            background: var(--background-secondary);
                border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 20px;
                display: flex;
                flex-direction: column;
                transition: transform 0.2s ease, box-shadow 0.3s ease;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
            }
            .connector-card:hover {
             transform: translateY(-3px);
             box-shadow: 0 5px 15px rgba(0, 0, 0, 0.12);
                border-color: var(--primary-accent-light);
            }
         /* ... rest of connector-card styles ... */
            .connector-card .card-header {
                display: flex;
                align-items: center;
            margin-bottom: 15px;
            gap: 12px;
            }
            .connector-card .connector-icon-wrapper {
             width: 38px;
             height: 38px;
                border-radius: 8px;
                background: linear-gradient(135deg, var(--primary-accent-light), var(--primary-accent));
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
             font-size: 17px;
             flex-shrink: 0;
            }
            .connector-card .connector-name {
             font-size: 18px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0;
                flex-grow: 1;
             white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .connector-card .btn-add-connector {
                background-color: transparent;
                color: var(--primary-accent);
                border: 1px solid var(--primary-accent-light);
             padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
             font-size: 12px;
                font-weight: 500;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
             .connector-card .btn-add-connector:hover {
                 background-color: var(--primary-accent-faded);
                 border-color: var(--primary-accent);
                 color: var(--primary-contrast);
             }
             .connector-card .btn-add-connector i {
                 margin-right: 4px;
              font-size: 11px;
             }
            .connector-card .connector-description {
             font-size: 13px;
                color: var(--text-secondary);
             margin-bottom: 20px;
                flex-grow: 1; 
             line-height: 1.5;
            }
            .connector-card .card-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: auto; 
             padding-top: 12px;
                border-top: 1px solid var(--border-color-light);
             font-size: 12px;
            }
            .connector-card .connections-info {
                background-color: var(--tag-bg);
                color: var(--tag-text);
             padding: 4px 8px;
             border-radius: 10px;
                font-weight: 500;
             font-size: 11px;
            }
            .connector-card .docs-link {
                color: var(--text-link);
                text-decoration: none;
                display: inline-flex;
                align-items: center;
             gap: 4px;
            }
             .connector-card .docs-link:hover {
                 color: var(--primary-accent);
                 text-decoration: underline;
             }
             .connector-card .docs-link i {
              font-size: 10px;
             }
          /* Loading/Empty states for grid */
          .connectors-grid .loading-placeholder,
          .connectors-grid .empty-state,
          .connectors-grid .error-message {
                 grid-column: 1 / -1; 
                 text-align: center;
            padding: 40px 20px;
                 color: var(--text-secondary);
            font-size: 15px;
             }
         .connectors-grid .loading-placeholder i {
                 margin-right: 8px;
             }
         .connectors-grid .empty-state i {
             font-size: 30px;
             margin-bottom: 15px;
             display: block;
             color: var(--primary-accent-light);
         }
    `;

}


// Function to show Postgres connection configuration modal
// ... existing modal code ...

// Function to close connector configuration modal
// ... existing modal code ...

// Function to test PostgreSQL connection
// ... existing test connection code ...

// Function to save PostgreSQL connection
async function savePostgresConnection(isEditing = false) {
    const form = document.getElementById('postgresConnectionForm');
    if (!form) return;

    // Basic form validation
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Validate required fields
    const requiredFields = ['uniqueName', 'vectorStoreUser', 'vectorStoreHost', 'vectorStorePassword', 'vectorStorePort', 'vectorStoreDBName'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
        showToast(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }

    // If editing and password is empty, remove it from payload
    if (isEditing && !data.vectorStorePassword) {
        // delete data.vectorStorePassword;
    } else if (!isEditing && !data.vectorStorePassword) {
        showToast('Password is required for new connections', 'error');
        return;
    }

    // Add connector type
    data.connectorType = 'postgres';

    showLoading('Saving connection...');
    
    try {
        const url = isEditing ? `/api/data-connectors/${data.id}` : '/api/data-connectors';
        const method = isEditing ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to save connection');
        }

        // Close modal and show success message
        closeConnectorModal();
        showToast(isEditing ? 'Connection updated successfully!' : 'Connection saved successfully!', 'success');
        
        // Reload the configured connectors display
        await loadConfiguredConnectorsDisplay();

    } catch (error) {
        console.error('Error saving connection:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// --- New Edit/Delete Functions ---
async function editConnector(connectorId, connectorType) {
    console.log(`Editing connector: ${connectorId}, Type: ${connectorType}`);
    
    if (connectorType === 'postgres') {
        showLoading('Loading connection details...');
        try {
            // Fetch ALL connectors first to find the one we need
            // This is inefficient but necessary if GET /api/data-connectors/{id} doesn't exist
            const response = await fetch(`/api/data-connectors`); 
            if (!response.ok) throw new Error('Failed to fetch connectors');
            const connectors = await response.json();
            const connectorToEdit = connectors.find(c => c.id === connectorId);
            
            hideLoading();
            
            if (connectorToEdit) {
                showPostgresConnectionModal(connectorToEdit); // Open modal with pre-filled data
            } else {
                showToast('Error: Connector not found.', 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('Error fetching connector for edit:', error);
            showToast(`Error loading details: ${error.message}`, 'error');
        }
    } else {
        alert(`Editing for connector type '${connectorType}' is not yet implemented.`);
    }
}

async function deleteConnector(connectorId) {
    if (!confirm('Are you sure you want to delete this connection?')) {
        return;
    }

    showLoading('Deleting connection...');

    try {
        const response = await fetch(`/api/data-connectors/${connectorId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete connection');
        }

        // Show success message
        showToast('Connection deleted successfully', 'success');
        
        // Refresh the configured connectors display
        await loadConfiguredConnectorsDisplay();

    } catch (error) {
        console.error('Error deleting connection:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}
// --- End Edit/Delete Functions ---

// ... existing code ...
// }


// --- Helper function to get Connector Icon Class (Reinstated) ---
function getConnectorIconClass(connectorId) {
    // Map specific IDs to icons - add more as needed
    switch (connectorId.toLowerCase()) {
        case 'qdrant': return 'fas fa-database'; // Example
        case 'weaviate': return 'fas fa-wave-square'; // Example
        case 'pgvector': return 'fas fa-database'; // Example
        case 'postgres': return 'fas fa-database'; // Example for configured type
        case 'mysql': return 'fas fa-database'; // Example
        case 'bigquery': return 'fab fa-google'; // Example
        // Add more mappings based on your actual connector types/IDs
        default: return 'fas fa-plug'; // Default plug icon
    }
}

// --- Function to render AVAILABLE connectors grid (Reinstated) ---
function renderDataConnectors(connectors) {
    const connectorsGrid = document.getElementById('dataConnectorsGrid');
    if (!connectorsGrid) return;

    if (!connectors || connectors.length === 0) {
        connectorsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-plug"></i>
                </div>
                <h3>No Data Connectors Available</h3>
                <p>No connectors have been configured yet.</p>
            </div>`;
        return;
    }

    connectorsGrid.innerHTML = connectors.map(connector => {
        const iconClass = getConnectorIconClass(connector.id);
        return `
            <div class="connector-card">
                <div class="card-glow"></div>
                <div class="card-content">
                    <div class="card-header">
                        <div class="connector-icon-wrapper">
                            <div class="icon-glow"></div>
                            <i class="${iconClass}"></i>
                        </div>
                        <h3 class="connector-name">${connector.name}</h3>
                        <button class="btn-add-connector" onclick="addConnector('${connector.id}')">
                            <span class="btn-glow"></span>
                            <i class="fas fa-plus"></i>
                            Configure
                        </button>
                    </div>
                    <p class="connector-description">${connector.description}</p>
                    <div class="card-footer">
                        
                        <a href="${connector.docsUrl || '#'}" target="_blank" class="docs-link">
                            <span>Documentation</span>
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add enhanced futuristic styles
    const style = document.createElement('style');
    style.textContent = `
        .connectors-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 24px;
            padding: 12px;
            position: relative;
        }

        .connector-card {
            position: relative;
            background: linear-gradient(165deg, 
                rgba(30, 41, 59, 0.95),
                rgba(17, 25, 40, 0.97)
            );
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(99, 179, 237, 0.1);
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
        }

        .connector-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(
                circle at center,
                rgba(99, 179, 237, 0.1),
                transparent 70%
            );
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            z-index: 1;
        }

        .connector-card:hover::before {
            opacity: 1;
            animation: rotateGradient 3s linear infinite;
        }

        @keyframes rotateGradient {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .card-glow {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg,
                rgba(99, 179, 237, 0),
                rgba(99, 179, 237, 0.5),
                rgba(99, 179, 237, 0)
            );
            box-shadow: 0 0 20px rgba(99, 179, 237, 0.3);
            z-index: 2;
        }

        .card-content {
            position: relative;
            z-index: 3;
            padding: 24px;
        }

        .connector-card:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3),
                        0 0 20px rgba(99, 179, 237, 0.1),
                        inset 0 0 20px rgba(99, 179, 237, 0.1);
        }

        .connector-icon-wrapper {
            position: relative;
            width: 52px;
            height: 52px;
            border-radius: 15px;
            background: linear-gradient(135deg,
                rgba(99, 179, 237, 0.2),
                rgba(66, 153, 225, 0.3)
            );
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #63b3ed;
            margin-right: 16px;
            transition: all 0.3s ease;
            overflow: hidden;
        }

        .icon-glow {
            position: absolute;
            inset: 0;
            background: radial-gradient(
                circle at center,
                rgba(99, 179, 237, 0.3),
                transparent 70%
            );
            opacity: 0;
            transition: opacity 0.3s;
        }

        .connector-card:hover .icon-glow {
            opacity: 1;
            animation: pulseGlow 2s infinite;
        }

        @keyframes pulseGlow {
            0% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.2); opacity: 0.5; }
            100% { transform: scale(1); opacity: 0.3; }
        }

        .card-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            position: relative;
        }

        .connector-name {
            font-size: 20px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            margin: 0;
            flex-grow: 1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            letter-spacing: 0.5px;
        }

        .connector-description {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 24px;
            position: relative;
        }

        .btn-add-connector {
            position: relative;
            background: linear-gradient(135deg,
                rgba(99, 179, 237, 0.2),
                rgba(66, 153, 225, 0.3)
            );
            border: 1px solid rgba(99, 179, 237, 0.3);
            color: #63b3ed;
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            overflow: hidden;
        }

        .btn-glow {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg,
                transparent,
                rgba(255, 255, 255, 0.2),
                transparent
            );
            transform: translateX(-100%);
            transition: transform 0.3s;
        }

        .btn-add-connector:hover .btn-glow {
            transform: translateX(100%);
        }

        .btn-add-connector:hover {
            background: linear-gradient(135deg,
                rgba(99, 179, 237, 0.3),
                rgba(66, 153, 225, 0.4)
            );
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 179, 237, 0.2);
        }

        .card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: auto;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .connections-info {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: rgba(99, 179, 237, 0.1);
            border: 1px solid rgba(99, 179, 237, 0.2);
            border-radius: 20px;
            color: #63b3ed;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.3s ease;
        }

        .connector-card:hover .connections-info {
            background: rgba(99, 179, 237, 0.15);
            box-shadow: 0 2px 8px rgba(99, 179, 237, 0.15);
        }

        .docs-link {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            font-size: 13px;
            transition: all 0.3s ease;
        }

        .docs-link:hover {
            color: #63b3ed;
            transform: translateX(4px);
        }

        .docs-link i {
            font-size: 12px;
            transition: transform 0.3s ease;
        }

        .docs-link:hover i {
            transform: translateX(2px);
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(165deg,
                rgba(30, 41, 59, 0.95),
                rgba(17, 25, 40, 0.97)
            );
            border-radius: 20px;
            border: 1px solid rgba(99, 179, 237, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            grid-column: 1 / -1;
        }

        .empty-state-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg,
                rgba(99, 179, 237, 0.2),
                rgba(66, 153, 225, 0.3)
            );
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            color: #63b3ed;
            position: relative;
        }

        .empty-state-icon::after {
            content: '';
            position: absolute;
            inset: -5px;
            border-radius: 50%;
            background: linear-gradient(135deg,
                rgba(99, 179, 237, 0.1),
                transparent
            );
            animation: rotateGlow 3s linear infinite;
        }

        @keyframes rotateGlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .empty-state h3 {
            color: rgba(255, 255, 255, 0.9);
            font-size: 20px;
            margin: 0 0 12px;
        }

        .empty-state p {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            margin: 0;
             }
        `;
        document.head.appendChild(style);
    }

// --- Function to load AVAILABLE connectors (Ensure it calls renderDataConnectors) ---
async function loadDataConnectors() {
    const connectorsGrid = document.getElementById('dataConnectorsGrid');
    if (!connectorsGrid) {
        console.error("Available connectors grid container not found!");
        return;
    }
    connectorsGrid.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading connectors...</div>';

    // --- MOCK DATA --- 
    // Replace this with an actual API call later if needed for AVAILABLE connectors
    // Or potentially just use a static list if these don't change often.
    const mockConnectors = [
        { id: 'postgres', name: 'Postgres', description: 'An open source object-relational database system that uses and extends SQL.', icon: '/static/images/connectors/postgres.svg', connections: 0, docsUrl: 'https://www.postgresql.org/docs/' },
        { id: 'mysql', name: 'My SQL', description: 'An open-source relational database management system, developed by Oracle.', icon: '/static/images/connectors/mysql.svg', connections: 0, docsUrl: 'https://dev.mysql.com/doc/' },
        { id: 'bigquery', name: 'Big Query', description: 'A serverless and scalable multi-cloud data warehouse service, provided by Google Cloud.', icon: '/static/images/connectors/bigquery.svg', connections: 0, docsUrl: 'https://cloud.google.com/bigquery/docs' },
    ];
    
    try {
        // Simulate API delay if needed
        await new Promise(resolve => setTimeout(resolve, 100)); 
        // Call the reinstated render function
        renderDataConnectors(mockConnectors);
    } catch (error) { // This catch block might not be needed if using static data
        console.error("Error loading available data connectors:", error);
        connectorsGrid.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Failed to load available connectors.</div>';
    }
}


// --- Search function for AVAILABLE connectors ---
function searchDataConnectors(query) {
    const searchQuery = query.toLowerCase().trim();
    const connectorCards = document.querySelectorAll('#dataConnectorsGrid .connector-card');

    connectorCards.forEach(card => {
        const name = card.querySelector('.connector-name').textContent.toLowerCase();
        const description = card.querySelector('.connector-description').textContent.toLowerCase();
        
        const matches = name.includes(searchQuery) || description.includes(searchQuery);
        card.style.display = matches ? '' : 'none';
    });
}

// --- Add Connector Action ---
function addConnector(connectorId) {
    console.log(`Add connector clicked: ${connectorId}`);
    
    // Special handling for Postgres
    if (connectorId === 'postgres') {
        showPostgresConnectionModal(); // Show modal for new connection
        return;
    }
    
    // Generic message for other connectors (can implement others later)
    showToast(`Configuration for ${connectorId} is not yet implemented.`, 'info');
}


// Ensure styles are loaded/updated
// ... rest of the file ...

// --- Postgres Connection Modal Functions (Reinstated) ---

// Function to show Postgres connection configuration modal
function showPostgresConnectionModal(connectorData = null) { // Accept optional data for editing
    // Create modal if it doesn't exist or get existing one
    let modal = document.getElementById('connectorConfigModal');
    if (modal) {
        modal.remove(); // Remove existing to avoid stacking modals
    }
    
    // Create new modal
    modal = document.createElement('div');
    modal.id = 'connectorConfigModal';
    modal.className = 'modal';
    
    const isEditing = connectorData !== null;
    const title = isEditing ? `Edit Connection: ${connectorData.uniqueName}` : 'Connect Postgres Vector Store'; // Updated title
    const submitButtonText = isEditing ? 'Save Changes' : 'Submit';
    
    // Generate form fields for Postgres connection
    const modalHtml = `
        <div class="modal-content connector-config-modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="close-btn" onclick="closeConnectorModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="postgresConnectionForm">
                    <input type="hidden" id="connectorId" name="id" value="${isEditing ? connectorData.id : ''}">
                    <div class="form-group">
                        <label for="uniqueName">Unique Name <span class="required">*</span></label>
                        <input type="text" id="uniqueName" name="uniqueName" placeholder="Give this connection a name" required value="${isEditing ? connectorData.uniqueName : ''}">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group half">
                            <label for="vectorStoreUser">Vector Store User <span class="required">*</span></label>
                            <input type="text" id="vectorStoreUser" name="vectorStoreUser" placeholder="Enter Vector Store User" required value="${isEditing ? connectorData.vectorStoreUser : ''}">
                        </div>
                        <div class="form-group half">
                            <label for="vectorStoreHost">Vector Store Host <span class="required">*</span></label>
                            <input type="text" id="vectorStoreHost" name="vectorStoreHost" placeholder="Enter Vector Store Host" required value="${isEditing ? connectorData.vectorStoreHost : ''}">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group half">
                            <label for="vectorStorePassword">Vector Store Password ${isEditing ? '' : '<span class="required">*</span>'}</label>
                            <input type="password_text" id="vectorStorePassword" name="vectorStorePassword" placeholder="${isEditing ? 'Enter new password to update' : 'Enter Vector Store Password'}" ${isEditing ? '' : 'required'} value="${isEditing ? connectorData.vectorStorePassword : ''}">
                        </div>
                        <div class="form-group half">
                            <label for="vectorStorePort">Vector Store Port <span class="required">*</span></label>
                            <input type="text" id="vectorStorePort" name="vectorStorePort" placeholder="Enter Vector Store Port" required value="${isEditing ? connectorData.vectorStorePort : ''}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="vectorStoreDBName">Vector Store DB Name <span class="required">*</span></label>
                        <input type="text" id="vectorStoreDBName" name="vectorStoreDBName" placeholder="Enter Vector Store DB Name" required value="${isEditing ? connectorData.vectorStoreDBName : ''}">
                    </div>
                    
                    <div class="legal-text">
                        <p>By using this service, you agree to take full responsibility for your actions and to protect IAgentic Studio and its affiliates, officers, employees, and agents from any claims, losses, damages, liabilities, or legal costs that may arise due to your violation of this policy — including, but not limited to, uploading sensitive personal information without proper authorization.</p>
                    </div>
                    
                    <div class="documentation-link">
                        <a href="https://www.postgresql.org/docs/" target="_blank">
                            <i class="fas fa-external-link-alt"></i> View Documentation
                        </a>
                    </div>
                    
                    <div class="required-note">
                        <span class="required">*</span> marked as required
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-test-connection" onclick="testPostgresConnection()">
                    <i class="fas fa-plug"></i> Test Connection
                </button>
                <div class="action-buttons">
                    <button class="btn-cancel" onclick="closeConnectorModal()">Cancel</button>
                    <button class="btn-submit" onclick="savePostgresConnection(${isEditing})">${submitButtonText}</button> 
                </div>
            </div>
        </div>
    `;
    
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    
    // Add modal styles if they don't exist
    ensureConnectorModalStyles();
    
    // Show the modal
    setTimeout(() => {
        modal.classList.add('show');
    }, 50);
}

// Function to close connector configuration modal
function closeConnectorModal() {
    const modal = document.getElementById('connectorConfigModal');
    if (modal) {
        modal.classList.remove('show');
        // Remove after animation finishes
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Function to test PostgreSQL connection
async function testPostgresConnection() {
    // Get connection details
    const form = document.getElementById('postgresConnectionForm');
    if (!form) return;
    
    // Basic form validation
    const formData = new FormData(form);
    const connectionConfig = Object.fromEntries(formData.entries());
    
    // Check if required fields are filled
    const requiredFields = ['vectorStoreUser', 'vectorStoreHost', 'vectorStorePort', 'vectorStoreDBName'];
    const missingFields = requiredFields.filter(field => !connectionConfig[field]);
    
    if (missingFields.length > 0) {
        showToast(`Please fill in required fields: ${missingFields.join(', ')}`, 'error');
            return;
    }
    
    // Show loading state on the test button
    const testBtn = document.querySelector('#connectorConfigModal .btn-test-connection');
    const originalBtnText = testBtn.innerHTML;
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    
    try {
        const response = await fetch('/api/data-connectors/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'postgres',
                config: {
                    host: connectionConfig.vectorStoreHost,
                    port: connectionConfig.vectorStorePort,
                    database: connectionConfig.vectorStoreDBName,
                    user: connectionConfig.vectorStoreUser,
                    password: connectionConfig.vectorStorePassword || undefined
                }
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Connection successful! ✨', 'success');
            
            // Add success visual feedback to the form
            const successIndicator = document.createElement('div');
            successIndicator.className = 'connection-success-indicator';
            successIndicator.innerHTML = `
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="success-message">Connection verified</div>
            `;
            
            // Remove any existing indicator
            const existingIndicator = form.querySelector('.connection-success-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Add the new indicator
            form.appendChild(successIndicator);
            
            // Add success styles
            const style = document.createElement('style');
            style.textContent = `
                .connection-success-indicator {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: rgba(72, 187, 120, 0.1);
                    border: 1px solid rgba(72, 187, 120, 0.2);
                    border-radius: 8px;
                    margin-top: 16px;
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .success-icon {
                    color: #48bb78;
                    font-size: 20px;
                    animation: scaleIn 0.3s ease;
                }

                @keyframes scaleIn {
                    from {
                        transform: scale(0);
                    }
                    to {
                        transform: scale(1);
                    }
                }

                .success-message {
                    color: #48bb78;
                    font-size: 14px;
                    font-weight: 500;
                }
            `;
            document.head.appendChild(style);
        } else {
            throw new Error(result.detail || 'Connection test failed');
        }
    } catch (error) {
        console.error('Connection test error:', error);
        showToast(`Connection failed: ${error.message}`, 'error');
        
        // Add error visual feedback
        const errorIndicator = document.createElement('div');
        errorIndicator.className = 'connection-error-indicator';
        errorIndicator.innerHTML = `
            <div class="error-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="error-details">
                <div class="error-message">Connection failed</div>
                <div class="error-description">${error.message}</div>
            </div>
        `;
        
        // Remove any existing indicator
        const existingIndicator = form.querySelector('.connection-error-indicator, .connection-success-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Add the new indicator
        form.appendChild(errorIndicator);
        
        // Add error styles
        const style = document.createElement('style');
        style.textContent = `
            .connection-error-indicator {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px 16px;
                background: rgba(245, 101, 101, 0.1);
                border: 1px solid rgba(245, 101, 101, 0.2);
                border-radius: 8px;
                margin-top: 16px;
                animation: slideIn 0.3s ease;
            }

            .error-icon {
                color: #f56565;
                font-size: 20px;
                padding-top: 2px;
            }

            .error-details {
                flex: 1;
            }

            .error-message {
                color: #f56565;
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 4px;
            }

            .error-description {
                color: rgba(245, 101, 101, 0.8);
                font-size: 12px;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    } finally {
        // Reset button state
        testBtn.disabled = false;
        testBtn.innerHTML = originalBtnText;
    }
}

// Function to add modal-specific CSS
function ensureConnectorModalStyles() {
    if (!document.getElementById('connector-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'connector-modal-styles';
        // Paste the full CSS content for the modal here
        style.textContent = `
            #connectorConfigModal.modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
            }
            
            #connectorConfigModal.modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            #connectorConfigModal .modal-content {
                background: linear-gradient(135deg, #1a1f35, #2a3045);
                border: 1px solid rgba(99, 179, 237, 0.3);
                border-radius: 16px;
                width: 100%;
                max-width: 900px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 10, 20, 0.5),
                            inset 0 0 0 1px rgba(255, 255, 255, 0.05);
                position: relative;
                animation: modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            
            @keyframes modalSlideIn {
                from {
                    transform: translateY(-30px) scale(0.97);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }
            
            #connectorConfigModal .modal-header {
                padding: 24px 28px;
                border-bottom: 1px solid rgba(99, 179, 237, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(to right, rgba(30, 40, 70, 0.6), rgba(20, 30, 60, 0.4));
                border-radius: 16px 16px 0 0;
            }
            
            #connectorConfigModal .modal-header h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                letter-spacing: 0.5px;
            }
            
            #connectorConfigModal .close-btn {
                background: rgba(255, 255, 255, 0.05);
                border: none;
                font-size: 22px;
                cursor: pointer;
                color: rgba(255, 255, 255, 0.7);
                transition: all 0.2s;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                padding: 0;
            }
            
            #connectorConfigModal .close-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                color: rgba(255, 255, 255, 1);
                transform: rotate(90deg);
            }
            
            #connectorConfigModal .modal-body {
                padding: 28px;
                position: relative;
                overflow-x: hidden;
            }
            
            #connectorConfigModal #postgresConnectionForm {
                display: flex;
                flex-direction: column;
                gap: 12px; 
            }
            
            #connectorConfigModal .form-group {
                margin-bottom: 16px;
                position: relative;
            }
            
            #connectorConfigModal .form-row {
                display: flex;
                gap: 24px;
                margin-bottom: 16px;
                align-items: stretch;
            }
            
            #connectorConfigModal .form-group.half {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
            }
            
            #connectorConfigModal .form-group label {
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
                font-size: 15px;
                color: rgba(255, 255, 255, 0.85);
                letter-spacing: 0.3px;
            }
            
            #connectorConfigModal .form-group input {
                box-sizing: border-box;
                width: 100%;
                height: 46px;
                padding: 12px 16px;
                border: 1px solid rgba(99, 179, 237, 0.3);
                border-radius: 8px;
                background-color: rgba(20, 30, 60, 0.5);
                color: rgba(255, 255, 255, 0.95);
                font-size: 15px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15),
                            inset 0 1px 0 rgba(255, 255, 255, 0.05);
                transition: all 0.2s;
                margin: 0;
                caret-color: #63b3ed;
            }
            
            #connectorConfigModal .form-group input::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            #connectorConfigModal .form-group input:focus {
                border-color: rgba(99, 179, 237, 0.7);
                outline: none;
                background-color: rgba(30, 40, 70, 0.6);
                box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.25),
                            inset 0 1px 0 rgba(255, 255, 255, 0.05);
            }
            
            #connectorConfigModal .modal-body::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: 
                    radial-gradient(rgba(99, 179, 237, 0.03) 1px, transparent 1px),
                    radial-gradient(rgba(99, 179, 237, 0.02) 1px, transparent 1px);
                background-size: 25px 25px;
                background-position: 0 0, 12.5px 12.5px;
                pointer-events: none;
                z-index: -1;
            }
            
            #connectorConfigModal .modal-footer {
                padding: 20px 28px;
                border-top: 1px solid rgba(99, 179, 237, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(to right, rgba(20, 30, 60, 0.4), rgba(30, 40, 70, 0.6));
                border-radius: 0 0 16px 16px;
            }
            
            #connectorConfigModal .legal-text {
                background-color: rgba(0, 10, 30, 0.3);
                border-radius: 12px;
                padding: 18px;
                margin: 16px 0 24px 0;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.6);
                line-height: 1.6;
                border: 1px solid rgba(99, 179, 237, 0.15);
            }
            
            #connectorConfigModal .legal-text p {
                margin: 0 0 10px 0;
            }
            
            #connectorConfigModal .legal-text p:last-child {
                margin-bottom: 0;
            }
            
            #connectorConfigModal .documentation-link {
                margin: 8px 0 24px 0;
                padding: 12px 16px;
                background: rgba(99, 179, 237, 0.08);
                border-radius: 8px;
                display: inline-block;
            }
            
            #connectorConfigModal .documentation-link a {
                color: #63b3ed;
                text-decoration: none;
                font-size: 14px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            #connectorConfigModal .documentation-link a:hover {
                color: #90cdf4;
                transform: translateX(3px);
            }
            
            #connectorConfigModal .documentation-link a i {
                transition: transform 0.2s;
            }
            
            #connectorConfigModal .documentation-link a:hover i {
                transform: translateX(2px);
            }
            
            #connectorConfigModal .required-note {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.5);
                margin: 10px 0;
            }
            
            #connectorConfigModal .required {
                color: #f56565;
                margin-left: 2px;
            }
            
            #connectorConfigModal .btn-test-connection {
                background: linear-gradient(135deg, rgba(32, 121, 210, 0.2), rgba(28, 85, 176, 0.3));
                border: 1px solid rgba(99, 179, 237, 0.4);
                color: rgba(255, 255, 255, 0.9);
                padding: 12px 20px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 12px;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2),
                            inset 0 1px 0 rgba(255, 255, 255, 0.1);
                letter-spacing: 0.5px;
                text-transform: uppercase;
                min-width: 180px;
                justify-content: center;
            }
            
            #connectorConfigModal .btn-test-connection::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(
                    45deg,
                    transparent,
                    rgba(129, 199, 245, 0.2),
                    transparent
                );
                transform: rotate(45deg);
                opacity: 0;
                z-index: 1;
            }
            
            #connectorConfigModal .btn-test-connection:hover {
                background: linear-gradient(135deg, rgba(47, 133, 220, 0.3), rgba(38, 106, 207, 0.4));
                color: white;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(0, 20, 60, 0.3),
                            inset 0 1px 0 rgba(255, 255, 255, 0.15);
                border-color: rgba(99, 179, 237, 0.7);
            }
            
            #connectorConfigModal .btn-test-connection:hover::before {
                animation: shine 1.5s infinite;
                opacity: 1;
            }
            
            @keyframes shine {
                0% { transform: rotate(45deg) translate(-100%, -100%); }
                100% { transform: rotate(45deg) translate(100%, 100%); }
            }
            
            #connectorConfigModal .btn-test-connection:active {
                transform: translateY(1px);
                box-shadow: 0 4px 12px rgba(0, 20, 60, 0.25);
            }
            
            #connectorConfigModal .btn-test-connection i {
                font-size: 16px;
                margin-right: 2px;
                color: rgba(129, 199, 245, 0.9);
                transition: all 0.3s;
                z-index: 2;
            }
            
            #connectorConfigModal .btn-test-connection:hover i {
                color: white;
                transform: rotate(15deg);
            }
            
            #connectorConfigModal .btn-test-connection:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            
            #connectorConfigModal .action-buttons {
                display: flex;
                gap: 16px;
            }
            
            #connectorConfigModal .btn-cancel {
                background: rgba(30, 41, 72, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: rgba(255, 255, 255, 0.8);
                padding: 12px 24px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                min-width: 120px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                position: relative;
                overflow: hidden;
            }
            
            #connectorConfigModal .btn-cancel::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    to bottom,
                    rgba(255, 255, 255, 0.08),
                    transparent
                );
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            #connectorConfigModal .btn-cancel:hover {
                background: rgba(45, 55, 96, 0.6);
                color: white;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
                border-color: rgba(255, 255, 255, 0.25);
            }
            
            #connectorConfigModal .btn-cancel:hover::after {
                opacity: 1;
            }
            
            #connectorConfigModal .btn-cancel:active {
                transform: translateY(1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            
            #connectorConfigModal .btn-submit {
                background: linear-gradient(135deg, #3182ce, #4c51bf);
                border: none;
                color: white;
                padding: 12px 28px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 6px 18px rgba(49, 130, 206, 0.35),
                            inset 0 1px 0 rgba(255, 255, 255, 0.1);
                min-width: 140px;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                position: relative;
                overflow: hidden;
                z-index: 1;
            }
            
            #connectorConfigModal .btn-submit::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(255, 255, 255, 0.3), 
                    transparent);
                transition: left 0.7s ease;
                z-index: -1;
            }
            
            #connectorConfigModal .btn-submit:hover {
                background: linear-gradient(135deg, #4299e1, #5a67d8);
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(49, 130, 206, 0.45),
                            0 0 20px rgba(66, 153, 225, 0.3);
            }
            
            #connectorConfigModal .btn-submit:hover::before {
                animation: shimmer 2s infinite;
            }
            
            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            #connectorConfigModal .btn-submit:active {
                transform: translateY(1px);
                box-shadow: 0 6px 12px rgba(49, 130, 206, 0.3);
            }
            
            @media (max-width: 768px) {
                #connectorConfigModal .form-row {
                    flex-direction: column;
                    gap: 16px;
                }
                
                #connectorConfigModal .form-group.half {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Function to save PostgreSQL connection
// ... existing function ...

// Edit/Delete Functions
// ... existing functions ...

// ... rest of the file ...




// Existing imports and variables (from your snippet)
let currentAdvancedToolId = null;
let advancedTools = [];

// Function to load normal tools (assumed to exist, adjust name if different)
async function loadTools() {
    try {
        const response = await fetch('/api/tools');
        const tools = await response.json();
        const toolsList = document.getElementById('toolsList'); // Adjust ID as needed
        if (!toolsList) return;

        toolsList.innerHTML = '';
        tools.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.className = 'tool-card';
            toolCard.innerHTML = `
                <h3>${tool.name}</h3>
                <p>${tool.description}</p>
                <div class="tool-tags">
                    ${tool.tags.map(tag => `<span class="tool-tag">${tag}</span>`).join('')}
                </div>
                <div class="tool-actions">
                    <button onclick="addTool('${tool.id}')" class="futuristic-btn">
                        <i class="fas fa-plus"></i> ${tool.is_added ? 'Added' : 'Add'}
                    </button>
                </div>
            `;
            toolsList.appendChild(toolCard);
        });
    } catch (error) {
        console.error('Error loading tools:', error);
        showNotification('Error loading tools', 'error');
    }
}

// Your existing loadAdvancedTools function (unchanged)
async function loadAdvancedTools() {
    try {
        const response = await fetch('/api/advanced-tools');
        const tools = await response.json();
        advancedTools = tools;
        const toolsList = document.getElementById('advancedToolsList');
        if (!toolsList) return;
        
        toolsList.innerHTML = '';
        tools.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.className = 'advanced-tool-card';
            toolCard.innerHTML = `
                <h3>${tool.name}</h3>
                <p>${tool.description}</p>
                <div class="advanced-tool-tags">
                    ${tool.tags.map(tag => `
                        <span class="advanced-tool-tag">${tag}</span>
                    `).join('')}
                </div>
                ${tool.data_connector_id ? `
                    <div class="advanced-tool-connector">
                        <i class="fas fa-database"></i> <i>Connected to:</i> <b>${tool.connector_uniqueName} (${tool.connectorType})</b>
                    </div>
                ` : ''}
                <div class="advanced-tool-actions">
                    <button onclick="editAdvancedTool('${tool.id}')" class="futuristic-btn">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteAdvancedTool('${tool.id}')" class="futuristic-btn" style="background: linear-gradient(90deg, #ff416c, #ff4b2b);">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            toolsList.appendChild(toolCard);
        });
    } catch (error) {
        console.error('Error loading advanced tools:', error);
        showNotification('Error loading advanced tools', 'error');
    }
}

// New function to initialize the /tools page
function initToolsPage() {
    // Load both normal and advanced tools
    loadTools();
    loadAdvancedTools();
}

// Page load handler
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the /tools page
    if (window.location.pathname === '/tools' || window.location.pathname === '/tools/') {
        initToolsPage();
    }
});

// Existing functions (unchanged)
function showCreateAdvancedTool() {
    loadDataConnectorsForAdvancedTool();
    const modal = document.getElementById('createAdvancedToolModal');
    if (modal) {
        modal.style.display = 'block';
        setTimeout(() => {
            const nameField = document.getElementById('newAdvancedToolName');
            if (nameField) nameField.focus();
        }, 300);
    }
}

function closeCreateAdvancedTool() {
    const modal = document.getElementById('createAdvancedToolModal');
    if (modal) {
        modal.style.display = 'none';
        const fields = [
            'newAdvancedToolName',
            'newAdvancedToolDescription',
            'newAdvancedToolTags',
            'newAdvancedToolConnector',
            'newAdvancedToolSchema'
        ];
        fields.forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });
    }
}

async function loadDataConnectorsForAdvancedTool() {
    try {
        const response = await fetch('/api/data-connectors');
        const connectors = await response.json();
        const select = document.getElementById('newAdvancedToolConnector');
        if (!select) return;
        
        while (select.options.length > 1) {
            select.options.remove(1);
        }
        
        connectors.forEach(connector => {
            const option = document.createElement('option');
            option.value = connector.id;
            option.textContent = connector.uniqueName;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading data connectors:', error);
        showNotification('Failed to load data connectors', 'error');
    }
}

function formatJson() {
    const schemaField = document.getElementById('newAdvancedToolSchema');
    if (!schemaField) return;
    
    try {
        const formatted = JSON.stringify(JSON.parse(schemaField.value), null, 2);
        schemaField.value = formatted;
    } catch (error) {
        showNotification('Invalid JSON format', 'error');
    }
}

async function createNewAdvancedTool() {
    const fields = {
        name: document.getElementById('newAdvancedToolName'),
        description: document.getElementById('newAdvancedToolDescription'),
        tags: document.getElementById('newAdvancedToolTags'),
        connectorId: document.getElementById('newAdvancedToolConnector'),
        schema: document.getElementById('newAdvancedToolSchema')
    };

    if (!fields.name || !fields.description || !fields.schema) {
        showNotification('Required fields are missing', 'error');
        return;
    }

    if (!fields.name.value || !fields.description.value || !fields.schema.value) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    let parsedSchema;
    try {
        parsedSchema = JSON.parse(fields.schema.value);
    } catch (error) {
        showNotification('Invalid JSON schema format', 'error');
        return;
    }
    
    const formData = {
        name: fields.name.value,
        description: fields.description.value,
        tags: fields.tags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
        schema: parsedSchema,
        data_connector_id: fields.connectorId.value || null
    };
    
    try {
        const createButton = document.querySelector('.futuristic-button-create');
        if (createButton) {
            const originalText = createButton.innerHTML;
            createButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            createButton.disabled = true;
            
            const response = await fetch('/api/advanced-tools', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            createButton.innerHTML = originalText;
            createButton.disabled = false;
            
            if (response.ok) {
                closeCreateAdvancedTool();
                loadAdvancedTools();
                showNotification('Advanced tool created successfully', 'success');
            } else {
                const error = await response.json();
                showNotification(error.detail || 'Failed to create advanced tool', 'error');
            }
        }
    } catch (error) {
        console.error('Error creating advanced tool:', error);
        showNotification('Failed to create advanced tool', 'error');
        
        const createButton = document.querySelector('.futuristic-button-create');
        if (createButton) {
            createButton.innerHTML = 'Create Tool';
            createButton.disabled = false;
        }
    }
}

function editAdvancedTool(toolId) {
    const tool = advancedTools.find(t => t.id === toolId);
    if (tool) {
        showAdvancedToolModal('Edit Advanced Tool', tool);
    }
}

async function deleteAdvancedTool(toolId) {
    if (!confirm('Are you sure you want to delete this advanced tool?')) {
        return;
    }

    try {
        const response = await fetch(`/api/advanced-tools/${toolId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadAdvancedTools();
            showNotification('Advanced tool deleted successfully', 'success');
        } else {
            const error = await response.json();
            showNotification(error.detail || 'Failed to delete advanced tool', 'error');
        }
    } catch (error) {
        console.error('Error deleting advanced tool:', error);
        showNotification('Failed to delete advanced tool', 'error');
    }
}