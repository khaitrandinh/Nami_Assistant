// rag-nami-faq.js
const { Pinecone } = require('@pinecone-database/pinecone');
const { PineconeStore } = require('@langchain/community/vectorstores/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function getNamiFaqRetriever(lang = 'vi') {
  const pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME);

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "text-embedding-004"
  });

  const vectorstore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    textKey: 'text',
    namespace: `nami-faq-${lang}`
  });

  return vectorstore.asRetriever({
    searchType: 'mmr',
    searchTypeOptions: { fetchK: 100, k: 10, lambda: 0.7 }
  });
}

module.exports = { getNamiFaqRetriever };
