const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { Chroma } = require("langchain/vectorstores/chroma");
const { RetrievalQAChain } = require("langchain/chains");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");

async function getAcademyRAG() {
    const vs = await Chroma.fromExistingIndex(
        new GoogleGenerativeAIEmbeddings(),
        { collectionName: "binance_academy" }
    );
    const retriever = vs.asRetriever();
    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash", temperature: 0.3 });
    return RetrievalQAChain.fromLLM(model, retriever);
}

module.exports = { getAcademyRAG };
