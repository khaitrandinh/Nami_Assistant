
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const { PineconeStore } = require('@langchain/community/vectorstores/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

async function getAcademyRAG() {
  // Lấy index (lowercase)
  const pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME);

  // Tạo embeddings với API key
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "text-embedding-004"
  });

  // Build vectorstore từ index có sẵn
  const vectorstore = await PineconeStore.fromExistingIndex(
    embeddings, 
    { namespace: 'binance-academy-vi',
      pineconeIndex, 
      textKey: 'text' }
  );


  const retriever = vectorstore.asRetriever({
      searchType: 'mmr',
      searchTypeOptions: { 
        fetchK: 100,      // Tăng lên để có nhiều candidate hơn
        k: 50,           // Trả về 5 kết quả cuối cùng
        lambda: 0.7     // Balance giữa relevance và diversity (0.5 = cân bằng)
      }
    });
  // Trả về retriever để RAG
  return retriever;
}

module.exports = { getAcademyRAG };
