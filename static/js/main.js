// Main JavaScript file for the FastAPI application

function loadPage(page) {
    const app = document.getElementById('app');
    if (app) {
        fetch(`/${page}`)
            .then(response => response.text())
            .then(html => {
                app.innerHTML = html;
                if (page === 'agents') {
                    loadAgents();
                } else if (page === 'create-agent') {
                    loadTools();
                } else if (page === 'tools') {
                    loadTools();
                }
            })
            .catch(error => {
                app.innerHTML = '<p>Error loading page.</p>';
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
    // Implement agent launch functionality
    console.log('Launching agent:', agentId);
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
            loadTools(); // Refresh tools list
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
        loadTools();
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
                    loadTools();
                })
                .catch(error => {
                    console.error('Error deleting tool:', error);
                    alert('Failed to delete tool. Please try again.');
                });
            }
        });
}

function viewTool(toolId) {
    closeToolMenu();
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

async function loadTools() {
    try {
        const response = await fetch('/api/tools');
        const tools = await response.json();
        
        // Check which page we're on
        const toolsGrid = document.querySelector('.tools-grid');
        const externalToolsGrid = document.querySelector('.external-tools-grid');
        
        if (toolsGrid) {
            // We're on the create-agent page
            toolsGrid.innerHTML = '';
            
            // Add view tool modal to the page if it doesn't exist
            if (!document.getElementById('viewToolModal')) {
                const viewModal = document.createElement('div');
                viewModal.id = 'viewToolModal';
                viewModal.className = 'modal';
                viewModal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>Tool Details</h2>
                            <button class="btn-close" onclick="closeViewTool()">×</button>
                        </div>
                        <div class="modal-body"></div>
                    </div>
                `;
                document.body.appendChild(viewModal);
            }
            
            // Add tool actions menu if it doesn't exist
            if (!document.getElementById('toolActionsMenu')) {
                const actionsMenu = document.createElement('div');
                actionsMenu.id = 'toolActionsMenu';
                actionsMenu.className = 'agent-actions-menu';
                actionsMenu.innerHTML = `
                    <div class="menu-item" onclick="viewTool(selectedToolId)">
                        <i class="fas fa-eye"></i>
                        View
                    </div>
                `;
                document.body.appendChild(actionsMenu);
            }
            
            tools.forEach(tool => {
                const isSelected = selectedTools.has(tool.id);
                const toolCard = document.createElement('div');
                toolCard.className = `tool-card ${isSelected ? 'selected' : ''}`;
                toolCard.setAttribute('data-tool-id', tool.id);
                toolCard.innerHTML = `
                    <div class="tool-content">
                        <div class="checkbox" onclick="toggleTool('${tool.id}', event)">
                            <input type="checkbox" ${isSelected ? 'checked' : ''}>
                            <i class="fas fa-check"></i>
                        </div>
                        <div class="tool-icon" style="background: ${stringToColor(tool.name)}">
                            ${tool.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="tool-name">${tool.name}</div>
                        <div class="tool-description">${tool.description}</div>
                        <button class="btn-more" onclick="showToolMenu(event, '${tool.id}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                `;

                // Add click event to the card (excluding the checkbox and three-dot button)
                toolCard.addEventListener('click', (event) => {
                    if (!event.target.closest('.checkbox') && !event.target.closest('.btn-more')) {
                        toggleTool(tool.id, event);
                    }
                });

                toolsGrid.appendChild(toolCard);
            });
        } else if (externalToolsGrid) {
            // Add view tool modal to the page if it doesn't exist
            if (!document.getElementById('viewToolModal')) {
                const viewModal = document.createElement('div');
                viewModal.id = 'viewToolModal';
                viewModal.className = 'modal';
                viewModal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>Tool Details</h2>
                            <button class="btn-close" onclick="closeViewTool()">×</button>
                        </div>
                        <div class="modal-body"></div>
                    </div>
                `;
                document.body.appendChild(viewModal);
            }
            
            // We're on the tools page
            externalToolsGrid.innerHTML = tools.map(tool => `
                <div class="tool-integration-card">
                    <div class="tool-header">
                        <div class="tool-info">
                            <div class="tool-logo" style="background: ${stringToColor(tool.name)}">
                                ${tool.name.charAt(0).toUpperCase()}
                            </div>
                            <h3>${tool.name}</h3>
                        </div>
                        <button class="btn-more" onclick="showToolMenu(event, '${tool.id}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                    <p class="tool-description">${tool.description}</p>
                    <div class="tool-tags">
                        ${tool.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `).join('');
        }
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
    const agentData = {
        name: document.getElementById('agentName').value,
        description: document.getElementById('agentDescription').value,
        llmProvider: document.getElementById('llmProvider').value,
        llmModel: document.getElementById('llmModel').value,
        role: document.getElementById('agentRole').value,
        instructions: document.getElementById('agentInstructions').value,
        isManager: document.getElementById('managerAgent').checked,
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
        loadPage('agents');
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
            loadPage('create-agent');
            // Fill form with agent data
            setTimeout(() => {
                // Update page title and button text
                document.querySelector('.page-header h1').textContent = agent.name;
                document.querySelector('.build-section .btn-primary').textContent = 'Save';
                
                // Fill form fields
                document.getElementById('agentName').value = agent.name;
                document.getElementById('agentDescription').value = agent.description;
                document.getElementById('llmProvider').value = agent.llmProvider;
                document.getElementById('llmModel').value = agent.llmModel;
                document.getElementById('agentRole').value = agent.role;
                document.getElementById('agentInstructions').value = agent.instructions;
                document.getElementById('managerAgent').checked = agent.isManager;
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

function init() {
    const links = document.querySelectorAll('.sidebar nav ul li a');
    links.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const page = link.getAttribute('href').replace('/', '');
            loadPage(page);
        });
    });
    loadPage('home');

    // Add tools page initialization
    if (window.location.pathname.includes('tools.html')) {
        loadTools();
        
        // Add search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => searchTools(e.target.value));
        }
    }
}

window.onload = init; 