document.addEventListener('keydown', function(event) {
    if(event.key === '/') {
        event.preventDefault();
        const chatInput = document.querySelector('.chat-area input');
        chatInput.value = '';
        if(chatInput) {
            chatInput.focus();
        }
    }
});

document.addEventListener('keydown', function(event) {
        if(event.key === 'Enter') {
            event.preventDefault();
            const input = document.querySelector('.chat-area input');
            if(input.value === '')  return;
            displayMessage(`You:`, input.value);
            input.value = '';
        }
    });

function displayMessage(sender, message) {
    const name = sender || "Anon";
    const chatBox = document.querySelector('.chat-area .messages');
    const newChat = document.createElement('div');
    newChat.classList.add('chat-message');
    newChat.textContent = `${name} ${message}`;
    chatBox.appendChild(newChat);
    chatBox.scrollTop = chatBox.scrollHeight;
}