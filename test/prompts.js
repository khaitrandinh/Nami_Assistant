const {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");


const rawSystemTemplate = `Bạn là một AI assistant chuyên về tiền điện tử và các sản phẩm của Nami.
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

const systemPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(rawSystemTemplate),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
  new MessagesPlaceholder("agent_scratchpad") // ✅ KHÔNG dùng SystemMessage
]);

module.exports = { systemPrompt };


// new DynamicStructuredTool({
//       name: "emotion_support",
//       description: "Phát hiện sắc thái cảm xúc, đánh giá mức độ stress/lo lắng và trả về prompt hỗ trợ phù hợp",
//       schema: z.object({
//         text: z.string().describe("Nội dung người dùng nhập"),
//         userId: z.string().optional().describe("ID người dùng để track emotion trend"),
//         previousEmotion: z.string().optional().describe("Cảm xúc trước đó nếu có")
//       }),
//       func: async ({ text, userId, previousEmotion }) => {
//         // Phân tích sentiment cơ bản
//         const result = sentiment.analyze(text);
//         console.log(`→ Sentiment analysis result: ${JSON.stringify(result)}`);

//         // Từ khóa stress/negative - mở rộng
//         const stressKeywords = [
//           // Tài chính/Trading
//           'mất tiền', 'thua lỗ', 'liquidated', 'margin call', 'sập giá',
//           'cháy tài khoản', 'cut loss', 'stop loss', 'về 0', 'sập hầm',
//           'fomo', 'long cháy', 'short cháy', 'bị hunt', 'pump dump', 'rug pull',
//           'scam', 'hack', 'mất ví', 'quên seed phrase', 'bị lừa',
          
//           // Cảm xúc tiêu cực
//           'panic', 'sợ hãi', 'lo lắng', 'stress', 'áp lực', 'không ngủ được',
//           'phá sản', 'nợ nần', 'buồn', 'chán nản', 'tức giận', 'khó chịu', 'bực bội',
//           'xóa app', 'bỏ cuộc', 'thất vọng', 'tuyệt vọng', 'khủng hoảng',
          
//           // Kỹ thuật/Lỗi
//           'không rút được', 'pending mãi', 'lỗi hệ thống', 'stuck', 'freeze',
//           'không load được', 'mất kết nối', 'server lỗi',
          
//           // Tình huống khẩn cấp
//           'gia đình', 'vay tiền', 'all in', 'cần gấp', 'khó khăn tài chính',
//           'không có tiền', 'cần tiền', 'phải bán', 'ép buộc'
//         ];

//         // Từ khóa positive - mở rộng
//         const positiveKeywords = [
//           // Lợi nhuận
//           'lãi', 'profit', 'lãi to', 'x2', 'x5', 'x10', 'về bờ', 'recovered',
//           'moon', 'to the moon', 'pump', 'tăng mạnh', 'break out', 'ath',
//           'all time high', 'bull run', 'golden cross',
          
//           // Tâm lý tích cực
//           'hold', 'hodl', 'mua đáy', 'dca', 'long term', 'tin tưởng',
//           'kiên nhẫn', 'bình tĩnh', 'tự tin', 'lạc quan', 'vui', 'hạnh phúc',
//           'thành công', 'may mắn', 'tuyệt vời', 'xuất sắc'
//         ];

//         // Từ khóa ngữ cảnh giao dịch
//         const tradingContext = {
//           technical_issue: ['không rút được', 'lỗi', 'pending', 'stuck', 'freeze', 'server'],
//           market_concern: ['sập giá', 'dump', 'crash', 'bear market', 'điều chỉnh'],
//           profit_loss: ['lãi', 'lỗ', 'profit', 'loss', 'pnl', 'roi'],
//           beginner: ['mới', 'không biết', 'chưa hiểu', 'lần đầu', 'newbie'],
//           crisis: ['phá sản', 'nợ nần', 'gia đình', 'vay tiền', 'all in', 'cần gấp']
//         };

//         // Phân tích từ khóa
//         const low = text.toLowerCase();
//         const stressCount = stressKeywords.filter(w => low.includes(w)).length;
//         const positiveCount = positiveKeywords.filter(w => low.includes(w)).length;
        
//         // Phát hiện ngữ cảnh
//         const contexts = {};
//         Object.keys(tradingContext).forEach(context => {
//           contexts[context] = tradingContext[context].some(w => low.includes(w));
//         });

//         // Tính adjusted score với trọng số
//         let adjustedScore = result.score;
//         adjustedScore -= stressCount * 2;
//         adjustedScore += positiveCount * 1.5;
        
//         // Trọng số đặc biệt cho crisis
//         if (contexts.crisis) adjustedScore -= 3;
//         if (contexts.technical_issue) adjustedScore -= 1;

//         // Phân loại emotion level
//         let emotionLevel;
//         if (adjustedScore <= -4) emotionLevel = 'crisis';
//         else if (adjustedScore <= -3) emotionLevel = 'very_negative';
//         else if (adjustedScore <= -1) emotionLevel = 'negative';
//         else if (adjustedScore <= 1) emotionLevel = 'neutral';
//         else if (adjustedScore <= 3) emotionLevel = 'positive';
//         else emotionLevel = 'very_positive';

//         // Đánh giá độ tin cậy
//         const confidence = {
//           level: stressCount >= 2 || positiveCount >= 2 ? 'high' : 
//                 stressCount === 1 || positiveCount === 1 ? 'medium' : 'low',
//           score: Math.min(1, (stressCount + positiveCount) / 3)
//         };

//         // Xác định nhu cầu hỗ trợ
//         const needsSupport = adjustedScore <= -2 || stressCount >= 2 || contexts.crisis;
//         const needsImmediateSupport = emotionLevel === 'crisis' || (adjustedScore <= -4);

//         // Phân tích xu hướng (nếu có emotion trước đó)
//         let emotionTrend = null;
//         if (previousEmotion) {
//           const trends = {
//             'crisis': 5, 'very_negative': 4, 'negative': 3, 
//             'neutral': 2, 'positive': 1, 'very_positive': 0
//           };
//           const currentLevel = trends[emotionLevel] || 2;
//           const previousLevel = trends[previousEmotion] || 2;
          
//           if (currentLevel > previousLevel) emotionTrend = 'deteriorating';
//           else if (currentLevel < previousLevel) emotionTrend = 'improving';
//           else emotionTrend = 'stable';
//         }

//         // Tạo response messages
//         const getResponseMessage = (level, contexts, lang = 'vi') => {
//           const messages = {
//             vi: {
//               crisis: "Mình hiểu bạn đang trải qua thời điểm rất khó khăn. Điều quan trọng nhất là bạn hãy bình tĩnh, thở sâu. Nếu cần, mình có thể kết nối bạn với đội hỗ trợ chuyên nghiệp ngay lập tức.",
              
//               very_negative: "Mình thấy bạn đang rất stress. Điều này hoàn toàn có thể hiểu được. Hãy tạm dừng giao dịch và nghỉ ngơi một chút. Mình ở đây để hỗ trợ bạn.",
              
//               negative: contexts.technical_issue ? 
//                 "Mình hiểu việc gặp lỗi kỹ thuật có thể khiến bạn khó chịu. Hãy cùng mình xem có gì có thể hỗ trợ bạn ngay." :
//                 "Mình thấy bạn đang hơi lo lắng. Điều này hoàn toàn bình thường trong trading. Hãy cùng mình xem có gì có thể hỗ trợ bạn.",
              
//               neutral: "Mình sẵn sàng hỗ trợ bạn. Bạn cần giúp gì?",
              
//               positive: "Mình thấy bạn đang có tinh thần tốt! Cùng tiếp tục nhé.",
              
//               very_positive: "Tuyệt vời! Mình thấy bạn đang rất tích cực. Chúc mừng bạn!"
//             },
//             en: {
//               crisis: "I understand you're going through a very difficult time. The most important thing is to stay calm and take deep breaths. If needed, I can connect you with professional support immediately.",
              
//               very_negative: "I can see you're very stressed. This is completely understandable. Please take a break from trading and rest. I'm here to support you.",
              
//               negative: contexts.technical_issue ? 
//                 "I understand technical issues can be frustrating. Let me help you resolve this right away." :
//                 "I notice you're feeling a bit worried. This is completely normal in trading. Let me see how I can help you.",
              
//               neutral: "I'm ready to help you. What do you need?",
              
//               positive: "I can see you're in good spirits! Let's keep going.",
              
//               very_positive: "Excellent! I can see you're very positive. Congratulations!"
//             }
//           };
          
//           return messages[lang][level] || messages[lang]['neutral'];
//         };

//         // Tạo action recommendations
//         const getActionRecommendations = (level, contexts) => {
//           const actions = {
//             crisis: ['connect_cs_urgent', 'pause_trading', 'seek_professional_help'],
//             very_negative: ['connect_cs', 'pause_trading', 'emotional_support'],
//             negative: contexts.technical_issue ? 
//               ['troubleshoot', 'connect_cs', 'provide_guide'] : 
//               ['emotional_support', 'risk_management_tips', 'market_education'],
//             neutral: ['provide_info', 'ask_clarification'],
//             positive: ['continue_conversation', 'provide_advanced_tips'],
//             very_positive: ['celebrate', 'provide_advanced_tips', 'share_success']
//           };
          
//           return actions[level] || actions['neutral'];
//         };

//         // Kết quả trả về
//         const base = {
//           // Sentiment analysis
//           sentiment: {
//             score: result.score,
//             adjustedScore,
//             comparative: result.comparative,
//             confidence
//           },
          
//           // Emotion classification
//           emotion: {
//             level: emotionLevel,
//             trend: emotionTrend,
//             needsSupport,
//             needsImmediateSupport
//           },
          
//           // Context analysis
//           context: {
//             indicators: {
//               stress: stressCount,
//               positive: positiveCount
//             },
//             trading: contexts,
//             keywords: {
//               stress: stressKeywords.filter(w => low.includes(w)),
//               positive: positiveKeywords.filter(w => low.includes(w))
//             }
//           },
          
//           // Recommendations
//           recommendations: {
//             actions: getActionRecommendations(emotionLevel, contexts),
//             priority: needsImmediateSupport ? 'urgent' : needsSupport ? 'high' : 'normal'
//           }
//         };

//         // Trả về response với message nếu cần support
//         if (needsSupport) {
//           return {
//             ...base,
//             support: {
//               required: true,
//               immediate: needsImmediateSupport,
//               message_vi: getResponseMessage(emotionLevel, contexts, 'vi'),
//               message_en: getResponseMessage(emotionLevel, contexts, 'en'),
              
//               // Buttons/Actions cho UI
//               actions: needsImmediateSupport ? [
//                 { type: 'connect_cs_urgent', label_vi: 'Kết nối hỗ trợ khẩn cấp', label_en: 'Connect urgent support' },
//                 { type: 'pause_trading', label_vi: 'Tạm dừng giao dịch', label_en: 'Pause trading' }
//               ] : [
//                 { type: 'connect_cs', label_vi: 'Kết nối hỗ trợ', label_en: 'Connect support' },
//                 { type: 'get_tips', label_vi: 'Nhận mẹo hữu ích', label_en: 'Get helpful tips' },
//                 { type: 'continue', label_vi: 'Tiếp tục trò chuyện', label_en: 'Continue chat' }
//               ]
//             }
//           };
//         } else {
//           return {
//             ...base,
//             support: {
//               required: false,
//               message_vi: getResponseMessage(emotionLevel, contexts, 'vi'),
//               message_en: getResponseMessage(emotionLevel, contexts, 'en')
//             }
//           };
//         }
//       },
//     }),
    // new DynamicStructuredTool({
    //     name: "get_binance_knowledge",
    //     description: "Tìm câu trả lời từ Binance Academy cho người mới, RAG dựa trên nội dung bài học.",
    //     schema: z.object({
    //         query: z
    //         .string()
    //         .describe("Câu hỏi về kiến thức cơ bản tiền điện tử trên Binance Academy"),
    //     }),
    //     func: async ({ query }) => {
    //         // 1. Lấy docs
    //         const docs = await binanceRag.getRelevantDocuments(query);
    //         if (!docs?.length) {
    //         return `Không tìm thấy kết quả cho "${query}" trên Binance Academy.`;
    //         }
    //         // 2. Chọn top kết quả
    //         const MAX_RESULTS = Math.min(docs.length, 5);
    //         const MAX_SNIPPET = 200;
    //         // console.log(`→ Found ${docs} results, returning top ${MAX_RESULTS}`);
    //         const items = docs.slice(0, MAX_RESULTS).map((d, i) => {
    //             const title = d.metadata.title || `Kết quả ${i + 1}`;
    //             const url = d.metadata.source;
    //             let raw = d.metadata?.description || "";
    //             let snippet = raw.trim().replace(/\s+/g, ' ');
    //             if (snippet.length > MAX_SNIPPET) {
    //                 snippet = snippet.slice(0, MAX_SNIPPET).trim() + "...";
    //             }
    //             // console.log(`→ Processing doc ${raw} characters: ${title}`);
    //             // console.log(`→ Extracted content length: ${metadata.pageContent} characters`);
    //             return (
    //                 `**${i + 1}. ${title}**  \n\n` +
    //                 `${snippet}  \n\n` +
    //                 `🔗 [Đọc thêm](${url})`
    //             );
    //         });
    //         // 3. Nếu có nhiều hơn MAX_RESULTS, gợi ý xem thêm
    //         if (docs.length > MAX_RESULTS) {
    //         items.push(
    //             `\n…vẫn còn ${docs.length - MAX_RESULTS} kết quả nữa. ` +
    //             `Nếu bạn muốn, hãy yêu cầu “cho tôi xem thêm”.`
    //         );
    //         }
    //         return items.join("\n\n");
    //     },
    // })