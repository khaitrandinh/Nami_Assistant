const { DynamicStructuredTool } = require("langchain/tools");
const { z } = require("zod");
const { loadSummarizationChain } = require("langchain/chains");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const {
    get_nami_token_info,
    get_nami_blog_posts,
    get_user_portfolio_performance,
    create_nami_alert,
    update_nami_notification_setting,
    get_nami_onboarding_guide,
} = require("../handlers/apiHandle");
const { getAcademyRAG } = require("./rag");
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

async function buildTools() {
const binanceRag = await getAcademyRAG();

 const summarizationChain = loadSummarizationChain(
    new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 0,
      apiKey: process.env.GOOGLE_API_KEY
    }),
    { type: "map_reduce" }
  );
const tools = [
    new DynamicStructuredTool({
        name: "get_nami_token_info",
        description: "Truy xuất thông tin chi tiết về một token tiền điện tử trên Nami Exchange.",
        schema: z.object({
            token_symbol: z.string().describe("Mã ký hiệu token, ví dụ: BTC, ETH, tên token bitcoin, ethereum,..."),
        }),
        func: async ({ token_symbol }) => {
            const result = await get_nami_token_info(token_symbol);
            return JSON.stringify(result);
        },
    }),

    new DynamicStructuredTool({
        name: "get_nami_blog_posts",
        description: "Lấy bài viết, tin tức, thông báo từ blog của Nami Exchange.",
        schema: z.object({
            query_type: z.enum(["latest", "events", "new_listing", "delisting", "trending", "news"]).optional().default("latest").describe("Loại thông tin blog/tin tức mà người dùng muốn tìm. Có thể là 'latest' (mới nhất), 'events' (sự kiện, giải đấu, chiến dịch, khuyến mãi), 'new_listing' (niêm yết token mới), 'delisting' (hủy niêm yết token), 'trending' (xu hướng/hot topic), hoặc 'news' (tin tức chung). Mặc định là 'latest' nếu không rõ."),
            keyword: z.string().optional().describe("Từ khóa tìm kiếm cụ thể trong bài viết. Nếu không có từ khóa, sẽ lấy tất cả bài viết mới nhất."),
            lang: z.enum(["vi", "en"]).optional().default("vi"),
            month: z.number().optional(),
            year: z.number().optional().describe("Năm của bài đăng (ví dụ: 2024, 2025). CỰC KỲ QUAN TRỌNG: LUÔN LUÔN TRÍCH XUẤT NĂM nếu người dùng hỏi về một năm cụ thể."),
        }),
        func: async (args) => {
            const result = await get_nami_blog_posts(
                args.query_type,
                args.keyword,
                args.lang,  
                args.month,
                args.year
            );
            return JSON.stringify(result);
        },
    }),

    new DynamicStructuredTool({
        name: "get_user_portfolio_performance",
        description: "Truy xuất hiệu suất danh mục đầu tư người dùng trên Nami Exchange.",
        schema: z.object({
            lang: z.enum(["vi", "en"]).optional().default("vi"),
            name_currency: z.enum(["VNST", "USDT"]).optional().default("VNST"),
        }),
        func: async ({ lang, name_currency }) => {
            const result = await get_user_portfolio_performance(lang, name_currency);
            return JSON.stringify(result);
        },
    }),

    new DynamicStructuredTool({
        name: "create_nami_alert",
        description: "Tạo cảnh báo giá hoặc biến động token.",
        schema: z.object({
            alert_type: z.enum([
                "REACH_PRICE",
                "PRICE_RISES_ABOVE",
                "PRICE_DROPS_TO",
                "CHANGE_IS_OVER",
                "CHANGE_IS_UNDER",
                "DAY_CHANGE_IS_OVER",
                "DAY_CHANGE_IS_DOWN",
                "DURATION_CHANGE_IS_OVER",
                "DURATION_CHANGE_IS_UNDER",
                "DURATION_CHANGE"
            ]).describe("Loại cảnh báo cần tạo. Ví dụ: 'REACH_PRICE' (giá đạt đến), 'PRICE_RISES_ABOVE' (giá tăng lên trên), 'PRICE_DROPS_TO' (giá giảm xuống dưới), 'CHANGE_IS_OVER' (giá tăng trên một ngưỡng), 'CHANGE_IS_UNDER' (giá giảm dưới một ngưỡng), 'DAY_CHANGE_IS_OVER' (biến động 24h tăng trên), 'DAY_CHANGE_IS_DOWN' (biến động 24h giảm xuống), 'DURATION_CHANGE_IS_OVER' (biến động trong X giờ tăng trên), 'DURATION_CHANGE_IS_UNDER' (biến động trong X giờ giảm xuống), 'DURATION_CHANGE' (biến động trong X giờ tăng hoặc giảm)."),
            base_assets: z.array(z.string()).min(1)
                .describe("Một hoặc nhiều token cơ sở, ví dụ ['BTC'] hoặc ['ETH','BTC']"),
            quote_asset: z.enum(["USDT", "VNST"]).default("USDT"),
            product_type: z.enum(["SPOT", "NAMI_FUTURES", "NAO_FUTURES"]).default("SPOT"),
            value: z.number().optional(),
            percentage_change: z.number().optional(),
            interval: z.enum(["1", "4", "8", "12", "24"]).optional(),
            frequency: z.enum(["ONLY_ONCE", "ONCE_A_DAY", "ALWAYS"]).default("ONLY_ONCE"),
            lang: z.enum(["vi", "en"]).default("vi")
        }),
        func: async (args) => {
            const result = await create_nami_alert(
                args.alert_type,
                args.base_assets,
                args.quote_asset,
                args.product_type,
                args.value,
                args.percentage_change,
                args.interval,
                args.frequency,
                args.lang
            );
            return JSON.stringify(result);
        },
    }),

    new DynamicStructuredTool({
        name: "update_nami_notification_setting",
        description: "Cập nhật cài đặt nhận thông báo qua thiết bị hoặc email.",
        schema: z.object({
            useDeviceNoti: z.boolean(),
            useEmailNoti: z.boolean(),
            lang: z.enum(["vi", "en"]).optional().default("vi"),
        }),
        func: async ({ useDeviceNoti, useEmailNoti, lang }) => {
            const result = await update_nami_notification_setting(useDeviceNoti, useEmailNoti, lang);
            return JSON.stringify(result);
        },
    }),

    new DynamicStructuredTool({
        name: "get_nami_onboarding_guide",
        description: "Cung cấp hướng dẫn từng bước cho người dùng mới bắt đầu sử dụng Nami Exchange, bao gồm đăng ký tài khoản, hoàn tất KYC, nạp tiền vào ví và thực hiện giao dịch đầu tiên. Sử dụng hàm này khi người dùng hỏi về 'bắt đầu', 'hướng dẫn', 'tải app xong', 'KYC', 'tạo ví', 'làm gì tiếp theo', 'làm quen app' hoặc các hướng dẫn cụ thể về onboarding. Có thể lọc theo danh mục cụ thể hoặc từ khóa chi tiết. **QUAN TRỌNG: Khi gọi hàm này, bạn PHẢI phân tích câu hỏi của người dùng để xác định `category_slug` phù hợp trong danh sách sau và truyền vào hàm. Nếu không tìm thấy `category_slug` cụ thể, bạn có thể để `category_slug` là null. TRÍCH XUẤT TỪ KHÓA chi tiết từ câu hỏi của họ để truyền vào tham số `keyword`.**",
        schema: z.object({
            lang: z.enum(["vi", "en"]).optional().default("vi"),
            keyword: z.string().optional(),
            category_slug: z.enum([
                'huong-dan-chung', // map to faq-vi-huong-dan-chung
                'dang-ky-tai-khoan-va-mat-khau', // map to faq-vi-dang-ky-tai-khoan-va-mat-khau
                'chuc-nang-tai-khoan', // map to faq-vi-chuc-nang-tai-khoan
                'nap-rut-tien-ma-hoa', // map to faq-vi-nap-rut-tien-ma-hoa
                'giao-dich-spot', // map to faq-vi-giao-dich-spot
                'giao-dich-futures', // map to faq-vi-giao-dich-futures
                'quy-doi', // map to faq-vi-quy-doi
                'daily-staking', // map to faq-vi-daily-staking
                'token-nami', // map to faq-vi-token-nami
                'hop-tac-kinh-doanh', // map to faq-vi-hop-tac-kinh-doanh
                'tutorials', // map to faq-en-tutorials
                'register-account-and-password', // map to faq-en-register-account-and-password
                'account-functions', // map to faq-en-account-functions
                'crypto-deposit-withdrawal', // map to faq-en-crypto-deposit-withdrawal
                'spot-trading', // map to faq-en-spot-trading
                'futures-trading', // map to faq-en-futures-trading
                'swap', // map to faq-en-swap
                'daily-staking-en', // map to faq-en-daily-staking
                'nami-token', // map to faq-en-nami-token
                'business-cooperation' // map to faq-en-business-cooperation
              ]).optional().describe("Slug của danh mục FAQ mà người dùng muốn tìm hướng dẫn. PHẢI chọn một trong các slug sau nếu câu hỏi của người dùng khớp với một danh mục cụ thể (cả tiếng Việt và tiếng Anh): 'huong-dan-chung', 'dang-ky-tai-khoan-va-mat-khau', 'chuc-nang-tai-khoan', 'nap-rut-tien-ma-hoa', 'giao-dich-spot', 'giao-dich-futures', 'quy-doi', 'daily-staking', 'token-nami', 'hop-tac-kinh-doanh', 'tutorials', 'register-account-and-password', 'account-functions', 'crypto-deposit-withdrawal', 'spot-trading', 'futures-trading', 'swap', 'daily-staking-en', 'nami-token', 'business-cooperation'."),
        }),
        func: async ({ lang, keyword, category_slug }) => {
            const result = await get_nami_onboarding_guide(lang, keyword, category_slug);
            return JSON.stringify(result);
        },
    }),
    new DynamicStructuredTool({
      name: 'get_binance_knowledge',
      description: 'Deep‐search RAG trên Binance Academy: tóm tắt nội dung và cung cấp link.',
      schema: z.object({
        query: z.string().describe(
          'Câu hỏi về kiến thức cơ bản trên Binance Academy'
        )
      }),
      func: async ({ query }) => {
        const docs = await binanceRag.getRelevantDocuments(query);
        if (!docs.length) {
          return `Không tìm thấy kết quả cho "${query}" trên Binance Academy.`;
        }
        // Tóm tắt đa tài liệu
        const summary = await summarizationChain.call({
          input_documents: docs,
          question: query
        });
        // Liệt kê link
        const links = docs.map((d, i) =>
          `**${i + 1}.** [${d.metadata.title}](${d.metadata.source}) \n` +
            `*${d.metadata.description || 'Không có mô tả'}*`
        ).join('\n');

        return `${summary.text.trim()}\n\n🔗 Đọc chi tiết:\n${links}`;
      }
    }),
    new DynamicStructuredTool({
      name: "emotion_support",
      description: "Phát hiện sắc thái cảm xúc, đánh giá mức độ stress/lo lắng và (nếu cần) trả về prompt hỗ trợ với nút “Đồng ý”/“Không”.",
      schema: z.object({
        text: z.string().describe("Nội dung người dùng nhập")
      }),
      func: async ({ text }) => {
        //  Phân tích sentiment
        const result = sentiment.analyze(text);
        console.log(`→ Sentiment analysis result: ${JSON.stringify(result)}`);

        // Đếm từ khóa stress/positive
        const stressKeywords = [
          'mất tiền','thua lỗ','liquidated','margin call','sập giá',
          'panic','sợ hãi','lo lắng','stress','áp lực','không ngủ được',
          'phá sản','nợ nần','gia đình','vay tiền','all in','buồn',
          'chán nản','khó khăn','khủng hoảng','đau đầu','tức giận',
          'khó chịu','bực bội','khó khăn tài chính','khủng ổn định',
          'khủng hoảng tâm lý','khủng hoảng cảm xúc','khủng hoảng đầu tư',
          'khủng hoảng thị trường','khủng hoảng tiền tệ'
        ];
        const positiveKeywords = [
          'lãi','profit','moon','to the moon','hold','hodl',
          'mua đáy','dca','long term','tin tưởng'
        ];

        const low = text.toLowerCase();
        const stressCount   = stressKeywords.filter(w => low.includes(w)).length;
        const positiveCount = positiveKeywords.filter(w => low.includes(w)).length;

        //  Tính adjusted score và phân loại
        let adjustedScore = result.score - stressCount * 2 + positiveCount;
        let emotionLevel;
        if (adjustedScore <= -3)       emotionLevel = 'very_negative';
        else if (adjustedScore <= -1)  emotionLevel = 'negative';
        else if (adjustedScore <= 1)   emotionLevel = 'neutral';
        else if (adjustedScore <= 3)   emotionLevel = 'positive';
        else                            emotionLevel = 'very_positive';

        const needsSupport = adjustedScore <= -2 || stressCount >= 2;

        // Trả kết quả chung, kèm prompt nếu cần support
        const base = {
          score: result.score,
          adjustedScore,
          comparative: result.comparative,
          emotionLevel,
          stressIndicators: stressCount,
          positiveIndicators: positiveCount,
          needsSupport
        };

        if (needsSupport) {
          return {
            ...base,
            confirmSupport: true,
            message_vi: "Mình hiểu điều này có thể khiến bạn thấy choáng ngợp.\n• Nếu bạn muốn, mình có thể kết nối bạn với đội ngũ hỗ trợ của Nami, hoặc chia sẻ một vài mẹo giúp bạn quản lý rủi ro tốt hơn. \n\n**Mình luôn ở đây để đồng hành cùng bạn!**",
            message_en: "I understand this can be overwhelming. If you want, I can connect you to Nami's support team, or share some tips to help you manage your risk better. I'm here to help you."
          };
        } else {
          return {
            ...base,
            confirmSupport: false
          };
        }
      },
    }),
  



];
return tools;
}
module.exports = buildTools;
