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

    function renderSupportPrompt(actions = []) {
        const container = document.createElement('div');
        container.className = 'support-buttons';

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'support-btn' + (action.type?.includes('no') ? ' no' : '');
            btn.textContent = action.label_vi || action.label_en || action.type;
            btn.onclick = () => handleSupportAction(action.type);
            container.appendChild(btn);
        });

        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleSupportAction(type) {
    // Tùy vào type action mà bạn xử lý
        if (type === 'connect_cs' || type === 'connect_cs_urgent') {
            // Có thể mở trang CS hoặc thông báo lên chat
            addMessage('ai', '💡 <strong>Hướng dẫn:</strong><br>• Chuyển sang tab vừa mở<br>• Tìm biểu tượng chat/hỗ trợ<br>• Click và nhập "Nội dung bạn cần hỗ trợ"', false, true);
            setTimeout(() => window.open("https://test.nami.exchange/vi/support", "_blank")?.focus(), 3000);
            addMessage('ai', 'Cảm ơn bạn, mình đã kết nối bạn với đội hỗ trợ. Bạn hãy kiểm tra tab mới nhé.');
        } else if (type === 'pause_trading') {
            addMessage('ai', 'Bạn nên tạm dừng giao dịch và nghỉ ngơi một chút. Nếu cần mình luôn ở đây hỗ trợ bạn.');
        } else if (type === 'get_tips') {
            addMessage('ai', 'Một số mẹo quản lý cảm xúc khi trade: Luôn kiểm soát khối lượng, nghỉ ngơi khi cảm xúc không ổn định, đừng “all in” khi stress...');
        } else if (type === 'continue') {
            addMessage('ai', 'Cảm ơn bạn! Mình luôn ở đây nếu bạn cần hỗ trợ thêm.');
        }
        // Xóa nút sau khi chọn action
        document.querySelectorAll(".support-buttons").forEach(el => el.remove());
    }
    function translateLevel(level) {
    switch(level) {
        case "crisis": return "Khủng hoảng";
        case "very_negative": return "Rất tiêu cực";
        case "negative": return "Tiêu cực";
        case "positive": return "Tích cực";
        case "very_positive": return "Rất tích cực";
        default: return level;
    }
}




    function handleSupportAgree() {
        addMessage('ai', '💡 <strong>Hướng dẫn:</strong><br>• Chuyển sang tab vừa mở<br>• Tìm biểu tượng chat/hỗ trợ<br>• Click và nhập "Nội dung bạn cần hỗ trợ"');
        document.querySelectorAll(".support-buttons").forEach(el => el.remove());
        addMessage('ai', 'Cảm ơn bạn đã đồng ý hỗ trợ. Tôi sẽ mở trang hỗ trợ trong 3s.');
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

    function addMessage(sender, text, isError = false, isRawHTML = false) {
        const msg = document.createElement('div');
        msg.className = `message ${sender}${isError ? ' error-message' : ''}`;

        if (isRawHTML) {
            msg.innerHTML = text;
        } else if (typeof marked !== 'undefined' && text) {
            try {
                const parsed = marked.parse(text);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsed;

                tempDiv.querySelectorAll('a').forEach(link => {
                    const href = link.getAttribute('href');
                    const linkText = link.textContent.trim();

                    if (linkText === 'Xem hình ảnh' && href?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
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
                msg.textContent = text;
            }
        } else {
            msg.textContent = text ?? '';
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
        addMessage('ai', `
                    <div class="loading-wrapper" id="loading-dots">
                        Thinking
                        <span class="loading-dots">
                        <span>.</span><span>.</span><span>.</span>
                        </span>
                    </div>
                    `, false, true);

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
            chatMessages.querySelector('.loading-dots')?.closest('.message')?.remove();

            if (!res.ok) throw new Error();

            const data = await res.json();
            const reply = data.output; // reply.output là câu trả lời đã do agent LLM sinh ra, đã đúng tone, đúng guideline
            const emo = data.toolCalls?.emotion_support;
            console.log("Emotion support data:", emo);
            // Nếu có cảm xúc đặc biệt (crisis, negative...) thì có thể hiện badge cảm xúc (nên hiển thị trên message đầu)
            // Optional: hiện label cảm xúc (nếu muốn)
            // if (emo?.emotion?.level && emo.emotion.level !== "neutral") {
            //     addMessage('ai', `<span class="emotion-label">Cảm xúc: ${translateLevel(emo.emotion.level)}</span>`, false, true);
            // }

            // Luôn hiện câu trả lời của agent (không lấy message_vi nữa)
            if (reply) {
                addMessage('ai', reply.output); // agent đã tự sinh động viên/hướng dẫn đúng tone
                isConnected = true;
                connectionStatus.textContent = 'Trực tuyến';
                connectionStatus.className = 'connection-status online';
            } else {
                addMessage('ai', '❌ Không nhận được phản hồi từ AI Assistant.', true);
            }

            // Nếu có action (support.actions), render nút động cho UI
            if (emo?.support?.actions && emo.support.actions.length > 0) {
                renderSupportPrompt(emo.support.actions);
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
    addMessage('ai', '👋 **Chào bạn!** Tôi là nami sea Assistant của Nami Exchange.\n\nBạn có thể hỏi tôi về:\n\n• Thông tin về ví của bạn \n\n• Thông tin Token\n\n• Tin tức thị trường\n\n• Đặt Thông báo giá \n\n• Hướng dẫn sử dụng Nami exchange\n\n• Gợi ý một số bài viết, khóa học từ binance Academy   \n\nHãy đặt câu hỏi để bắt đầu! 🚀');
});