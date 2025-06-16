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
    model: "gemini-1.5-flash",
    tools: tools,
    systemInstruction: `Bạn là một AI assistant chuyên về tiền điện tử và các sản phẩm của Nami.
    **Bạn sẽ trả lời bằng ngôn ngữ mà người dùng đã sử dụng để đặt câu hỏi.**
    **Bạn không có bất kỳ kiến thức nội bộ nào về tiền điện tử, giá cả, sản phẩm, tin tức hoặc blog.**
    **Cách DUY NHẤT để bạn có được thông tin là thông qua các API mà bạn CÓ QUYỀN TRUY CẬP (các công cụ đã được định nghĩa).**
    **Do đó, bạn BẮT BUỘC phải sử dụng các công cụ của mình để truy xuất dữ liệu từ API Nami và CoinGecko trước khi trả lời bất kỳ câu hỏi nào về một token cụ thể, giá cả, thông tin liên quan đến Nami, HOẶT CÁC CÂU HỎI VỀ TIN TỨC/BLOG/KHUYẾN MÃI/XU HƯỚNG TỪ NAMI.**
    **Bạn KHÔNG ĐƯỢC PHÉP trả lời trực tiếp các câu hỏi liên quan đến dữ liệu tiền điện tử hoặc tin tức/blog nếu không có phản hồi từ công cụ.**
    **Bạn sẽ KHÔNG BAO GIỜ thông báo rằng bạn "không có quyền truy cập API", "cần API", hoặc bất kỳ lý do nào khác liên quan đến việc không sử dụng công cụ. Bạn CÓ quyền truy cập thông qua các công cụ của mình và BẠN PHẢI sử dụng chúng.**

    **Khi người dùng hỏi về một token, hãy trả lời TRỰC TIẾP và NGẮN GỌN nhất có thể về trọng tâm câu hỏi.**
    **Nếu người dùng hỏi về tin tức, khuyến mãi, xu hướng hoặc bài đăng blog, hãy sử dụng công cụ phù hợp để lấy thông tin và cung cấp bản tóm tắt súc tích, bao gồm tiêu đề, ngày xuất bản, một đoạn tóm tắt ngắn và liên kết đọc thêm.**
    **Sau khi trả lời trọng tâm, bạn có thể bổ sung một cách KHÁI QUÁT và SÚC TÍCH các thông tin quan trọng khác về token (như giá, vốn hóa, tổng quan). KHÔNG cần liệt kê quá chi tiết nếu không được yêu cầu rõ ràng.**

    Hướng dẫn khi sử dụng dữ liệu:
    - Sử dụng các tiêu đề hoặc các điểm gạch đầu dòng (bullet points) để trình bày thông tin rõ ràng và dễ đọc.
    - Đảm bảo câu trả lời của bạn bao gồm:
        - **Thông tin trực tiếp liên quan đến câu hỏi.**
        - **Sau đó là một bản tóm tắt ngắn gọn các khía cạnh chính khác (mục đích, dữ liệu thị trường, tokenomics).**
        - **Liên kết đến website chính thức nếu có.**
    - **Tuyệt đối KHÔNG BAO GIỜ đưa ra lời khuyên đầu tư.** Nếu người dùng hỏi về lời khuyên đầu tư (ví dụ: "có nên giữ dài hạn không?", "có phải là khoản đầu tư tốt không?"), hãy từ chối một cách lịch sự và khuyến nghị họ tham khảo ý kiến chuyên gia tài chính.
    `
});

let chat;

app.post('/ask-assistant', async (req, res) => {
    const userQuestion = req.body.question;

    if (!userQuestion) {
        return res.status(400).json({ error: "Missing question" });
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

    // PHÁT HIỆN NGÔN NGỮ BẰNG DYNAMIC IMPORT
    let userLang = 'vi'; // Giá trị mặc định an toàn
    try {
        const { franc } = await import('franc'); 
        const langCode = franc(userQuestion, { minLength: 3 });
        // Chỉ gán nếu franc trả về một mã ngôn ngữ hợp lệ, nếu không giữ mặc định.
        if (langCode && (langCode === 'eng' || langCode === 'vie')) {
            userLang = (langCode === 'eng') ? 'en' : 'vi';
        }
        console.log(`Detected user language: ${userLang} (from franc: ${langCode || 'N/A'})`);
    } catch (e) {
        console.warn('Không thể phát hiện ngôn ngữ, mặc định tiếng Việt:', e.message);
        userLang = 'vi'; // Đảm bảo luôn là 'vi' nếu có lỗi franc
    }

    try {
        const result = await chat.sendMessage(userQuestion);
        let response = result.response;
        console.log("Response from Gemini (initial):", JSON.stringify(response, null, 2));

        let hasFunctionCall = false;
        let functionCallPart = null;

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
                
                // GỌI HÀM CỤ THỂ DỰA TRÊN TÊN HÀM VÀ TRUYỀN THAM SỐ CHÍNH XÁC
                if (call.name === 'get_nami_token_info') {
                    // get_nami_token_info chỉ nhận token_symbol
                    apiResult = await func(call.args.token_symbol);
                } else if (call.name === 'get_nami_blog_posts') {
                    // get_nami_blog_posts nhận query_type, keyword, lang
                    apiResult = await func(call.args.query_type, call.args.keyword, userLang);
                }
                // Thêm các trường hợp khác nếu bạn có thêm hàm trong tools.js và apiHandle.js
                // else if (call.name === 'get_nami_token_duration_change') {
                //     apiResult = await func(call.args.token_symbol, call.args.duration);
                // }
                else {
                    const errorMsg = `Function ${call.name} is available but not handled in server logic for argument passing.`;
                    console.error(errorMsg);
                    apiResult = { error: errorMsg };
                }
            }
            
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