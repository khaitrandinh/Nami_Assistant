// server.js
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const cors = require('cors');

const tools = require('./tool/tools'); 
const availableFunctions = require('./controllers/apiHandle'); 

const app = express();
app.use(express.json());

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);

const allowedOrigins = [ "http://localhost:3000","https://nami-assistant.vercel.app/"];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
}));

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: tools,
    systemInstruction: `Bạn là một AI assistant chuyên về tiền điện tử và các sản phẩm của Nami.
    Bạn sẽ trả lời bằng ngôn ngữ mà người dùng đã sử dụng để đặt câu hỏi.
    Bạn không có bất kỳ kiến thức nội bộ nào về tiền điện tử, giá cả hay các sản phẩm liên quan.
    Cách duy nhất để bạn có được thông tin là thông qua các API mà bạn có quyền truy cập (các công cụ được định nghĩa).
    Do đó, bạn BẮT BUỘC phải sử dụng các công cụ của mình để truy xuất dữ liệu từ API Nami trước khi trả lời bất kỳ câu hỏi nào về một token cụ thể, giá cả, hoặc thông tin liên quan đến Nami.
    Bạn không bao giờ được phép trả lời trực tiếp các câu hỏi liên quan đến dữ liệu tiền điện tử mà không có phản hồi từ công cụ.
    Bạn sẽ KHÔNG BAO GIỜ thông báo rằng bạn "không có quyền truy cập API" hoặc "cần API". Bạn CÓ quyền truy cập thông qua các công cụ của mình và BẠN PHẢI sử dụng chúng.

    Khi người dùng hỏi về một token, hãy trả lời TRỰC TIẾP và NGẮN GỌN nhất có thể về trọng tâm câu hỏi.
    Sau khi trả lời trọng tâm, bạn có thể bổ sung một cách KHÁI QUÁT và SÚC TÍCH các thông tin quan trọng khác về token (như giá, vốn hóa, tổng quan). KHÔNG cần liệt kê quá chi tiết nếu không được yêu cầu rõ ràng.

    Hướng dẫn khi sử dụng dữ liệu:
    - Sử dụng các tiêu đề hoặc các điểm gạch đầu dòng (bullet points) để trình bày thông tin rõ ràng và dễ đọc.
    - Đảm bảo câu trả lời của bạn bao gồm:
        - Thông tin trực tiếp liên quan đến câu hỏi.
        - Sau đó là một bản tóm tắt ngắn gọn các khía cạnh chính khác (mục đích, dữ liệu thị trường, tokenomics, các thông tin khác).
        - Liên kết đến website chính thức nếu có.
    - Tuyệt đối KHÔNG BAO GIỜ đưa ra lời khuyên đầu tư. Nếu người dùng hỏi về lời khuyên đầu tư (ví dụ: "có nên giữ dài hạn không?", "có phải là khoản đầu tư tốt không?"), hãy từ chối một cách lịch sự và khuyến nghị họ tham khảo ý kiến chuyên gia tài chính.
    `
});
// const model = genAI.getGenerativeModel({
//         model: "gemini-2.0-flash",
//         tools: tools,
//         systemInstruction: `
//         Bạn là AI assistant chuyên về tiền điện tử và các sản phẩm của Nami.
//         - Trả lời bằng ngôn ngữ người dùng.
//         - Bạn không có kiến thức nội bộ, chỉ sử dụng công cụ API được cấp quyền để lấy dữ liệu.
//         - BẮT BUỘC dùng công cụ để truy xuất dữ liệu trước khi trả lời các câu hỏi về token, giá hoặc thông tin liên quan.
//         - KHÔNG bao giờ trả lời trực tiếp mà không có dữ liệu công cụ.
//         - KHÔNG bao giờ nói bạn "không có quyền truy cập API".
//         - Chỉ trả lời TRỰC TIẾP, NGẮN GỌN, đúng trọng tâm câu hỏi.
//         - TUYỆT ĐỐI KHÔNG cung cấp thông tin thêm hay mở rộng.
//         - KHÔNG đưa lời khuyên đầu tư; nếu hỏi, từ chối lịch sự và khuyến nghị hỏi chuyên gia tài chính.
//         `
//         });
// History để duy trì hội thoại
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

    try {
        const result = await chat.sendMessage(userQuestion);
        let response = result.response;
        console.log("Response from Gemini:", JSON.stringify(response, null, 2));

    
        let hasFunctionCall = false;
        let functionCallPart = null;

        if (response && response.candidates && response.candidates.length > 0 &&
            response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.functionCall) {
                    hasFunctionCall = true;
                    functionCallPart = part;
                    break; // Tìm thấy functionCall, thoát vòng lặp
                }
            }
        }

        while (hasFunctionCall) { // Tiếp tục vòng lặp nếu tìm thấy functionCall

            const call = functionCallPart.functionCall; // Lấy lời gọi hàm từ part đã tìm thấy

            console.log(`Gemini is asking to call: ${call.name} with args:`, call.args);

            // Gọi hàm thực tế trong Node.js
            const func = availableFunctions[call.name];
            if (!func) {
                const errorMsg = `Function ${call.name} not found.`;
                console.error(errorMsg);
                response = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: call.name,
                            response: { error: errorMsg }
                        }
                    }
                ]);
                break; 
            }

            console.log("Attempting to call function:", call.name, "with arguments:", Object.values(call.args));
            const apiResult = await func(...Object.values(call.args)); // Thực thi hàm với các đối số

            console.log("API response:", apiResult);

            // Gửi kết quả của hàm trở lại cho Gemini
            const newResponse = await chat.sendMessage([ // Đổi tên biến để tránh nhầm lẫn
                {
                    functionResponse: {
                        name: call.name,
                        response: apiResult
                    }
                }
            ]);
            response = newResponse.response; // Cập nhật response để kiểm tra vòng lặp tiếp theo

            // Sau khi gửi functionResponse, kiểm tra lại response mới xem có functionCall khác không
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

        // Cuối cùng, Gemini sẽ trả lời bằng văn bản
        let llmAnswer = "Xin lỗi, tôi không thể tạo câu trả lời lúc này.";
        if (response && typeof response.text === "function") {
            llmAnswer = response.text();
            console.log(llmAnswer);
        } else if (response && response.candidates && response.candidates.length > 0 &&
                response.candidates[0].content && response.candidates[0].content.parts &&
                response.candidates[0].content.parts[0].text) {
            llmAnswer = response.candidates[0].content.parts[0].text;
        }

        res.json({ answer: llmAnswer });

    } catch (error) {
        console.error("Error processing request:", error.response ? error.response.data : error.message);
        chat = undefined;
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
});


app.use(express.static('public'));


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});