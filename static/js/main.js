// Main JavaScript file for the FastAPI application

// Keep track of loaded stylesheets
const loadedStylesheets = new Set();

// Function to update the active state of sidebar links
function updateActiveLink() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.sidebar nav a');
    // Add main stylesheet URL to prevent accidental removal if needed later
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
                setTimeout(() => {
                    // Page specific JS initializations
                    if (basePage === 'agents') {
                    loadAgents();
                        // Initialize search for agents page
                        const searchInput = document.querySelector('.page.agents .search-bar input'); // Assuming this selector is correct for the agents page search bar
                        if (searchInput && !searchInput.dataset.listenerAttached) {
                            searchInput.addEventListener('input', (e) => searchAgents(e.target.value));
                            searchInput.dataset.listenerAttached = 'true'; // Prevent attaching multiple listeners
                        }
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

                }, 100);
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
    loadPage('agents');
}

let selectedAgentId = null;
let selectedTools = new Set();

function loadAgents() {
    fetch('/api/agents')
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
                agentsContent.innerHTML = agents.map(agent => `
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
                        </div>
                    </div>
                `).join('');

                // Add CSS for the new layout
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
                `;
                document.head.appendChild(style);
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
    fetch(`/api/agents/${agentId}`)
        .then(response => response.json())
        .then(agent => {
            setTimeout(() => {
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
    fetch(`/api/agents/${agentId}`)
        .then(response => response.json())
        .then(agent => {
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
    
    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
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
    
    fetch(`/api/tools/${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update tool');
        return response.json();
    })
    .then(() => {
        closeAddCustomTool();
        loadExternalTools(); // Refresh tools list
    })
    .catch(error => {
        console.error('Error updating tool:', error);
        alert('Failed to update tool. Please try again.');
    });
}

function cloneTool(toolId) {
    closeToolMenu();
    let originalToolName = ''; // Store the original name for better error messages

    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
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
                fetch(`/api/tools/${toolId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) throw new Error('Failed to delete tool');
                    loadExternalTools(); // Refresh tools list
                })
                .catch(error => {
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
        fetch(`/api/tools/${toolId}`)
            .then(response => response.json())
            .then(tool => {
                // Get and set schema
                fetch(`/api/tools/${toolId}/schema`)
                    .then(response => response.json())
                    .then(schema => {
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
        fetch(`/api/tools/${toolId}`)
            .then(response => response.json())
            .then(tool => {
                // Get and set schema
                fetch(`/api/tools/${toolId}/schema`)
                    .then(response => response.json())
                    .then(schema => {
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
    fetch(`/api/agents/${agentId}`)
        .then(response => response.json())
        .then(agent => {
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
        fetch(`/api/agents/${agentId}`, {
            method: 'DELETE'
        })
        .then(() => {
            loadAgents();
        })
        .catch(error => {
            console.error('Error deleting agent:', error);
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
            const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('Failed to mark notification as read');
            }
            const data = await response.json();
            return { success: true };
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return { success: false };
        }
    },

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('Failed to mark all notifications as read');
            }
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
    const toolCards = document.querySelectorAll('.tool-card');
    const searchQuery = query.toLowerCase();

    toolCards.forEach(card => {
        const toolName = card.querySelector('.tool-name').textContent.toLowerCase();
        const toolDescription = card.querySelector('.tool-description').textContent.toLowerCase();
        const toolTags = Array.from(card.querySelectorAll('.tag'))
            .map(tag => tag.textContent.toLowerCase());

        const matches = toolName.includes(searchQuery) || 
                       toolDescription.includes(searchQuery) ||
                       toolTags.some(tag => tag.includes(searchQuery));

        card.style.display = matches ? '' : 'none';
    });
}

// Chat functionality for Launch Agent page
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

// Helper function to create table HTML
function createTableHTML(tableData) {
    if (!tableData || !tableData.headers || !tableData.rows) return '';
    
    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${tableData.headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableData.rows.map(row => `
                        <tr>
                            ${row.map(cell => `<td>${cell}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Helper function to create chart HTML
function createChartHTML(chartData) {
    if (!chartData || !chartData.type || !chartData.data) return '';
    
    // Create a unique ID for the chart
    const chartId = 'chart-' + Math.random().toString(36).substr(2, 9);
    
    return `
        <div class="chart-container">
            <canvas id="${chartId}"></canvas>
        </div>
        <script>
            // Initialize chart using the provided data
            const ctx = document.getElementById('${chartId}').getContext('2d');
            new Chart(ctx, ${JSON.stringify(chartData)});
        </script>
    `;
}

// Helper function to copy code
function copyCode(button) {
    const codeBlock = button.closest('.code-block').querySelector('code');
    const textArea = document.createElement('textarea');
    textArea.value = codeBlock.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show feedback
    const icon = button.querySelector('i');
    icon.className = 'fas fa-check';
    setTimeout(() => {
        icon.className = 'fas fa-copy';
    }, 2000);
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
                
                // Check if it's the currently active page to prevent unnecessary reload
                if (pagePath !== window.location.pathname) {
                    window.history.pushState({ path: pagePath }, '', pagePath);
                    loadPage(pagePath);
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

function closeAgentAPIPopup() {
    const modal = document.getElementById('agentAPIModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function copyAPICode(button) {
    const codeBlock = button.closest('.code-block').querySelector('code');
    const textArea = document.createElement('textarea');
    textArea.value = codeBlock.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show feedback
    const icon = button.querySelector('i');
    icon.className = 'fas fa-check';
    setTimeout(() => {
        icon.className = 'fas fa-copy';
    }, 2000);
}

// Add event listener for the API link
document.addEventListener('click', function(event) {
    const apiLink = event.target.closest('.agent-api-link');
    if (apiLink) {
        event.preventDefault();
        showAgentAPIPopup();
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