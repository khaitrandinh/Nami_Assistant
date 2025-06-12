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
  }
];
module.exports = tools;