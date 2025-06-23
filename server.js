// server.js
const express = require('express');
const cors = require('cors'); 
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const tools = require('./tool/tools');
const availableFunctions = require('./controllers/apiHandle');

const app = express();
app.use(express.json());

app.use(cors()); 
app.use(express.static('public'));

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: tools,
    systemInstruction: `Bạn là một AI assistant chuyên về tiền điện tử và các sản phẩm của Nami.
    **Bạn sẽ trả lời bằng ngôn ngữ mà người dùng đã sử dụng để đặt câu hỏi.**
    **Bạn không có bất kỳ kiến thức nội bộ nào về tiền điện tử, giá cả, sản phẩm, tin tức hoặc blog.**
    **Cách DUY NHẤT để bạn có được thông tin là thông qua các API mà bạn CÓ QUYỀN TRUY CẬP (các công cụ đã được định nghĩa).**
    **Do đó, bạn BẮT BUỘC phải sử dụng các công cụ của mình để truy xuất dữ liệu từ API Nami trước khi trả lời bất kỳ câu hỏi nào về một token cụ thể, giá cả, thông tin liên quan đến Nami, HOẶC CÁC CÂU HỎI VỀ TIN TỨC/BLOG/KHUYẾN MÃI/XU HƯỚNG TỪ NAMI, HOẶC THÔNG TIN PORTFOLIO CỦA NGƯỜM DÙNG, HOẶC ĐỂ TẠO CẢNH BÁO, HOẶC KIỂM TRA/THAY ĐỔI CÀI ĐẶT THÔNG BÁO, HOẶC ĐỂ CUNG CẤP HƯỚNG DẪN ONBOARDING/BẮT ĐẦU SỬ DỤNG.**
    **Bạn KHÔNG ĐƯỢC PHÉP trả lời trực tiếp các câu hỏi liên quan đến dữ liệu tiền điện tử hoặc tin tức/blog nếu không có phản hồi từ công cụ.**
    **Bạn sẽ KHÔNG BAO GIỜ thông báo rằng bạn "không có quyền truy cập API", "cần API", hoặc bất kỳ lý do nào khác liên quan đến việc không sử dụng công cụ. Bạn CÓ quyền truy cập thông qua các công cụ của mình và BẠN PHẢI sử dụng chúng.**

    **QUI TẮC BẮT BUỘC VỀ NGÔN NGỮ:**
     **Bạn PHẢI VÀ CHỈ ĐƯỢC trả lời bằng ngôn ngữ mà người dùng đã sử dụng để đặt câu hỏi.**
     **Bạn PHẢI TRẢ LỜI THEO NGÔN NGỮ MÀ API TRẢ VỀ CHO BẠN VÀ BẠN KHÔNG ĐƯỢC PHÉP DỊCH LẠI THEO LỊCH SỬ CHAT MÀ PHẢI TUÂN THEO API TRẢ VỀ CHO BẠN.**
     **Nếu người dùng hỏi bằng tiếng Việt, bạn PHẢI trả lời bằng tiếng Việt.**
     **Nếu người dùng hỏi bằng tiếng Anh, bạn PHẢI trả lời bằng tiếng Anh.**
     **Tuyệt đối không trộn lẫn ngôn ngữ**
     **Tuyệt đối KHÔNG DỊCH LẠI DỮ LIỆU CỦA API TRẢ về.**

    **Khi người dùng hỏi về một token, hãy trả lời TRỰC TIẾP và NGẮN GỌT nhất có thể về trọng tâm câu hỏi.**
    **Nếu người dùng hỏi về tin tức, khuyến mãi, xu hướng hoặc bài đăng blog, hãy sử dụng công cụ phù hợp để lấy thông tin và cung cấp bản tóm tắt súc tích, bao gồm tiêu đề, ngày xuất bản, một đoạn tóm tắt ngắn và liên kết đọc thêm. Hãy nhóm các tin tức theo số thứ tự.**
    **Nếu người dùng hỏi về hiệu suất portfolio, hãy cung cấp tổng quan portfolio, tỷ lệ phân bổ tài sản, và hiệu suất 24h của các tài sản chính. Lưu ý: Giá trị portfolio sẽ được tính bằng đồng tiền cơ sở mặc định của người dùng (thường là VNST, hoặc USDT nếu được chỉ định bằng ID 22). Thông tin xu hướng giá theo tuần/tháng hiện không khả dụng.**
    **Khi người dùng muốn tạo cảnh báo, bạn PHẢI sử dụng công cụ \`create_nami_alert\`. Công cụ này sẽ tự động kiểm tra trạng thái cài đặt thông báo của người dùng và sẽ đưa ra gợi ý bật thông báo nếu chúng đang tắt. Nếu công cụ trả về cờ \`ask_to_enable_notifications: true\`, bạn PHẢI hỏi người dùng \"Bạn có muốn tôi bật cả thông báo trên thiết bị và qua email không?\". Nếu người dùng đồng ý bật, hãy sử dụng công cụ \`update_nami_notification_setting\` để bật các cài đặt đó.**
    **Khi người dùng mới hỏi về cách bắt đầu, cách tải ứng dụng, KYC, tạo ví, hoặc cần hướng dẫn chung để sử dụng app, bạn PHẢI sử dụng công cụ \`get_nami_onboarding_guide\`.**
    **QUAN TRỌNG: Khi gọi \`get_nami_onboarding_guide\`, bạn PHẢI phân tích câu hỏi của người dùng để xác định \`category_slug\` phù hợp trong danh sách sau và truyền vào hàm. Nếu không tìm thấy category_slug cụ thể, bạn có thể để \`category_slug\` là null. TRÍCH XUẤT TỪ KHÓA chi tiết từ câu hỏi của họ để truyền vào tham số \`keyword\`.**
    Danh sách các category_slug khả dụng (cả tiếng Việt và tiếng Anh):
    - **'huong-dan-chung'**: Hướng dẫn chung
    - **'dang-ky-tai-khoan-va-mat-khau'**: Đăng ký tài khoản và Mật khẩu
    - **'chuc-nang-tai-khoan'**: Chức năng tài khoản (bao gồm KYC, ví)
    - **'nap-rut-tien-ma-hoa'**: Nạp/Rút tiền mã hóa
    - **'giao-dich-spot'**: Giao dịch Giao ngay
    - **'giao-dich-futures'**: Giao dịch Futures
    - **'quy-doi'**: Quy đổi
    - **'daily-staking'**: Nhận lãi ngày (Daily Staking)
    - **'token-nami'**: Token NAMI
    - **'hop-tac-kinh-doanh'**: Hợp tác kinh doanh
    - **'tutorials'**: General Tutorials
    - **'register-account-and-password'**: Register Account and Password
    - **'account-functions'**: Account Functions
    - **'crypto-deposit-withdrawal'**: Crypto Deposit/Withdrawal
    - **'spot-trading'**: Spot Trading
    - **'futures-trading'**: Futures Trading
    - **'swap'**: Swap
    - **'daily-staking'**: Daily Staking (English version of nhận lãi ngày)
    - **'nami-token'**: NAMI Token
    - **'business-cooperation'**: Business Cooperation
    
    **Nếu không tìm thấy bài đăng nào khớp với yêu cầu tìm kiếm (bao gồm cả tháng/năm), hãy thông báo rõ ràng rằng không tìm thấy kết quả cho khoảng thời gian/chủ đề đó, nhưng sau đó đề xuất tìm kiếm các bài đăng gần đây nhất hoặc các loại tin tức/sự kiện khác.**
    **Nếu bạn đã cung cấp một danh sách bài đăng và người dùng yêu cầu "thêm", "tiếp tục", "còn gì nữa không", "hiển thị thêm", hãy hiểu rằng họ muốn THÊM BÀI ĐĂNG TƯƠNG TỰ (trong cùng loại/tháng/năm nếu còn, hoặc các bài cũ hơn). Đừng hỏi họ muốn biết thêm thông tin chi tiết về các bài đăng ĐÃ HIỂN THỊ.**

    Hướng dẫn khi sử dụng dữ liệu:
    - Sử dụng các tiêu đề hoặc các điểm gạch đầu dòng (bullet points) để trình bày thông tin rõ ràng và dễ đọc.
    - Đảm bảo câu trả lời của bạn bao gồm:
        - **Thông tin trực tiếp liên quan đến câu hỏi.**
        - **Sau đó là một bản tóm tắt ngắn gọn các khía cạnh chính khác (mục đích, dữ liệu thị trường, tokenomics).**
        - **LUÔN LUÔN BAO GỒM TẤT CẢ CÁC LIÊN KẾT ĐỌC THÊM NẾU CÓ TRONG DỮ LIỆU TỪ CÔNG CỤ. Bạn phải giữ nguyên định dạng liên kết Markdown (ví dụ: [Đọc thêm tại đây](URL)) để chúng có thể nhấp được.**
    - **QUAN TRỌNG: Nếu một công cụ trả về phản hồi chứa trường 'error' VÀ trường 'ask_for_more_info: true', thì bạn PHẢI ĐẶT CÂU HỎI LÀM RÕ cho người dùng dựa trên thông báo lỗi đó. Ví dụ: 'Bạn cần cung cấp thêm thông tin để tạo cảnh báo: [thông tin thiếu].'**
    - **Tuyệt đối KHÔNG BAO GIỜ đưa ra lời khuyên đầu tư.** Nếu người dùng hỏi về lời khuyên đầu tư (ví dụ: "có nên giữ dài hạn không?", "có phải là khoản đầu tư tốt không?"), hãy từ chối một cách lịch sự và khuyến nghị họ tham khảo ý kiến chuyên gia tài chính.
    `
});

let chat;

app.post('/ask-assistant', async (req, res) => {
    const userQuestion = req.body.question;

    if (!userQuestion) {
        return res.status(400).json({ error: "Missing question" });
    }

    let userLang = 'vi';
    const isEnglish = (text) => /[a-z]{3,}/i.test(text);

    try {
        const { franc } = await import('franc');
        const langCode = franc(userQuestion, { minLength: 3 });

        if (langCode === 'vie') {
            userLang = 'vi';
        } else if (langCode === 'eng' || isEnglish(userQuestion)) {
            userLang = 'en';
        } else {
            userLang = 'en';
        }

        console.log(`Detected user language: ${userLang} (from franc: ${langCode || 'N/A'})`);
    } catch (e) {
        console.warn('Không thể phát hiện ngôn ngữ, mặc định tiếng Việt:', e.message);
        userLang = 'vi';
    }

    if (!chat) {
        chat = model.startChat({
            history: [],
            generationConfig: {
                temperature: 0.7,
                topK: 20,
                topP: 0.9
            }
        });
    }

    try {
        const result = await chat.sendMessage(userQuestion);
        let response = result.response;
        console.log("Response from Gemini (initial):", JSON.stringify(response, null, 2));

        let hasFunctionCall = false;
        let functionCallPart = null;
        let finalToolResponse = null; // Lưu trữ phản hồi của tool để sử dụng sau

        if (response && response.candidates && response.candidates.length > 0 &&
            response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.functionCall) {
                    hasFunctionCall = true;
                    functionCallPart = part;
                    break;
                }
            }
        }

        while (hasFunctionCall) {
            const call = functionCallPart.functionCall;

            console.log(`Gemini is asking to call: ${call.name} with args:`, call.args);

            const func = availableFunctions[call.name];
            let apiResult;

            if (!func) {
                const errorMsg = `Function ${call.name} not found in availableFunctions.`;
                console.error(errorMsg);
                apiResult = { error: errorMsg };
            } else {
                console.log("Attempting to call function:", call.name, "with arguments:", call.args);

                if (call.name === 'get_nami_token_info') {
                    apiResult = await func(call.args.token_symbol, userLang);
                } else if (call.name === 'get_nami_blog_posts') {
                    apiResult = await func(call.args.query_type, call.args.keyword, userLang, call.args.month || null, call.args.year || null);
                } else if (call.name === 'get_user_portfolio_performance') {
                    apiResult = await func(userLang, call.args.name_currency || 'VNST');
                } else if (call.name === 'create_nami_alert') {
                    // Call create_nami_alert. This function now returns combined info.
                    apiResult = await func(
                        call.args.alert_type,
                        call.args.base_assets,
                        call.args.quote_asset,
                        call.args.product_type,
                        call.args.value || null,
                        call.args.percentage_change || null,
                        call.args.interval || null,
                        call.args.frequency || 'ONLY_ONCE',
                        userLang
                    );
                } else if (call.name === 'update_nami_notification_setting') {
                    apiResult = await func(call.args.useDeviceNoti, call.args.useEmailNoti, userLang);
                } else if (call.name === 'get_nami_onboarding_guide') {
                    apiResult = await func(userLang, call.args.keyword || '', call.args.category_slug || null);
                }
                else {
                    const errorMsg = `Function ${call.name} is available but not handled in server logic for argument passing.`;
                    console.error(errorMsg);
                    apiResult = { error: errorMsg };
                }
            }

            finalToolResponse = apiResult; // Lưu kết quả của tool
            console.log("API response:", apiResult);

            const newResponse = await chat.sendMessage([
                {
                    functionResponse: {
                        name: call.name,
                        response: apiResult
                    }
                }
            ]);
            response = newResponse.response;

            hasFunctionCall = false;
            functionCallPart = null;
            if (response && response.candidates && response.candidates.length > 0 &&
                response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.functionCall) {
                        hasFunctionCall = true;
                        functionCallPart = part;
                        break;
                    }
                }
            }
        }

        let llmAnswer = "Xin lỗi, tôi không thể tạo câu trả lời lúc này.";
        if (response && typeof response.text === "function") {
            llmAnswer = response.text();
            console.log("Phản hồi văn bản cuối cùng:", llmAnswer);
        } else if (response && response.candidates && response.candidates.length > 0 &&
                   response.candidates[0].content && response.candidates[0].content.parts &&
                   response.candidates[0].content.parts[0].text) {
            llmAnswer = response.candidates[0].content.parts[0].text;
            console.log("Phản hồi văn bản cuối cùng (fallback):", llmAnswer);
        } else {
            console.log("Không tìm thấy phản hồi văn bản cuối cùng từ Gemini.");
        }

        // --- NEW: Logic xử lý phản hồi từ create_nami_alert ---
        if (finalToolResponse && finalToolResponse.success && finalToolResponse.message) {
            llmAnswer = finalToolResponse.message; // Sử dụng toàn bộ message đã được xây dựng từ create_nami_alert
            if (finalToolResponse.ask_to_enable_notifications) {
                llmAnswer += (userLang === 'vi') ?
                    `\nBạn có muốn tôi bật cả thông báo trên thiết bị và qua email không?` :
                    `\nWould you like me to enable both device and email notifications?`;
            }
        } else if (finalToolResponse && finalToolResponse.error) {
            // Nếu có lỗi từ bất kỳ tool nào (bao gồm create_nami_alert)
            llmAnswer = finalToolResponse.error;
        }
        // --- END NEW LOGIC ---

        res.json({ answer: llmAnswer });

    } catch (error) {
        console.error("Lỗi khi xử lý yêu cầu:", error.response ? error.response.data : error.message);
        chat = undefined;
        res.status(500).json({ error: "Đã xảy ra lỗi, vui lòng thử lại sau." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});