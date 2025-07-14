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
const { getNamiFaqRetriever } = require("./rag_nami_faq");
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

async function buildTools() {
const binanceRag = await getAcademyRAG();

 const summarizationChain = loadSummarizationChain(
    new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 0.2,
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
            lang: z.enum(["vi", "en"]),
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
    // new DynamicStructuredTool({
    //     name: "get_nami_faq_guide",
    //     description: "Deep-search FAQs Nami Exchange (vi/en), trả về tóm tắt markdown + metadata. Dùng cho mọi câu hỏi kiến thức, thao tác, quy định trên Nami.",
    //     schema: z.object({
    //       query: z.string().describe("Câu hỏi về hướng dẫn, quy định, thao tác Nami Exchange (bất kỳ lĩnh vực nào)"),
    //       lang: z.enum(["vi", "en"]).default("vi")
    //     }),
    //     func: async ({ query, lang }) => {
    //       console.log(`→ Searching Nami FAQ for query: "${query}" (lang: ${lang})`);
    //       // Lấy chain tóm tắt
    //       const retriever = await getNamiFaqRetriever(lang);
    //       const docs = await retriever.getRelevantDocuments(query);

    //       if (!docs.length) {
    //         return {
    //           error: (lang === "vi")
    //             ? `Không tìm thấy nội dung phù hợp với “${query}”.`
    //             : `No relevant content found for “${query}”.`
    //         };
    //       }

    //       // Chain tóm tắt các chunk liên quan
    //       const summary = await summarizationChain.call({
    //         input_documents: docs,
    //         question: query
    //       });

    //       // Gom metadata bài
    //       const articles = [];
    //       const slugs = new Set();
    //       docs.forEach(doc => {
    //         const meta = doc.metadata || {};
    //         if (!slugs.has(meta.slug)) {
    //           articles.push({
    //             title: meta.title,
    //             url: meta.url,
    //             // slug: meta.slug,
    //             // category_slug: meta.category_slug,
    //             published_at: meta.published_at,
    //             excerpt: meta.excerpt,
    //             // tags: meta.tags,
    //           })
    //           // articles.splice(0, 3); 
    //           slugs.add(meta.slug);
    //         }
    //       });

    //       // Gom links để gợi ý đọc thêm
    //       const links = articles.map(a =>
    //         `• [${a.title}](${a.url})`
    //       ).join('\n');

    //       // Kết quả đầy đủ để dễ dùng cho cả chat và UI
    //       return {
    //         source: "Nami FAQ",
    //         summary: summary.text.trim(),
    //         // articles_count: articles.length,
    //         articles: articles,
    //         links_markdown: links
    //       };
    //     }
    //   }),
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


        // console.log(`→ Found ${docs.length} documents for query: "${query}"`);
        // console.log(`→ Documents: ${docs.map(d => d.metadata.snippet).join(', ')}`);
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
            `\n*${d.metadata.description || 'Không có mô tả'}*`
        ).join('\n');

        return `${summary.text.trim()}\n\n🔗 Đọc chi tiết:\n${links}`;
      }
    }),

    // Công cụ hỗ trợ cảm xúc
    new DynamicStructuredTool({
      name: "emotion_support",
      description: "Phát hiện sắc thái cảm xúc, đánh giá mức độ stress/lo lắng và trả về prompt hỗ trợ phù hợp",
      schema: z.object({
        text: z.string().describe("Nội dung người dùng nhập"),
        previousEmotion: z.string().optional().nullable().describe("Cảm xúc trước đó nếu có")
      }),
      func: async ({ text, previousEmotion }) => {
        // Phân tích sentiment cơ bản (giữ nguyên nhưng nhớ rằng ít hiệu quả với tiếng Việt)
        const result = sentiment.analyze(text);
        console.log(`→ Sentiment analysis result: ${JSON.stringify(result)}`);

        // Từ khóa stress/negative - mở rộng
        const stressKeywords = [
          // Tài chính/Trading
          'mất tiền', 'thua lỗ', 'liquidated', 'margin call', 'sập giá',
          'cháy tài khoản', 'cut loss', 'stop loss', 'về 0', 'sập hầm',
          'fomo', 'long cháy', 'short cháy', 'bị hunt', 'pump dump', 'rug pull',
          'scam', 'hack', 'mất ví', 'quên seed phrase', 'bị lừa',

          // Cảm xúc tiêu cực
          'panic', 'sợ hãi', 'lo lắng', 'stress', 'áp lực', 'không ngủ được',
          'phá sản', 'nợ nần', 'buồn', 'chán nản', 'tức giận', 'khó chịu', 'bực bội',
          'xóa app', 'bỏ cuộc', 'thất vọng', 'tuyệt vọng', 'khủng hoảng',

          // Kỹ thuật/Lỗi
          'không rút được', 'pending mãi', 'lỗi hệ thống', 'stuck', 'freeze',
          'không load được', 'mất kết nối', 'server lỗi', 'lag', 'không load', 'không đặt lệnh được',

          // Tình huống khẩn cấp
          'gia đình', 'vay tiền', 'all in', 'cần gấp', 'khó khăn tài chính',
          'không có tiền', 'cần tiền', 'phải bán', 'ép buộc'
        ];

        // Từ khóa positive - mở rộng
        const positiveKeywords = [
          // Lợi nhuận
          'lãi', 'profit', 'lãi to', 'x2', 'x5', 'x10', 'về bờ', 'recovered',
          'moon', 'to the moon', 'pump', 'tăng mạnh', 'break out', 'ath',
          'all time high', 'bull run', 'golden cross',

          // Tâm lý tích cực
          'hold', 'hodl', 'mua đáy', 'dca', 'long term', 'tin tưởng',
          'kiên nhẫn', 'bình tĩnh', 'tự tin', 'lạc quan', 'vui', 'hạnh phúc',
          'thành công', 'may mắn', 'tuyệt vời', 'xuất sắc'
        ];

        // Từ khóa ngữ cảnh giao dịch
        const tradingContext = {
          technical_issue: ['không rút được', 'lỗi', 'pending', 'stuck', 'freeze', 'server', 'lag', 'không load', 'mất kết nối', 'không đặt lệnh được'],
          market_concern: ['sập giá', 'dump', 'crash', 'bear market', 'điều chỉnh'],
          profit_loss: ['lãi', 'lỗ', 'profit', 'loss', 'pnl', 'roi'],
          beginner: ['mới', 'không biết', 'chưa hiểu', 'lần đầu', 'newbie'],
          crisis: ['phá sản', 'nợ nần', 'gia đình', 'vay tiền', 'all in', 'cần gấp'] 
        };

        // Phân tích từ khóa
        const low = text.toLowerCase();
        const stressCount = stressKeywords.filter(w => low.includes(w)).length;
        const positiveCount = positiveKeywords.filter(w => low.includes(w)).length;

        // Phát hiện ngữ cảnh
        const contexts = {};
        Object.keys(tradingContext).forEach(context => {
          contexts[context] = tradingContext[context].some(w => low.includes(w));
        });

        // Tính adjusted score với trọng số
        let adjustedScore = result.score;
        adjustedScore -= stressCount * 2;
        adjustedScore += positiveCount * 1.5;

        // Trọng số đặc biệt cho crisis
        // Giữ nguyên trọng số này để crisis vẫn là mức độ nghiêm trọng nhất
        if (contexts.crisis) adjustedScore -= 3; 
        // Giảm nhẹ trọng số technical_issue nếu nó không phải crisis tài chính/cá nhân
        // Để nó vẫn là tiêu cực nhưng ít hơn crisis thực sự
        if (contexts.technical_issue) adjustedScore -= 1.5; // Giảm trọng số từ 1 xuống 1.5 để nó không bị đẩy quá sâu

        // Phân loại emotion level - ĐIỀU CHỈNH NGƯỠNG ĐỂ PHÂN BIỆT RÕ HƠN
        let emotionLevel;
        // Điều chỉnh ngưỡng crisis để chỉ những trường hợp cực kỳ tiêu cực (có thể liên quan đến crisisKeywords) mới là 'crisis'
        // Ví dụ: chỉ khi adjustedScore <= -6 HOẶC có crisisKeywords rõ ràng
        if (contexts.crisis && adjustedScore <= -4) emotionLevel = 'crisis'; // Nếu có từ khóa crisis VÀ điểm rất thấp
        else if (adjustedScore <= -4) emotionLevel = 'very_negative_severe'; // Mức độ tiêu cực rất cao nhưng không phải crisis tài chính/cá nhân
        else if (adjustedScore <= -3) emotionLevel = 'very_negative';
        else if (adjustedScore <= -1) emotionLevel = 'negative';
        else if (adjustedScore <= 1) emotionLevel = 'neutral';
        else if (adjustedScore <= 3) emotionLevel = 'positive';
        else emotionLevel = 'very_positive';

        // Đánh giá độ tin cậy
        const confidence = {
          level: stressCount >= 2 || positiveCount >= 2 ? 'high' : 
                stressCount === 1 || positiveCount === 1 ? 'medium' : 'low',
          score: Math.min(1, (stressCount + positiveCount) / 3)
        };

        // Xác định nhu cầu hỗ trợ
        // needsImmediateSupport giờ cần xem xét kỹ hơn để không bị kích hoạt quá mức cho lỗi kỹ thuật
        const needsSupport = adjustedScore <= -2 || stressCount >= 2 || contexts.crisis || contexts.technical_issue; // Vẫn cần hỗ trợ nếu là lỗi kỹ thuật
        const needsImmediateSupport = emotionLevel === 'crisis' || (emotionLevel === 'very_negative_severe' && contexts.technical_issue); // Chỉ 'crisis' hoặc lỗi kỹ thuật cực nặng

        // Phân tích xu hướng (nếu có emotion trước đó)
        let emotionTrend = null;
        if (previousEmotion) {
          const trends = {
            'crisis': 5, 'very_negative_severe': 4.5, 'very_negative': 4, 'negative': 3, 
            'neutral': 2, 'positive': 1, 'very_positive': 0
          };
          const currentLevel = trends[emotionLevel] || 2;
          const previousLevel = trends[previousEmotion] || 2;
          
          if (currentLevel > previousLevel) emotionTrend = 'deteriorating';
          else if (currentLevel < previousLevel) emotionTrend = 'improving';
          else emotionTrend = 'stable';
        }

        // Tạo action recommendations 
        const getActionRecommendations = (level, contexts) => {
          const actions = {
            crisis: ['connect_cs_urgent', 'pause_trading', 'seek_professional_help'],
            very_negative_severe: contexts.technical_issue ? 
              ['troubleshoot', 'connect_cs_urgent', 'escalate_technical'] : 
              ['connect_cs', 'emotional_support', 'risk_management_tips'], 
            very_negative: ['connect_cs', 'pause_trading', 'emotional_support'],
            negative: contexts.technical_issue ? 
              ['troubleshoot', 'connect_cs', 'provide_guide'] : 
              ['emotional_support', 'risk_management_tips', 'market_education'],
            neutral: ['provide_info', 'ask_clarification'],
            positive: ['continue_conversation', 'provide_advanced_tips'],
            very_positive: ['celebrate', 'provide_advanced_tips', 'share_success']
          };
          
          return actions[level] || actions['neutral'];
        };

        // Kết quả trả về
        const base = {
          // Sentiment analysis
          sentiment: {
            score: result.score,
            adjustedScore,
            comparative: result.comparative,
            confidence
          },
          
          // Emotion classification
          emotion: {
            level: emotionLevel,
            trend: emotionTrend,
            needsSupport,
            needsImmediateSupport
          },
          
          // Context analysis
          context: {
            indicators: {
              stress: stressCount,
              positive: positiveCount
            },
            trading: contexts,
            keywords: {
              stress: stressKeywords.filter(w => low.includes(w)),
              positive: positiveKeywords.filter(w => low.includes(w))
            }
          },
          
          // Recommendations
          recommendations: {
            actions: getActionRecommendations(emotionLevel, contexts),
            priority: needsImmediateSupport ? 'urgent' : needsSupport ? 'high' : 'normal'
          }
        };

        // Trả về response với message nếu cần support
        if (needsSupport) {
          // Điều chỉnh nút hành động dựa trên needsImmediateSupport và context
          let supportActions = [];
          if (needsImmediateSupport) {
            // Hành động khẩn cấp cho crisis hoặc lỗi kỹ thuật cực nặng
            supportActions = [
              { type: 'connect_cs_urgent', label_vi: 'Kết nối hỗ trợ khẩn cấp', label_en: 'Connect urgent support' },
              { type: 'pause_trading', label_vi: 'Tạm dừng giao dịch', label_en: 'Pause trading' }
            ];
            // Nếu là lỗi kỹ thuật rất nặng, có thể thêm nút hướng dẫn kỹ thuật khẩn cấp
            if (contexts.technical_issue) {
                supportActions.push({ type: 'troubleshoot_urgent', label_vi: 'Hướng dẫn khắc phục khẩn cấp', label_en: 'Urgent troubleshooting' });
            }
          } else if (contexts.technical_issue) { // Lỗi kỹ thuật nhưng không quá khẩn cấp đến mức 'crisis'
            supportActions = [
              { type: 'troubleshoot', label_vi: 'Hướng dẫn khắc phục', label_en: 'Troubleshoot guide' },
              { type: 'connect_cs', label_vi: 'Kết nối hỗ trợ kỹ thuật', label_en: 'Connect technical support' },
              { type: 'provide_guide', label_vi: 'Xem hướng dẫn chi tiết', label_en: 'View detailed guide' }
            ];
          } else { // Các trường hợp cần support khác không phải kỹ thuật
            supportActions = [
              { type: 'connect_cs', label_vi: 'Kết nối hỗ trợ', label_en: 'Connect support' },
              { type: 'get_tips', label_vi: 'Nhận mẹo hữu ích', label_en: 'Get helpful tips' },
              { type: 'continue', label_vi: 'Tiếp tục trò chuyện', label_en: 'Continue chat' }
            ];
          }

          return {
            ...base,
            support: {
              required: true,
              immediate: needsImmediateSupport,           
              // Buttons/Actions cho UI
              actions: supportActions
            }
          };
        } else {
          return {
            ...base,
            support: {
              required: false,
            }
          };
        }
      },
    }),
  



];
return tools;
}
module.exports = buildTools;
