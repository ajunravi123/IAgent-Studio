// Immediate execution verification
console.log('chat.js starting execution');
alert('chat.js loaded');

// Chat functionality for the Launch Agent page
(function() {
    console.log('chat.js - Script loaded');

    function initializeChatFeatures() {
        console.log('Initializing chat features...');

        // Get DOM elements
        const chatInput = document.getElementById('userInput');
        const chatContainer = document.getElementById('chatContainer');
        const sendButton = document.getElementById('sendMessageBtn');

        console.log('Elements found:', {
            chatInput: !!chatInput,
            chatContainer: !!chatContainer,
            sendButton: !!sendButton
        });

        if (!chatInput || !chatContainer || !sendButton) {
            console.error('Required chat elements not found!');
            return;
        }

        // Function to handle sending messages
        function handleSendMessage() {
            console.log('Send button clicked!');
            const userInput = chatInput.value.trim();
            
            if (!userInput) {
                console.log('Empty input, not sending.');
                return;
            }

            // Get agent ID from URL hash (format: #launch-agent?id=...)
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            const agentId = hashParams.get('id');

            if (!agentId) {
                console.error('No agent ID found in URL');
                appendMessage('Error: Could not identify the agent. Please go back and select an agent.', 'agent');
                return;
            }

            console.log('Agent ID:', agentId);

            // Add user message to chat
            appendMessage(userInput, 'user');
            
            // Clear input
            chatInput.value = '';

            // Send to backend
            fetch('/api/agent/infer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agentId: agentId,
                    userInput: userInput
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Response received:', data);
                appendMessage(data.response, 'agent');
            })
            .catch(error => {
                console.error('Error:', error);
                appendMessage('Sorry, there was an error processing your request.', 'agent');
            });
        }

        // Helper function to append messages to the chat
        function appendMessage(message, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';

            const avatarDiv = document.createElement('div');
            avatarDiv.className = `message-avatar ${sender}`;
            const icon = document.createElement('i');
            icon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
            avatarDiv.appendChild(icon);

            const contentDiv = document.createElement('div');
            contentDiv.className = `message-content ${sender}`;
            contentDiv.textContent = message;

            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);

            // Scroll to bottom
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        // Add event listeners
        sendButton.addEventListener('click', handleSendMessage);
        console.log('Click listener added to send button');
        
        chatInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
            }
        });

        // Auto-resize textarea as user types
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        console.log('Chat features initialized successfully');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initializeChatFeatures();
    } else {
        document.addEventListener('DOMContentLoaded', initializeChatFeatures);
    }
})();


alert("Hi")