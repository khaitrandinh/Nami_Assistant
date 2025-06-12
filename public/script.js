document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');

    // Hàm để thêm tin nhắn vào giao diện chat
    function addMessage(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        messageElement.innerHTML = text.replace(/\n/g, '<br>'); // Thay thế ký tự xuống dòng bằng <br>
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Cuộn xuống cuối
    }

    // Hàm gửi tin nhắn
    async function sendMessage() {
        const question = userInput.value.trim();
        if (question === '') return;

        addMessage('user', question); // Hiển thị tin nhắn của người dùng
        userInput.value = ''; // Xóa nội dung input

        addMessage('ai', '<span class="loading">Đang suy nghĩ...</span>'); // Hiển thị trạng thái loading

        try {
            const response = await fetch('http://localhost:3000/ask-assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });

            const data = await response.json();

            // Xóa trạng thái loading
            const loadingElement = chatMessages.querySelector('.loading');
            if (loadingElement) {
                loadingElement.parentElement.remove();
            }

            if (data.answer) {
                addMessage('ai', data.answer); // Hiển thị phản hồi từ AI
            } else if (data.error) {
                addMessage('ai', 'Lỗi: ' + data.error);
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu:', error);
            // Xóa trạng thái loading
            const loadingElement = chatMessages.querySelector('.loading');
            if (loadingElement) {
                loadingElement.parentElement.remove();
            }
            addMessage('ai', 'Đã xảy ra lỗi khi kết nối đến AI Assistant. Vui lòng thử lại.');
        }
    }

    // Gán sự kiện cho nút gửi và phím Enter
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Tin nhắn chào mừng khi load trang
    addMessage('ai', 'Chào bạn! Tôi là AI Assistant về tiền điện tử của Nami. Bạn có câu hỏi nào không?');
});