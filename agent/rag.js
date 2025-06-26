
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
    apiKey: process.env.GOOGLE_API_KEY
  });

  // Build vectorstore từ index có sẵn
  const vectorstore = await PineconeStore.fromExistingIndex(
    embeddings,
    { pineconeIndex }
  );

  // Trả về retriever để RAG
  return vectorstore.asRetriever();
}

module.exports = { getAcademyRAG };
