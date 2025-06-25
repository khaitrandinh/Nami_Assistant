const axios = require("axios");
const { CheerioWebBaseLoader } = require("@langchain/community/document_loaders/web/cheerio");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
require("dotenv").config({path: "../.env"});

const cheerio = require("cheerio");

const ACADEMY_URL = "https://academy.binance.com/vi/articles?difficulties=beginner";

async function getArticleLinks() {
    const res = await axios.get(ACADEMY_URL);
    const $ = cheerio.load(res.data);
    const links = new Set();
    $("a[href^='/vi/articles/']").each((_, el) => {
        const href = $(el).attr("href");
        links.add("https://academy.binance.com" + href);
    });
    return Array.from(links);
}

(async () => {
    const urls = await getArticleLinks();
    console.log(`Found ${urls.length} beginner articles.`);
    
    const loaders = urls.map(url => new CheerioWebBaseLoader(url));
    const docs = (await Promise.all(loaders.map(l => l.load()))).flat();

    const embeddings = new GoogleGenerativeAIEmbeddings();

    const vectorStore = new Chroma({
    collectionName: "binance_academy",
    embeddingFunction: embeddings
    });

    await vectorStore.addDocuments(docs);


    console.log("✅ Knowledge base rebuilt:", await vectorStore.getCollectionMetadata());
})();
