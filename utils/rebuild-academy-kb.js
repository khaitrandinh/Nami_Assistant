require('dotenv').config({ path: '../.env' });
const cheerio = require('cheerio');
const axios = require('axios');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { Pinecone } = require('@pinecone-database/pinecone');

const BASE_URL = 'https://academy.binance.com';
const LISTING_URL = `${BASE_URL}/vi/articles?difficulties=beginner`;
const MAX_PAGES = 3;

// helper
const cleanText = text =>
  text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

const generateId = url =>
  url.replace(BASE_URL, '').replace(/[^a-zA-Z0-9]/g, '_');

async function main() {
  // 1. Init Pinecone
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

  // 2. Init embeddings
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY
  });

  const delay = ms => new Promise(r => setTimeout(r, ms));
  const articleUrls = new Set();

  // 3. Crawl URL danh sách
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
  let success = 0, fail = 0;

  // 4. Xử lý từng bài
  for (const url of articleUrls) {
    try {
      const documentId = generateId(url);

      try {
        const fetchRes = await index.fetch({ ids: [documentId] });
        // Kiểm tra đúng cấu trúc response của Pinecone
        if (fetchRes.records && Object.keys(fetchRes.records).length > 0) {
          console.log(`↪️ Bỏ qua (đã có sẵn): ${url}`);
          continue;
        }
      } catch (fetchError) {
        // Nếu fetch lỗi, coi như chưa có và tiếp tục xử lý
        console.log(`→ Checking existence failed, proceeding: ${documentId}`);
      }
      console.log(`⏳ Processing: ${url}`);
      const { data: rawHtml } = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(rawHtml);

      // Title, description, keywords
      const title = cleanText($('h1').first().text() || 'Untitled');
      const description = cleanText(
        $('meta[name="description"]').attr('content') || ''
      );
      const keywords = cleanText(
        $('meta[name="keywords"]').attr('content') || ''
      );

      // Nội dung chính
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
      const MAX_SNIPPET = 3000;
      const snippet = content.slice(0, MAX_SNIPPET);
      // Tạo metadata
      const metadata = {
        source: url,
        title,
        description,
        keywords,
        snippet,                      // chỉ 3 000 ký tự đầu
        contentLength: content.length,
        indexedAt: new Date().toISOString()
      };

      console.log(`→ Extracted content length: ${content.length} characters`);

      // Dùng embedDocuments cho mảng 1 phần tử
      const [vector] = await embeddings.embedDocuments([content]);

      // Upsert
      await index.upsert([
        {
          id: generateId(url),
          values: vector,
          metadata
        }
      ]);

      console.log(`✅ Indexed: ${title}`);
      success++;
    } catch (err) {
      console.error(`❌ Error ${url}:`, err.message);
      fail++;
    }
    await delay(1200);
  }

  console.log(`\n🏁 Done! Success: ${success}, Fail: ${fail}`);
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
