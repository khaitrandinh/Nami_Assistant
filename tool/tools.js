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
      }
    ]
  }
];

module.exports = tools;