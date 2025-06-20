// tools.js (có thể tinh chỉnh mô tả)
// // import { Type } from '@google/genai';
// const {Type, FunctionCallingConfigMode } = require('@google/genai')
// const toolConfig = {
//   functionCallingConfig: {
//     mode: FunctionCallingConfigMode.ANY,
//     allowedFunctionNames: ['get_nami_token_info','get_nami_blog_posts' ]
//   }
// };

const tools = [
  {
    function_declarations: [
      {
        name: "get_nami_token_info",
        description: "Truy xuất THÔNG TIN TOÀN DIỆT và CHI TIẾT về BẤT KỲ TOKEN tiền điện tử nào (ví dụ: Bitcoin, Ethereum, SUI, AVAX, NAMI) từ Nami Exchange. Thông tin bao gồm: mục đích sử dụng, công nghệ, giá hiện tại, vốn hóa thị trường, khối lượng giao dịch 24h, biến động giá, thông tin tokenomics (tổng cung, cung lưu hành, cung tối đa), và các liên kết chính thức. **Bạn PHẢI sử dụng hàm này để trả lời bất kỳ câu hỏi nào về thông tin của một loại tiền điện tử cụ thể (ví dụ: BTC, ETH, SUI, AVAX, NAMI, NAO,...).**",
        parameters: {
          type: "OBJECT",
          properties: {
            token_symbol: {
              type: "STRING",
              description: "Mã ký hiệu của token tiền điện tử (ví dụ: BTC, ETH, SUI, AVAX)."
            }
          },
          required: ["token_symbol"]
        }
      },
      {
        name: "get_nami_blog_posts",
        description: "Truy xuất các bài đăng blog, tin tức, thông báo, sự kiện, chiến dịch, khuyến mãi hoặc các cập nhật từ blog chính thức của Nami Exchange. Sử dụng hàm này khi người dùng hỏi về xu hướng, các chiến dịch, khuyến mãi, sự kiện, bài đăng blog gần đây, tin tức mới nhất, niêm yết/hủy niêm yết token, hoặc các bài đăng trong một khoảng thời gian/tháng cụ thể.",
        parameters: {
          type: "OBJECT",
          properties: {
            query_type: {
              type: "STRING",
              description: "Loại thông tin blog/tin tức mà người dùng muốn tìm. Có thể là 'latest' (mới nhất), 'events' (sự kiện, giải đấu, chiến dịch, khuyến mãi), 'new_listing' (niêm yết token mới), 'delisting' (hủy niêm yết token), 'trending' (xu hướng/hot topic), hoặc 'news' (tin tức chung). Mặc định là 'latest' nếu không rõ.",
              enum: ["latest", "events", "new_listing", "delisting", "trending", "news"]
            },
            keyword: {
                type: "STRING",
                description: "Từ khóa liên quan nếu người dùng hỏi về một chủ đề cụ thể trong blog (ví dụ: 'NAO futures', 'DCA auto-invest', 'Defi App', 'vBTC').",
                nullable: true
            },
            month: {
                type: "integer",
                description: "Tháng của bài đăng (từ 1 đến 12). CỰC KỲ QUAN TRỌNG: LUÔN LUÔN TRÍCH XUẤT THÁNG nếu người dùng hỏi về một tháng cụ thể (ví dụ: tháng 5, tháng 10, tháng Bảy).",
                nullable: true
            },
            year: {
                type: "integer",
                description: "Năm của bài đăng (ví dụ: 2024, 2025). CỰC KỲ QUAN TRỌNG: LUÔN LUÔN TRÍCH XUẤT NĂM nếu người dùng hỏi về một năm cụ thể.",
                nullable: true
            }
          }
        }
      },
      { // CẬP NHẬT get_user_portfolio_performance
        name: "get_user_portfolio_performance",
        description: `Lấy thông tin tổng quan và hiệu suất của danh mục đầu tư (portfolio) của người dùng trên Nami Exchange. Bao gồm số lượng tài sản nắm giữ, giá trị hiện tại, lợi nhuận/thua lỗ (PnL) theo tỷ lệ phần trăm, tỷ lệ phân bổ các token, và hiệu suất 24h của các tài sản chính. **Bạn PHẢI sử dụng hàm này khi người dùng hỏi về 'portfolio của tôi', 'danh mục đầu tư của tôi', 'tài sản của tôi', 'tôi đã lời/lỗ bao nhiêu', 'xu hướng đầu tư', 'hiệu suất theo ngày', hoặc chỉ định đồng tiền cơ sở (ví dụ: bằng USDT, bằng VNST).**
                      Và Hàm này sẽ trả về theo đúng ngôn ngữ mà người dùng hỏi, bạn phải sử dụng ngôn ngữ mà hàm này trả về để trả lời người dùng`,
        parameters: {
          type: "OBJECT",
          properties: {
            name_currency: { // ĐỔI TÊN THAM SỐ VÀ TYPE THÀNH STRING
              type: "STRING",
              description: "Tên của đồng tiền cơ sở để tính toán giá trị portfolio (ví dụ: 'VNST' hoặc 'USDT'). Mặc định là 'VNST' nếu người dùng không chỉ định.",
              enum: ["VNST", "USDT"], // Các giá trị chuỗi
              default: "VNST"
            }
          }
        }
      },
      {
        name: "create_nami_alert",
        description: "Tạo một cảnh báo (alert) giá hoặc biến động trên Nami Exchange và đăng ký vào hệ thống thông báo. Bạn có thể đặt cảnh báo khi giá đạt ngưỡng, tăng/giảm một lượng nhất định, hoặc thay đổi phần trăm trong một khoảng thời gian. **Bạn PHẢI sử dụng hàm này khi người dùng muốn 'thông báo', 'nhắc nhở', 'cảnh báo', 'báo cho tôi biết' về giá hoặc biến động của token.** Sau khi tạo cảnh báo, hàm này sẽ tự động kiểm tra cài đặt thông báo của người dùng và sẽ đưa ra gợi ý bật thông báo nếu chúng đang tắt. Nếu công cụ trả về cờ `ask_to_enable_notifications: true`, bạn PHẢI hỏi người dùng \"Bạn có muốn tôi bật cả thông báo trên thiết bị và qua email không?\". Nếu người dùng đồng ý bật, hãy sử dụng công cụ `update_nami_notification_setting` để bật các cài đặt đó.",
        parameters: {
          type: "OBJECT",
          properties: {
            alert_type: {
              type: "STRING",
              description: "Loại cảnh báo cần tạo. Ví dụ: 'REACH_PRICE' (giá đạt đến), 'PRICE_RISES_ABOVE' (giá tăng lên trên), 'PRICE_DROPS_TO' (giá giảm xuống dưới), 'CHANGE_IS_OVER' (giá tăng trên một ngưỡng), 'CHANGE_IS_UNDER' (giá giảm dưới một ngưỡng), 'DAY_CHANGE_IS_OVER' (biến động 24h tăng trên), 'DAY_CHANGE_IS_DOWN' (biến động 24h giảm xuống), 'DURATION_CHANGE_IS_OVER' (biến động trong X giờ tăng trên), 'DURATION_CHANGE_IS_UNDER' (biến động trong X giờ giảm xuống), 'DURATION_CHANGE' (biến động trong X giờ tăng hoặc giảm).",
              enum: ["REACH_PRICE", "PRICE_RISES_ABOVE", "PRICE_DROPS_TO", "CHANGE_IS_OVER", "CHANGE_IS_UNDER", "DAY_CHANGE_IS_OVER", "DAY_CHANGE_IS_DOWN", "DURATION_CHANGE_IS_OVER", "DURATION_CHANGE_IS_UNDER", "DURATION_CHANGE"]
            },
            base_assets: {
              type: "array",
              items: { type: "STRING" },
              description: "Một hoặc nhiều mã ký hiệu của tài sản tiền điện tử chính (ví dụ: ['BTC'], ['ETH', 'USDT'])."
            },
            quote_asset: {
              type: "STRING",
              description: "Đồng tiền báo giá của cặp giao dịch (ví dụ: 'USDT', 'VNST'). Mặc định là 'USDT' nếu không đề cập.",
              enum: ["USDT", "VNST"],
              default: "USDT"
            },
            product_type: {
              type: "STRING",
              description: "Loại sản phẩm áp dụng cảnh báo (ví dụ: 'SPOT', 'NAMI_FUTURES', 'NAO_FUTURES'). Mặc định là 'SPOT' nếu không rõ.",
              enum: ["NAMI_FUTURES", "SPOT", "NAO_FUTURES"],
              default: "SPOT"
            },
            value: {
              type: "string",
              description: "Giá trị ngưỡng để kích hoạt cảnh báo. Bắt buộc cho các loại cảnh báo giá (REACH_PRICE, PRICE_RISES_ABOVE, PRICE_DROPS_TO). Ví dụ: '90000' hoặc '0.05'. KHÔNG bắt buộc cho các loại percentage_change.",
              nullable: true
            },
            percentage_change: {
              type: "number",
              description: "Phần trăm biến động (dạng số nguyên, ví dụ: 5 cho 5%). Bắt buộc cho CHANGE_IS_OVER, CHANGE_IS_UNDER, DURATION_CHANGE_IS_OVER, DURATION_CHANGE_IS_UNDER, DURATION_CHANGE. KHÔNG sử dụng cho cảnh báo giá cố định.",
              nullable: true
            },
             interval: {
              type: "STRING",
              description: "Khoảng thời gian (tính bằng giờ, ví dụ: 1, 4, 8, 12, 24) cho các loại cảnh báo DURATION_CHANGE, CHANGE_IS_OVER, CHANGE_IS_UNDER. Bắt buộc cho DURATION_CHANGE_IS_OVER, DURATION_CHANGE_IS_UNDER, DURATION_CHANGE, CHANGE_IS_OVER, CHANGE_IS_UNDER.",
              enum: ["1", "4", "8", "12", "24"],
              nullable: true
            },
            frequency: {
              type: "STRING",
              description: "Tần suất cảnh báo sẽ được gửi: 'ONLY_ONCE' (chỉ 1 lần), 'ONCE_A_DAY' (1 lần/ngày), 'ALWAYS' (luôn luôn khi điều kiện đúng). Mặc định là 'ONLY_ONCE'.",
              enum: ["ALWAYS", "ONLY_ONCE", "ONCE_A_DAY"],
              default: "ONLY_ONCE"
            }
          },
          required: ["alert_type", "base_assets", "quote_asset", "product_type"]
        }
      },
      {
        name: "update_nami_notification_setting",
        description: "Cập nhật cài đặt thông báo của người dùng. Cho phép bật hoặc tắt thông báo trên thiết bị (push notification) và thông báo qua email. Sử dụng hàm này khi người dùng muốn 'bật thông báo', 'tắt thông báo', 'nhận thông báo qua email', 'nhận thông báo trên điện thoại'.",
        parameters: {
          type: "OBJECT",
          properties: {
            useDeviceNoti: {
              type: "boolean",
              description: "Đặt true để bật thông báo trên thiết bị, false để tắt. Bắt buộc."
            },
            useEmailNoti: {
              type: "boolean",
              description: "Đặt true để bật thông báo qua email, false để tắt. Bắt buộc."
            }
          },
          required: ["useDeviceNoti", "useEmailNoti"]
        }
      }
    ]
  }
];

module.exports = tools;