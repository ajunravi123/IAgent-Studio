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
                                <div class="stat">
                                    <span class="stat-label">Model</span>
                                    <span class="stat-value">${agent.llmModel}</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Provider</span>
                                    <span class="stat-value">${agent.llmProvider}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
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
                document.querySelector('.page-header h1').textContent = `Test ${agent.name}`;
                
                // Fill form fields
                document.getElementById('agentName').value = agent.name;
                document.getElementById('agentDescription').value = agent.description;
                document.getElementById('llmProvider').value = agent.llmProvider;
                document.getElementById('llmModel').value = agent.llmModel;
                document.getElementById('apiKey').value = agent.apiKey;
                document.getElementById('agentRole').value = agent.role;
                document.getElementById('agentBackstory').value = agent.backstory || '';
                document.getElementById('agentInstructions').value = agent.instructions;
                
                // Load agent tools
                loadAgentTools(agent.tools);
            }, 100);
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
                    <div class="tool-card" data-tool="${tool.id}">
                        <div class="tool-content">
                            <div class="tool-icon-wrapper ${colorClass}">
                                ${firstLetter}
                            </div>
                            <div class="tool-info">
                                <div class="tool-name">${tool.name}</div>
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
    // Implement agent search functionality
    console.log('Searching agents:', query);
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
    document.getElementById('toolIcon').value = '';
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
    document.getElementById('toolIcon').value = '';
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
    const icon = document.getElementById('toolIcon').value.trim();
    const tags = document.getElementById('toolTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const schema = document.getElementById('toolSchema').value.trim();
    
    // Validation
    if (!name) {
        alert('Tool name is required');
        return;
    }
    
    if (!description) {
        alert('Description is required');
        return;
    }
    
    if (!schema || !validateOpenAPISchema(schema)) {
        return;
    }
    
    // Prepare tool data
    const toolData = {
        name,
        description,
        icon: icon || `/static/images/default-tool-icon.svg`,
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
            alert('Failed to save tool: ' + error.message);
        }
    } catch (error) {
        console.error('Error saving custom tool:', error);
        alert('Failed to save tool. Please try again.');
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
    closeToolMenu();
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
            document.getElementById('toolIcon').value = tool.icon || '';
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
    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
            // Get the schema for the tool
            return fetch(`/api/tools/${toolId}/schema`)
                .then(response => response.json())
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
        .then(response => {
            if (!response.ok) throw new Error('Failed to clone tool');
            return response.json();
        })
        .then(() => loadTools())
        .catch(error => {
            console.error('Error cloning tool:', error);
            alert('Failed to clone tool. Please try again.');
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
    // Only try to close the menu if it exists
    const toolMenu = document.getElementById('toolActionsMenu');
    if (toolMenu) {
    closeToolMenu();
    }
    
    fetch(`/api/tools/${toolId}`)
        .then(response => response.json())
        .then(tool => {
            // Get and set schema
            fetch(`/api/tools/${toolId}/schema`)
                .then(response => response.json())
                .then(schema => {
                    const modal = document.getElementById('viewToolModal');
                    const modalContent = modal.querySelector('.modal-body');
                    modalContent.innerHTML = `
                        <div class="tool-view">
                            <div class="tool-view-header">
                                <div class="tool-logo" style="background: ${stringToColor(tool.name)}">
                                    ${tool.name.charAt(0).toUpperCase()}
                                </div>
                                <div class="tool-info">
                                    <h3>${tool.name}</h3>
                                    <p>${tool.description}</p>
                                </div>
                            </div>
                            <div class="tool-tags">
                                ${tool.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>
                            <div class="tool-schema">
                                <h4>OpenAPI Schema</h4>
                                <pre><code>${JSON.stringify(schema, null, 2)}</code></pre>
                            </div>
                        </div>
                    `;
                    modal.classList.add('show');
                });
        });
}

function closeViewTool() {
    const modal = document.getElementById('viewToolModal');
    modal.classList.remove('show');
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
                        <div class="tool-tags">
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
            // Add edit parameter to URL when loading create-agent page
            loadPage('create-agent?edit=true');
            // Fill form with agent data
            setTimeout(() => {
                // Update page title and button texts
                document.querySelector('.page-header h1').textContent = agent.name;
                document.querySelector('.build-section .btn-primary').textContent = 'Save';
                // Update the main form button text
                const buttonText = document.getElementById('buttonText');
                if (buttonText) {
                    buttonText.textContent = 'Save';
                }
                
                // Fill form fields
                document.getElementById('agentName').value = agent.name;
                document.getElementById('agentDescription').value = agent.description;
                document.getElementById('llmProvider').value = agent.llmProvider;
                document.getElementById('llmModel').value = agent.llmModel;
                document.getElementById('apiKey').value = agent.apiKey;
                document.getElementById('agentRole').value = agent.role;
                document.getElementById('agentBackstory').value = agent.backstory || '';
                document.getElementById('agentInstructions').value = agent.instructions;
                document.getElementById('managerAgent').checked = agent.verbose;
                document.getElementById('knowledgeBase').checked = agent.features.knowledgeBase;
                document.getElementById('dataQuery').checked = agent.features.dataQuery;
                
                // Set selected tools
                selectedTools = new Set(agent.tools || []);
                loadTools();
            }, 100);
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


