// tools.js (có thể tinh chỉnh mô tả)
// import { Type } from '@google/genai';
const {Type, FunctionCallingConfigMode } = require('@google/genai')
const toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingConfigMode.ANY,
    allowedFunctionNames: ['get_nami_token_info','get_nami_blog_posts' ]
  }
};

const tools = [
  {
    function_declarations: [
      {
        name: "get_nami_token_info",
        description: "Truy xuất thông tin chi tiết và toàn diện về một token tiền điện tử từ Nami Exchange. Bao gồm mục đích sử dụng, công nghệ, giá hiện tại, vốn hóa thị trường, khối lượng giao dịch 24h, biến động giá, thông tin tokenomics (tổng cung, cung lưu hành), và các liên kết chính thức. **Sử dụng hàm này để trả lời bất kỳ câu hỏi nào về thông tin của một loại tiền điện tử cụ thể (ví dụ: BTC, ETH, SUI, AVAX, NAMI, NAO,...).**",
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
            month: { // THAM SỐ MỚI
                type: "integer",
                description: "Tháng của bài đăng (từ 1 đến 12). Sử dụng khi người dùng hỏi về thông tin trong một tháng cụ thể.",
                nullable: true
            },
            year: { // THAM SỐ MỚI
                type: "integer",
                description: "Năm của bài đăng (ví dụ: 2024, 2025). Sử dụng khi người dùng hỏi về thông tin trong một năm cụ thể.",
                nullable: true
            }
          }
        }
      }
    ]
  },
  
];
module.exports = tools;