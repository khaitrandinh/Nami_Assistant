document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');

    // Hàm để thêm tin nhắn vào giao diện chat
    function addMessage(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);

        // Parse Markdown sang HTML
        let processedText = marked.parse(text);

        // Dùng DOM ảo để thao tác
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedText;

        // Duyệt qua các <a> để thay bằng <img> nếu là [Xem hình ảnh](URL)
        const links = tempDiv.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            const linkText = link.textContent.trim();

            if (linkText === 'Xem hình ảnh' && href && href.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
                const imgElement = document.createElement('img');
                imgElement.src = href;
                imgElement.alt = "Hình ảnh minh họa";
                imgElement.style.maxWidth = '100%';
                imgElement.style.height = 'auto';
                imgElement.style.display = 'block';
                imgElement.style.marginTop = '10px';
                imgElement.style.borderRadius = '8px';
                imgElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

                
                link.replaceWith(imgElement);
            }
        });

        // Thêm nội dung vào box chat
        messageElement.innerHTML = tempDiv.innerHTML;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Hàm gửi tin nhắn (không thay đổi)
    async function sendMessage() {
        const question = userInput.value.trim();
        if (question === '') return;

        addMessage('user', question);
        userInput.value = '';

        addMessage('ai', '<span class="loading">Đang suy nghĩ...</span>');

        try {
            const response = await fetch('http://localhost:3000/ask-assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });
            // const response = await fetch('https://nami-assistant.vercel.app/ask-assistant', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({ question: question })
            // });

            const data = await response.json();

            const loadingElement = chatMessages.querySelector('.loading');
            if (loadingElement) {
                loadingElement.parentElement.remove();
            }

            if (data.answer) {
                addMessage('ai', data.answer);
            } else if (data.error) {
                addMessage('ai', 'Lỗi: ' + data.error);
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu:', error);
            const loadingElement = chatMessages.querySelector('.loading');
            if (loadingElement) {
                loadingElement.parentElement.remove();
            }
            addMessage('ai', 'Đã xảy ra lỗi khi kết nối đến AI Assistant. Vui lòng thử lại.');
        }
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    addMessage('ai', 'Chào bạn! Tôi là AI Assistant về tiền điện tử của Nami. Bạn có câu hỏi nào không?');
});