function getFormData() {
    return {
        name: document.getElementById('agentName').value,
        description: document.getElementById('agentDescription').value,
        role: document.getElementById('agentRole').value,
        goal: document.getElementById('agentGoal').value,
        expectedOutput: document.getElementById('expectedOutput').value,
        backstory: document.getElementById('agentBackstory').value,
        instructions: document.getElementById('agentInstructions').value,
        tools: getSelectedTools(),
        llmProvider: document.getElementById('llmProvider').value,
        llmModel: document.getElementById('llmModel').value,
        apiKey: document.getElementById('apiKey').value
    };
}

function validateForm(data) {
    if (!data.name?.trim()) return 'Agent name is required';
    if (!data.description?.trim()) return 'Description is required';
    if (!data.role?.trim()) return 'Agent role is required';
    if (!data.goal?.trim()) return 'Goal is required';
    if (!data.expectedOutput?.trim()) return 'Expected output is required';
    if (!data.backstory?.trim()) return 'Backstory is required';
    if (!data.instructions?.trim()) return 'Instructions are required';
    if (!data.llmProvider?.trim()) return 'LLM Provider is required';
    if (!data.llmModel?.trim()) return 'LLM Model is required';
    if (!data.apiKey?.trim()) return 'API Key is required';
    return null;
} 