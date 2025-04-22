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
            // Escape HTML characters to prevent injection
            let text = messageData.content.text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            
            // Replace newlines with <br> tags
            text = text.replace(/\n/g, '<br>');
            
            // Regular expression to match URLs
            const urlRegex = /(https?:\/\/[^\s<]+)/g;
            contentDiv.innerHTML = text.replace(urlRegex, (match) => {
                // Check if the URL contains a file extension
                const isFilePath = /\.[a-zA-Z0-9]{1,4}$/.test(match);
                let displayText = match;
                
                if (isFilePath) {
                    // Extract filename from URL
                    const parts = match.split('/');
                    displayText = parts[parts.length - 1];
                }
                
                // Create anchor tag
                return `<a href="${match}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
            });
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
                                <th>Host/Project</th>
                                <th>Port</th>
                                <th>Database/Dataset</th>
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
                                    <td>${connector.vectorStoreHost || connector.projectId || '💠'}</td>
                                    <td>${connector.vectorStorePort || '💠'}</td>
                                    <td>${connector.vectorStoreDBName || connector.datasetId || '💠'}</td>

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
    
    if (connectorType === 'postgres' || connectorType === 'bigquery') {
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
                if (connectorType === 'postgres') {
                    showPostgresConnectionModal(connectorToEdit); // Open modal with pre-filled data
                } else {
                    showBigQueryConnectionModal(connectorToEdit); // Open modal with pre-filled data
                }
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
    
    // Special handling for BigQuery
    if (connectorId === 'bigquery') {
        showBigQueryConnectionModal(); // Show modal for new connection
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
                            <label for="vectorStoreUser">User <span class="required">*</span></label>
                            <input type="text" id="vectorStoreUser" name="vectorStoreUser" placeholder="Enter the Username" required value="${isEditing ? connectorData.vectorStoreUser : ''}">
                        </div>
                        <div class="form-group half">
                            <label for="vectorStoreHost">Host <span class="required">*</span></label>
                            <input type="text" id="vectorStoreHost" name="vectorStoreHost" placeholder="Enter Host" required value="${isEditing ? connectorData.vectorStoreHost : ''}">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group half">
                            <label for="vectorStorePassword">Password ${isEditing ? '' : '<span class="required">*</span>'}</label>
                            <input type="password_text" id="vectorStorePassword" name="vectorStorePassword" placeholder="${isEditing ? 'Enter new password to update' : 'Enter Password'}" ${isEditing ? '' : 'required'} value="${isEditing ? connectorData.vectorStorePassword : ''}">
                        </div>
                        <div class="form-group half">
                            <label for="vectorStorePort">Port <span class="required">*</span></label>
                            <input type="text" id="vectorStorePort" name="vectorStorePort" placeholder="Enter Port" required value="${isEditing ? connectorData.vectorStorePort : ''}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="vectorStoreDBName">DB Name <span class="required">*</span></label>
                        <input type="text" id="vectorStoreDBName" name="vectorStoreDBName" placeholder="Enter DB Name" required value="${isEditing ? connectorData.vectorStoreDBName : ''}">
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
                text-align: center;
                padding-top: 9px;
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

// Advanced Tool Modal Functions
function showAdvancedToolModal(title, tool = null) {
    currentAdvancedToolId = tool?.id || null;
    document.getElementById('advancedToolModalTitle').textContent = title;
    document.getElementById('advancedToolId').value = tool?.id || '';
    document.getElementById('advancedToolName').value = tool?.name || '';
    document.getElementById('advancedToolDescription').value = tool?.description || '';
    document.getElementById('advancedToolTags').value = tool?.tags?.join(', ') || '';
    document.getElementById('advancedToolConnector').value = tool?.data_connector_id || '';
    document.getElementById('advancedToolSchema').value = tool?.schema ? JSON.stringify(tool.schema, null, 2) : '';
    document.getElementById('advancedToolModal').style.display = 'flex';
}

function closeAdvancedToolModal() {
    document.getElementById('advancedToolModal').style.display = 'none';
    document.getElementById('advancedToolForm').reset();
    currentAdvancedToolId = null;
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

// --- BigQuery Connection Modal Functions ---

// Function to show BigQuery connection configuration modal
function showBigQueryConnectionModal(connectorData = null) {
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
    const title = isEditing ? `Edit Connection: ${connectorData.uniqueName}` : 'Connect BigQuery';
    const submitButtonText = isEditing ? 'Save Changes' : 'Submit';
    
    // Generate form fields for BigQuery connection
    const modalHtml = `
        <div class="modal-content connector-config-modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="close-btn" onclick="closeConnectorModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="bigqueryConnectionForm">
                    <input type="hidden" id="connectorId" name="id" value="${isEditing ? connectorData.id : ''}">
                    <div class="form-group">
                        <label for="uniqueName">Unique Name <span class="required">*</span></label>
                        <input type="text" id="uniqueName" name="uniqueName" placeholder="Give this connection a name" required value="${isEditing ? connectorData.uniqueName : ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="projectId">Project ID <span class="required">*</span></label>
                        <input type="text" id="projectId" name="projectId" placeholder="Enter your Google Cloud Project ID" required value="${isEditing ? connectorData.projectId : ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="datasetId">Dataset ID <span class="required">*</span></label>
                        <input type="text" id="datasetId" name="datasetId" placeholder="Enter your BigQuery Dataset ID" required value="${isEditing ? connectorData.datasetId : ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="serviceAccountKey">Service Account Key ${isEditing ? '' : '<span class="required">*</span>'}</label>
                        <textarea id="serviceAccountKey" name="serviceAccountKey" placeholder="Paste your service account key JSON" rows="8" ${isEditing ? '' : 'required'}>${isEditing ? connectorData.serviceAccountKey : ''}</textarea>
                        <div class="field-help">
                            <i class="fas fa-info-circle"></i>
                            Paste the entire JSON content of your service account key file
                        </div>
                    </div>
                    
                    <div class="legal-text">
                        <p>By using this service, you agree to take full responsibility for your actions and to protect IAgentic Studio and its affiliates, officers, employees, and agents from any claims, losses, damages, liabilities, or legal costs that may arise due to your violation of this policy — including, but not limited to, uploading sensitive personal information without proper authorization.</p>
                    </div>
                    
                    <div class="documentation-link">
                        <a href="https://cloud.google.com/bigquery/docs" target="_blank">
                            <i class="fas fa-external-link-alt"></i> View Documentation
                        </a>
                    </div>
                    
                    <div class="required-note">
                        <span class="required">*</span> marked as required
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-test-connection" onclick="testBigQueryConnection()">
                    <i class="fas fa-plug"></i> Test Connection
                </button>
                <div class="action-buttons">
                    <button class="btn-cancel" onclick="closeConnectorModal()">Cancel</button>
                    <button class="btn-submit" onclick="saveBigQueryConnection(${isEditing})">${submitButtonText}</button>
                </div>
            </div>
        </div>
    `;
    
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    
    // Add modal styles if they don't exist
    ensureConnectorModalStyles();
    
    // Add BigQuery specific styles
    ensureBigQueryModalStyles();
    
    // Show the modal
    setTimeout(() => {
        modal.classList.add('show');
        
        // If editing, set the service account key value after modal is shown
        if (isEditing && connectorData.serviceAccountKey) {
            const serviceAccountKeyField = document.getElementById('serviceAccountKey');
            if (serviceAccountKeyField) {
                // Convert object to string for editing if it's an object
                if (typeof connectorData.serviceAccountKey === 'object') {
                    serviceAccountKeyField.value = JSON.stringify(connectorData.serviceAccountKey, null, 2);
                } else {
                    serviceAccountKeyField.value = connectorData.serviceAccountKey;
                }
            }
        }
    }, 50);
}

// Function to add BigQuery-specific modal styles
function ensureBigQueryModalStyles() {
    if (!document.getElementById('bigquery-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'bigquery-modal-styles';
        style.textContent = `
            #connectorConfigModal #bigqueryConnectionForm textarea {
                box-sizing: border-box;
                width: 100%;
                padding: 12px 16px;
                border: 1px solid rgba(99, 179, 237, 0.3);
                border-radius: 8px;
                background-color: rgba(20, 30, 60, 0.5);
                color: rgba(255, 255, 255, 0.95);
                font-size: 14px;
                font-family: monospace;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15),
                            inset 0 1px 0 rgba(255, 255, 255, 0.05);
                transition: all 0.2s;
                margin: 0;
                caret-color: #63b3ed;
                resize: vertical;
            }
            
            #connectorConfigModal #bigqueryConnectionForm textarea::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            #connectorConfigModal #bigqueryConnectionForm textarea:focus {
                border-color: rgba(99, 179, 237, 0.7);
                outline: none;
                background-color: rgba(30, 40, 70, 0.6);
                box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.25),
                            inset 0 1px 0 rgba(255, 255, 255, 0.05);
            }
            
            #connectorConfigModal .field-help {
                margin-top: 8px;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.6);
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            #connectorConfigModal .field-help i {
                color: #63b3ed;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Function to test BigQuery connection
async function testBigQueryConnection() {
    // Get connection details
    const form = document.getElementById('bigqueryConnectionForm');
    if (!form) return;
    
    // Basic form validation
    const formData = new FormData(form);
    const connectionConfig = Object.fromEntries(formData.entries());
    
    // Check if required fields are filled
    const requiredFields = ['projectId', 'datasetId', 'serviceAccountKey'];
    const missingFields = requiredFields.filter(field => !connectionConfig[field]);
    
    if (missingFields.length > 0) {
        showToast(`Please fill in required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    // Parse service account key
    let serviceAccountKey;
    try {
        serviceAccountKey = JSON.parse(connectionConfig.serviceAccountKey);
    } catch (error) {
        showToast("Service Account Key must be a valid JSON", "error");
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
                type: 'bigquery',
                config: {
                    projectId: connectionConfig.projectId,
                    datasetId: connectionConfig.datasetId,
                    serviceAccountKey: serviceAccountKey
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
    } finally {
        // Reset button state
        testBtn.disabled = false;
        testBtn.innerHTML = originalBtnText;
    }
}

// Function to save BigQuery connection
async function saveBigQueryConnection(isEditing = false) {
    const form = document.getElementById('bigqueryConnectionForm');
    if (!form) return;

    // Basic form validation
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Validate required fields
    const requiredFields = ['uniqueName', 'projectId', 'datasetId'];
    if (!isEditing) {
        requiredFields.push('serviceAccountKey');
    }
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
        showToast(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }

    // Add connector type
    data.connectorType = 'bigquery';

    // Parse the service account key from JSON string to object
    try {
        if (data.serviceAccountKey) {
            data.serviceAccountKey = JSON.parse(data.serviceAccountKey);
        }
    } catch (error) {
        showToast("Service Account Key must be a valid JSON", "error");
        hideLoading();
        return;
    }

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


function showToolUniverse() {
    window.open('http://ajunsmachine.theworkpc.com:8004', '_blank');
}