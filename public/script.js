document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const connectionStatus = document.getElementById('connection-status');
    const chatForm = document.getElementById('chat-form');

    let isConnected = false;
    let isProcessing = false;

    function checkConnection() {
        fetch('http://localhost:3000/health')
            .then(response => {
                if (response.ok) {
                    isConnected = true;
                    connectionStatus.textContent = 'Trực tuyến';
                    connectionStatus.className = 'connection-status online';
                } else {
                    throw new Error();
                }
            })
            .catch(() => {
                isConnected = false;
                connectionStatus.textContent = 'Đang kiểm tra kết nối...';
                connectionStatus.className = 'connection-status offline';
            });
        connectionStatus.style.display = 'block';
    }

    function renderSupportPrompt(text) {
        addMessage('ai', text);
        const container = document.createElement('div');
        container.className = 'support-buttons';
        container.innerHTML = `
            <button class="support-btn">Đồng ý</button>
            <button class="support-btn no">Không</button>
        `;
        container.children[0].onclick = handleSupportAgree;
        container.children[1].onclick = () => sendSupportConfirmation(false);
        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleSupportAgree() {
        addMessage('ai', '💡 <strong>Hướng dẫn:</strong><br>• Chuyển sang tab vừa mở<br>• Tìm biểu tượng chat/hỗ trợ<br>• Click và nhập "Nội dung bạn cần hỗ trợ"');
        document.querySelectorAll(".support-buttons").forEach(el => el.remove());
        addMessage('ai', '✅ Cảm ơn bạn đã đồng ý hỗ trợ. Tôi sẽ mở trang hỗ trợ trong 3s.');
        setTimeout(() => window.open("https://test.nami.exchange/vi/support", "_blank")?.focus(), 3000);
    }

    async function sendSupportConfirmation(confirm) {
        document.querySelectorAll('.support-buttons').forEach(el => el.remove());
        if (!confirm) {
            try {
                const res = await fetch('http://localhost:3000/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: "không" })
                });
                const data = await res.json();
                addMessage('ai', data.reply || data.output);
            } catch {
                addMessage('ai', '❌ Lỗi khi gửi xác nhận không hỗ trợ.', true);
            }
        }
    }

    function addMessage(sender, text, isError = false) {
        const msg = document.createElement('div');
        msg.className = `message ${sender}${isError ? ' error-message' : ''}`;
        const content = text ?? '';
        if (typeof marked !== 'undefined' && content) {
            try {
                const parsed = marked.parse(content);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsed;
                tempDiv.querySelectorAll('a').forEach(link => {
                    const href = link.getAttribute('href');
                    const text = link.textContent.trim();
                    if (text === 'Xem hình ảnh' && href?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
                        const img = new Image();
                        img.src = href;
                        img.alt = 'Hình ảnh minh họa';
                        img.loading = 'lazy';
                        img.onerror = () => {
                            img.style.display = 'none';
                            const errText = document.createElement('span');
                            errText.textContent = '❌ Không thể tải hình ảnh';
                            errText.style.color = '#f44336';
                            img.before(errText);
                        };
                        link.replaceWith(img);
                    } else if (href?.startsWith('http')) {
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    }
                });
                msg.innerHTML = tempDiv.innerHTML;
            } catch {
                msg.textContent = content;
            }
        } else {
            msg.textContent = content;
        }
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function toggleInputs(disabled) {
        userInput.disabled = disabled;
        sendButton.disabled = disabled || !userInput.value.trim();
        isProcessing = disabled;
    }

    async function sendMessage() {
        const question = userInput.value.trim();
        if (!question || isProcessing) return;

        if (!isConnected) {
            addMessage('ai', '🔌 Vui lòng kiểm tra kết nối server trước khi gửi tin nhắn.', true);
            return;
        }

        addMessage('user', question);
        userInput.value = '';
        toggleInputs(true);
        addMessage('ai', '<span class="loading">Đang suy nghĩ...</span>');

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 100000);
            const res = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            chatMessages.querySelector('.loading')?.closest('.message')?.remove();

            if (!res.ok) throw new Error();

            const data = await res.json();
            const reply = data.output;
            const emo = data.toolCalls?.emotion_support;

            if (emo?.needsSupport) {
                renderSupportPrompt(emo.message_vi);
            } else if (reply) {
                addMessage('ai', reply.output);
                isConnected = true;
                connectionStatus.textContent = 'Trực tuyến';
                connectionStatus.className = 'connection-status online';
            } else {
                addMessage('ai', '❌ Không nhận được phản hồi từ AI Assistant.', true);
            }

        } catch (error) {
            chatMessages.querySelector('.loading')?.closest('.message')?.remove();
            const msg = error.name === 'AbortError'
                ? '⏱️ Yêu cầu quá thời gian. Vui lòng thử lại.'
                : error.message.includes('CORS')
                    ? '🚫 Lỗi CORS. Vui lòng kiểm tra cấu hình server.'
                    : '❌ Đã xảy ra lỗi khi kết nối đến AI Assistant.';
            addMessage('ai', msg, true);
            isConnected = false;
            connectionStatus.textContent = 'Ngoại tuyến';
            connectionStatus.className = 'connection-status offline';
        } finally {
            toggleInputs(false);
        }
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    chatForm.addEventListener('submit', e => {
        e.preventDefault();
        sendMessage();
    });
    userInput.addEventListener('input', () => toggleInputs(false));
    toggleInputs(false);
    userInput.focus();
    setInterval(checkConnection, 10000);
    checkConnection();
    addMessage('ai', '👋 **Chào bạn!** Tôi là AI Assistant của Nami Exchange.\n\nBạn có thể hỏi tôi về:\n\n• Thông tin về ví của bạn \n\n• Thông tin Token\n\n• Tin tức thị trường\n\n• Đặt Thông báo giá \n\n• Hướng dẫn sử dụng Nami exchange\n\n• Gợi ý một số bài viết, khóa học từ binance Academy   \n\nHãy đặt câu hỏi để bắt đầu! 🚀');
});