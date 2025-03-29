// Marketplace JavaScript functionality

// Utility function to generate consistent colors from strings
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
}

let selectedAgent = null;
let marketplaceAgents = [];

function loadMarketplace() {
    fetch('/api/marketplace/agents')
        .then(response => response.json())
        .then(agents => {
            marketplaceAgents = agents;
            renderMarketplaceAgents(agents);
        })
        .catch(error => {
            console.error('Error loading marketplace agents:', error);
        });
}

function renderMarketplaceAgents(agents) {
    const grid = document.getElementById('marketplaceGrid');
    if (!grid) return;

    if (agents.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store-alt"></i>
                <h2>No agents found</h2>
                <p>No agents match your search criteria</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = agents.map(agent => `
        <div class="agent-card" onclick="viewAgent('${agent.id}')">
            <div class="agent-header">
                <div class="agent-icon" style="background: ${stringToColor(agent.name)}">
                    ${agent.name.charAt(0).toUpperCase()}
                </div>
                <div class="agent-info">
                    <h3>${agent.name}</h3>
                </div>
            </div>
            <p class="agent-description">${agent.description}</p>
            <div class="agent-categories">
                ${agent.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
            </div>
            <div class="agent-footer">
                <span class="agent-creator">By IAgent</span>
                <span class="agent-status ${agent.status.toLowerCase() === 'beta' ? 'status-beta' : 'status-demo'}">${agent.status}</span>
            </div>
        </div>
    `).join('');
}

function viewAgent(agentId) {
    const agent = marketplaceAgents.find(a => a.id === agentId);
    if (!agent) return;

    selectedAgent = agent;
    const modal = document.getElementById('viewAgentModal');
    const modalContent = modal.querySelector('.modal-body');

    modalContent.innerHTML = `
        <div class="agent-view">
            <div class="agent-view-header">
                <div class="agent-logo" style="background: ${stringToColor(agent.name)}">
                    ${agent.name.charAt(0).toUpperCase()}
                </div>
                <div class="agent-info">
                    <h3>${agent.name}</h3>
                    <p>${agent.description}</p>
                </div>
            </div>
            <div class="agent-tags">
                ${agent.categories.map(cat => `<span class="tag">${cat}</span>`).join('')}
            </div>
            <div class="agent-details">
                <div class="detail-item">
                    <span class="detail-label">Model</span>
                    <span class="detail-value">${agent.llmModel}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Provider</span>
                    <span class="detail-value">${agent.llmProvider}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Role</span>
                    <span class="detail-value">${agent.role}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created By</span>
                    <span class="detail-value">${agent.creator}</span>
                </div>
            </div>
            <div class="agent-tools">
                <h4>Included Tools</h4>
                <div class="tools-grid">
                    ${agent.tools.map(tool => `
                        <div class="tool-item">
                            <div class="tool-icon" style="background: ${stringToColor(tool.name)}">
                                ${tool.name.charAt(0).toUpperCase()}
                            </div>
                            <span>${tool.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

function closeViewAgent() {
    const modal = document.getElementById('viewAgentModal');
    modal.classList.remove('show');
    selectedAgent = null;
}

function importAgent() {
    if (!selectedAgent) return;

    fetch('/api/agents/import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_id: selectedAgent.id })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to import agent');
        return response.json();
    })
    .then(() => {
        closeViewAgent();
        // Show success message
        alert('Agent imported successfully!');
    })
    .catch(error => {
        console.error('Error importing agent:', error);
        alert('Failed to import agent. Please try again.');
    });
}

function searchMarketplaceAgents(query) {
    const searchQuery = query.toLowerCase();
    const filteredAgents = marketplaceAgents.filter(agent => {
        return agent.name.toLowerCase().includes(searchQuery) ||
               agent.description.toLowerCase().includes(searchQuery) ||
               agent.categories.some(cat => cat.toLowerCase().includes(searchQuery));
    });
    renderMarketplaceAgents(filteredAgents);
}

function filterAgents() {
    const selectedCategories = Array.from(document.querySelectorAll('.filter-group:first-child input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    const selectedProviders = Array.from(document.querySelectorAll('.filter-group:last-child input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    const filteredAgents = marketplaceAgents.filter(agent => {
        const categoryMatch = selectedCategories.length === 0 || 
            agent.categories.some(cat => selectedCategories.includes(cat.toLowerCase()));
        
        const providerMatch = selectedProviders.length === 0 || 
            selectedProviders.includes(agent.llmProvider.toLowerCase());

        return categoryMatch && providerMatch;
    });

    renderMarketplaceAgents(filteredAgents);
}

function refreshMarketplace() {
    // Clear search
    const searchInput = document.querySelector('.search-bar input[type="text"]');
    if (searchInput) searchInput.value = '';
    
    // Reload agents
    loadMarketplace();
}

// Initialize marketplace when the page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.page.marketplace')) {
        loadMarketplace();
    }
}); 