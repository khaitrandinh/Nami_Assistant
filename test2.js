// server.js
const express = require('express');
const cors = require('cors'); // Nếu cần gọi từ frontend khác domain
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const tools = require('./tool/tools'); // Các function declarations
const availableFunctions = require('./controllers/apiHandle'); // Các hàm xử lý thực tế

const app = express();
app.use(express.json());

// Nếu frontend gọi từ domain khác, mở CORS
// app.use(cors());

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: tools,
    systemInstruction: `Bạn là một AI assistant chuyên về tiền điện tử và các sản phẩm của Nami.
Nhiệm vụ của bạn là cung cấp thông tin chính xác, chi tiết và tổng hợp về các token dựa trên dữ liệu bạn có thể truy xuất từ các API Nami và CoinGecko.
Khi bạn nhận được dữ liệu từ API, hãy:
- **Tổng hợp thông tin một cách tự nhiên và mạch lạc.**
- **Ưu tiên thông tin về trường hợp sử dụng (use case), mục đích, công nghệ cốt lõi của token.**
- **Sau đó, cung cấp các thông tin thị trường quan trọng như giá hiện tại, vốn hóa thị trường, và biến động giá 24h.**
- **Chỉ đề cập đến Tokenomics và Lộ trình phát triển nếu người dùng hỏi cụ thể, hoặc nếu nó là thông tin nổi bật.**
- **Tuyệt đối KHÔNG BAO GIỜ đưa ra lời khuyên đầu tư.** Nếu người dùng hỏi về lời khuyên đầu tư, hãy từ chối lịch sự và khuyến nghị tham khảo chuyên gia tài chính.
- **Sử dụng tiếng Việt thân thiện và dễ hiểu.**
- **Tránh các câu nói chung chung nếu đã có dữ liệu.**`
});

// Khai báo biến lưu trạng thái chat (history)
let chat;

app.post('/ask-assistant', async (req, res) => {
    const userQuestion = req.body.question;

    if (!userQuestion) {
        return res.status(400).json({ error: "Missing question" });
    }

    // Khởi tạo chat nếu chưa có
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
        // Gửi câu hỏi ban đầu
        let response = await chat.sendMessage(userQuestion);
        console.log("Response from Gemini:", JSON.stringify(response, null, 2));
        // Xử lý vòng lặp gọi function nếu Gemini yêu cầu
        while (
            response &&
            response.candidates &&
            response.candidates.length > 0 &&
            response.candidates[0].content &&
            response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0 &&
            response.candidates[0].content.parts[0].functionCall
        ) {
            const call = response.candidates[0].content.parts[0].functionCall;

            console.log(`Gemini yêu cầu gọi hàm: ${call.name} với args:`, call.args);

            // Parse args nếu là chuỗi JSON
            let args = call.args;
            if (typeof args === "string") {
                try {
                    args = JSON.parse(args);
                } catch (e) {
                    console.error("Lỗi parse functionCall args:", e);
                    args = {};
                }
            }

            // Lấy hàm thực thi theo tên
            const func = availableFunctions[call.name];
            if (!func) {
                const errorMsg = `Function ${call.name} không tồn tại.`;
                console.error(errorMsg);
                // Gửi phản hồi lỗi về Gemini để thoát vòng lặp
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

            // Gọi hàm với tham số đúng (vd: token_symbol)
            // Nếu hàm bạn có nhiều tham số, cần map đúng thứ tự
            const apiResult = await func(args.token_symbol);
            // console.log("Kết quả trả về từ API:", apiResult);
            console.log("Kết quả trả về từ API:", apiResult);

            // Gửi kết quả hàm trở lại Gemini
            response = await chat.sendMessage([
                {
                    functionResponse: {
                        name: call.name,
                        response: apiResult
                    }
                }
            ]);
        }

        // Lấy câu trả lời cuối cùng (text) từ response
        let llmAnswer = "Xin lỗi, tôi không thể tạo câu trả lời lúc này.";
        if (response && typeof response.text === "function") {
            llmAnswer = response.text();
        } else if (
            response &&
            response.candidates &&
            response.candidates.length > 0 &&
            response.candidates[0].content &&
            response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0 &&
            response.candidates[0].content.parts[0].text
        ) {
            llmAnswer = response.candidates[0].content.parts[0].text;
        }

        console.log("Phản hồi trả về người dùng:", llmAnswer);

        res.json({ answer: llmAnswer });
    } catch (error) {
        console.error("Lỗi khi xử lý yêu cầu:", error.response ? error.response.data : error.message);
        chat = undefined; // Reset chat để tránh lỗi dồn lịch sử
        res.status(500).json({ error: "Đã xảy ra lỗi, vui lòng thử lại sau." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
// --- Hàm xử lý get_coingecko_token_details ---

// --- Hàm nội bộ: Lấy CoinGecko ID (sử dụng /coins/list) ---
// async function get_coingecko_id(token_symbol) {
//     if (coingeckoCoinIdMap[token_symbol.toUpperCase()]) {
//         return coingeckoCoinIdMap[token_symbol.toUpperCase()];
//     }
//     try {
//         // GET Coingecko: get list coins id -> /coins/list
//         const response = await axios.get(`${COINGECKO_API_BASE_URL}/coins/list`);
//         const coins = response.data;
//         const foundCoin = coins.find(coin =>
//             coin.symbol.toLowerCase() === token_symbol.toLowerCase() ||
//             coin.name.toLowerCase() === token_symbol.toLowerCase()
//         );
//         if (foundCoin) {
//             coingeckoCoinIdMap[token_symbol.toUpperCase()] = foundCoin.id;
//             return foundCoin.id;
//         }
//         return null;
//     } catch (error) {
//         console.error(`Error fetching CoinGecko ID for ${token_symbol}:`, error.message);
//         return null;
//     }
// }

// --- HÀM MỚI: Lấy Nami Asset ID (sử dụng /asset/config) ---