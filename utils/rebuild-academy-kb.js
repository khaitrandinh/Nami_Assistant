require('dotenv').config({ path: '../.env' });
const cheerio = require('cheerio');
const axios = require('axios');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { Pinecone } = require('@pinecone-database/pinecone');

const BASE_URL = 'https://academy.binance.com';
const LISTING_URL = `${BASE_URL}/vi/articles?difficulties=beginner`;
const MAX_PAGES = 3;

// Helper functions
const cleanText = text =>
  text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

const generateId = url =>
  url.replace(BASE_URL, '').replace(/[^a-zA-Z0-9]/g, '_');

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'text-embedding-004'
  });

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // khoảng 400–500 từ
    chunkOverlap: 100, // giữ ngữ cảnh giữa các chunk
  });

  const delay = ms => new Promise(r => setTimeout(r, ms));
  const articleUrls = new Set();

  // Crawl URL danh sách
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = `${LISTING_URL}&page=${page}`;
      console.log(`⏳ Fetching listing page ${page}: ${url}`);
      const { data } = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(data);
      let found = 0;
      $('a[href*="/vi/articles/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.includes('#') && !href.includes('?')) {
          const full = href.startsWith('http') ? href : BASE_URL + href;
          if (!articleUrls.has(full)) {
            articleUrls.add(full);
            found++;
          }
        }
      });
      console.log(`→ Found ${found} on page ${page}`);
      if (!found) break;
      await delay(1000);
    } catch (e) {
      console.error(`❌ Error page ${page}:`, e.message);
    }
  }

  console.log(`\n📊 Total URLs: ${articleUrls.size}\n`);

  // Xử lý từng bài
  for (const url of articleUrls) {
    try {
      const documentId = generateId(url);

      const { data: rawHtml } = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(rawHtml);

      const title = cleanText($('h1').first().text() || 'Untitled');
      const description = cleanText(
        $('meta[name="description"]').attr('content') || ''
      );
      const keywords = cleanText(
        $('meta[name="keywords"]').attr('content') || ''
      );

      let content = '';
      const selectors = [
        'article .content',
        'article p',
        '.article-content p',
        '.post-content p',
        '[class*="content"] p'
      ];
      for (const sel of selectors) {
        const ps = $(sel);
        if (ps.length) {
          content = ps
            .map((_, p) => cleanText($(p).text()))
            .get()
            .filter(t => t.length > 10)
            .join('\n\n');
          break;
        }
      }
      if (!content) {
        content = cleanText(
          $('article').text() || $('main').text() || $('body').text()
        );
      }

      // Chunk nội dung
      const chunks = await textSplitter.splitText(content);
      console.log(`→ Split into ${chunks.length} chunks`);

      // Upsert theo từng batch nhỏ
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const chunkBatch = chunks.slice(i, i + batchSize);
        const vectors = await embeddings.embedDocuments(chunkBatch);

        const upsertData = vectors.map((vector, idx) => ({
          id: `${documentId}_chunk${i + idx}`,
          values: vector,
          metadata: {
            source: url,
            title,
            description,
            keywords,
            text: chunkBatch[idx],
            chunkNumber: i + idx,
            chunkTotal: chunks.length,
            indexedAt: new Date().toISOString()
          }
        }));

        await index.namespace('binance-academy-vi').upsert(upsertData);
        console.log(`✅ Indexed batch ${Math.floor(i / batchSize) + 1}`);
        await delay(500); // hạn chế vượt quota
      }

      console.log(`🚀 Indexed article: ${title}`);
    } catch (err) {
      console.error(`❌ Error ${url}:`, err.message);
    }
    await delay(1200);
  }

  console.log(`\n🏁 Done indexing!`);
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
