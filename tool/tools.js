// tools.js (có thể tinh chỉnh mô tả)
// import { Type } from '@google/genai';
const {Type, FunctionCallingConfigMode } = require('@google/genai')
const toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingConfigMode.ANY,
    allowedFunctionNames: ['get_nami_token_info']
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
      // Các hàm khác nếu có (get_coingecko_token_details, get_nami_token_duration_change, v.v.)
      // Hãy đảm bảo mô tả của chúng cũng cực kỳ rõ ràng và ít chồng chéo nếu có thể.
      // Nếu bạn muốn ưu tiên Nami, bạn có thể tạm thời chỉ giữ lại get_nami_token_info để thử nghiệm.
    ]
  },
  {
        name: "get_nami_blog_posts",
        description: "Truy xuất các bài đăng blog, tin tức, thông báo, sự kiện, chiến dịch, khuyến mãi hoặc các cập nhật mới nhất từ blog chính thức của Nami Exchange. Sử dụng hàm này khi người dùng hỏi về xu hướng, các chiến dịch, khuyến mãi, sự kiện, bài đăng blog gần đây, hoặc tin tức mới nhất, niêm yết/hủy niêm yết token.",
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
            }
          }
        }
      },
];
module.exports = tools;