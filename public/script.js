document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const connectionStatus = document.getElementById('connection-status');
    const chatForm = document.getElementById('chat-form');

    let isConnected = false;
    let isProcessing = false;

    // Connection status check
    function checkConnection() {
        fetch('http://localhost:3000/health', { 
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            // console.log('Connection check response:', response);
            if (response.ok) {
                isConnected = true;
                connectionStatus.textContent = 'Trực tuyến';
                connectionStatus.className = 'connection-status online';
                connectionStatus.style.display = 'block';
                return response.json().catch(() => ({})); // Handle non-JSON responses
            } else {
                throw new Error('Server not responding');
            }
        })
        .catch(error => {
            console.error('❌ Lỗi khi check connection:', error);
            isConnected = false;
            connectionStatus.style.display = 'block';
            connectionStatus.textContent = 'Đang kiểm tra kết nối...';
            connectionStatus.className = 'connection-status offline';

        });
    }
     function renderSupportPrompt(text) {
        
        addMessage('ai', text);
        const container = document.createElement('div');
        container.className = 'support-buttons';

        const btnYes = document.createElement('button');
        btnYes.className = 'support-btn';
        btnYes.textContent = 'Đồng ý';
        btnYes.onclick = () => handleSupportAgree();

        const btnNo = document.createElement('button');
        btnNo.className = 'support-btn no';
        btnNo.textContent = 'Không';
        btnNo.onclick = () => sendSupportConfirmation(false);

        container.append(btnYes, btnNo);
        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleSupportAgree() {
         addMessage('ai', '💡 <strong>Hướng dẫn:</strong><br>' +
                            '• Chuyển sang tab vừa mở<br>' +
                            '• Tìm biểu tượng chat/hỗ trợ (thường ở góc phải dưới)<br>' +
                            '• Click để mở chat và nhập "help me!" để bắt đầu');
        
        
        // 2. Thông báo cho user hướng dẫn
        document.querySelectorAll(".support-buttons").forEach((el) => el.remove());
        
        addMessage('ai', '✅ Cảm ơn bạn đã đồng ý hỗ trợ. Tôi sẽ mở trang hỗ trợ trong 3s.');
        
        // Thêm hướng dẫn cho user
        setTimeout(() => {
            const supportWin = window.open(
            "https://test.nami.exchange/vi/support",
            "_blank"
        );
        supportWin.foucus();
        }, 3000);
    }


    async function sendSupportConfirmation(confirm) {
  // xóa nút
        document.querySelectorAll('.support-buttons').forEach(el => el.remove());

        if (!confirm) {
            // user bấm “Không” thì vẫn gọi /chat để AI reply bình thường
            try {
            const res = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify({ message: "không" })
            });
            const data = await res.json();
            const reply = data.reply || data.output;
            addMessage('ai', reply);
            } catch (e) {
            console.error(e);
            addMessage('ai', '❌ Lỗi khi gửi xác nhận không hỗ trợ.', true);
            }
        }
    }



  

    // Check connection every 10 seconds (reduced from 30s for better UX)
    setInterval(checkConnection, 10000);
    checkConnection();

    function addMessage(sender, text, isError = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        if (isError) messageElement.classList.add('error-message');

        // đảm bảo có string, nếu không thì dùng empty string
        const content = text ?? '';

        // nếu marked đang load và content không rỗng thì parse, ngược lại chỉ set text
        if (typeof marked !== 'undefined' && content) {
            try {
                const processed = marked.parse(content, {
                    breaks: true,
                    gfm: true,
                    sanitize: false
                });
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = processed;

                // Process links for image display
                const links = tempDiv.querySelectorAll('a');
                links.forEach(link => {
                    const href = link.getAttribute('href');
                    const linkText = link.textContent.trim();

                    // Convert "Xem hình ảnh" links to images
                    if (linkText === 'Xem hình ảnh' && href && href.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
                        const imgElement = document.createElement('img');
                        imgElement.src = href;
                        imgElement.alt = "Hình ảnh minh họa";
                        imgElement.loading = "lazy";
                        
                        // Error handling for images
                        imgElement.onerror = function() {
                            this.style.display = 'none';
                            const errorText = document.createElement('span');
                            errorText.textContent = '❌ Không thể tải hình ảnh';
                            errorText.style.color = '#f44336';
                            this.parentNode.insertBefore(errorText, this);
                        };
                        
                        link.replaceWith(imgElement);
                    } else {
                        // Add security attributes to external links
                        if (href && href.startsWith('http')) {
                            link.setAttribute('target', '_blank');
                            link.setAttribute('rel', 'noopener noreferrer');
                        }
                    }
                });
           messageElement.innerHTML = tempDiv.innerHTML;
            } catch (error) {
                console.error('Error processing markdown:', error);
                messageElement.textContent = text; // Fallback to plain text
            }
        } else {
        messageElement.textContent = content;
        }

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function toggleInputs(disabled) {
        userInput.disabled = disabled;
        sendButton.disabled = disabled || userInput.value.trim() === '';
        isProcessing = disabled;
    }

    async function sendMessage() {
        const question = userInput.value.trim();
        if (question === '' || isProcessing) return;

        // Check connection before sending
        if (!isConnected) {
            addMessage('ai', '🔌 Vui lòng kiểm tra kết nối server trước khi gửi tin nhắn.', true);
            return;
        }

        // Add user message
        addMessage('user', question);
        userInput.value = '';
        toggleInputs(true);

        // Add loading message
        addMessage('ai', '<span class="loading">Đang suy nghĩ...</span>');

        try {
            // Use AbortController for timeout (supported in modern browsers)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 100000); // 1m timeout

            const response = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ message: question }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Remove loading message
            const loadingElement = chatMessages.querySelector('.loading');
            if (loadingElement) {
                loadingElement.closest('.message').remove();
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            // console.log('Response data:', data);


            const reply =  data.output ;

            const toolCalls = data.toolCalls || {};
            // console.log('Tool calls:', toolCalls);
            const emo = toolCalls.emotion_support;
            if (emo && emo.needsSupport) {
                renderSupportPrompt(emo.message_vi);
                return;
            } 
             if (reply) {
                addMessage('ai', reply.output);
                // Update connection status on successful response
                isConnected = true;
                connectionStatus.textContent = 'Trực tuyến';
                connectionStatus.className = 'connection-status online';
            } else if (data.error) {
                addMessage('ai', `❌ Lỗi: ${data.error}`, true);
            } else {
                addMessage('ai', '❌ Không nhận được phản hồi từ AI Assistant.', true);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            
            // Remove loading message
            const loadingElement = chatMessages.querySelector('.loading');
            if (loadingElement) {
                loadingElement.closest('.message').remove();
            }

            let errorMessage = '❌ Đã xảy ra lỗi khi kết nối đến AI Assistant.';
            
            if (error.name === 'AbortError') {
                errorMessage = '⏱️ Yêu cầu quá thời gian. Vui lòng thử lại.';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = '🔌 Không thể kết nối đến server. Vui lòng kiểm tra:\n• Server có đang chạy không?\n• Địa chỉ http://localhost:3000 có đúng không?\n• Tường lửa có chặn kết nối không?';
                isConnected = false;
                connectionStatus.textContent = 'Ngoại tuyến';
                connectionStatus.className = 'connection-status offline';
            } else if (error.message.includes('CORS')) {
                errorMessage = '🚫 Lỗi CORS. Vui lòng kiểm tra cấu hình server.';
            }
            
            addMessage('ai', errorMessage, true);
        } finally {
            toggleInputs(false);
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    chatForm.addEventListener('submit', e => { e.preventDefault(); sendMessage(); });
    // Auto-resize input and update send button state
    userInput.addEventListener('input', () => {
        toggleInputs(false); // This will update button state based on input
    });

    // Initial state
    toggleInputs(false);
    userInput.focus();

    // Welcome message
    addMessage('ai', '👋 **Chào bạn!** Tôi là AI Assistant của Nami Exchange. \n\nBạn có thể hỏi tôi về:\n• Thông tin về ví của bạn \n• Thông tin Token\n• Tin tức thị trường\n• Đặt Thông báo giá \n• Hướng dẫn sử dụng Nami exchange\n• Gợi ý một số bài viết, khóa học từ binance Academy   \n\nHãy đặt câu hỏi để bắt đầu! 🚀');
});


