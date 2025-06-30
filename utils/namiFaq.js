require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const cheerio = require('cheerio');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { Pinecone } = require('@pinecone-database/pinecone');
// const detectLanguage = require('./langDetect'); // Giả sử bạn có hàm detectLanguage trong utils/langDetect.js 
const GHOST_API_URL = "https://blog.nami.exchange/ghost/api/v3/content/posts/?key=bafd2bfa46387a4f2ce13c7ea0&page=1&limit=200&include=tags&order=published_at%20DESC&filter=tags:[faq, faq-vi-hop-tac-kinh-doanh,faq-en-business-cooperation,faq-vi-daily-staking,faq-en-daily-staking]";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'text-embedding-004'
});
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 });

function stripHtml(html) {
  const $ = cheerio.load(html || '');
  // Giữ heading, step... nếu muốn có thể custom thêm
  return $.text().replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}

function detectLangAndCategory(tags) {
  let lang = 'unknown', category_slug = null;
  for (const t of tags) {
    console.log(`Tag: ${t.slug}`);
    if (t.slug.startsWith('faq-vi')) lang = 'vi';
    if (t.slug.startsWith('faq-en')) lang = 'en';
    if (t.slug.startsWith('faq-vi-') || t.slug.startsWith('faq-en-')) category_slug = t.slug;
  }
  return { lang, category_slug };
}

async function namiFaq() {
  const { data } = await axios.get(GHOST_API_URL);
  const posts = data.posts || [];
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

  for (const post of posts) {
    const { lang, category_slug } = detectLangAndCategory(post.tags || []);
    const text = stripHtml(post.html || '');
    if (!text || text.length < 50) continue;

    const chunks = await textSplitter.splitText(text);

    // Tạo danh sách các id sẽ lưu (cho từng chunk)
    const chunkIds = chunks.map((_, i) => `${post.slug}_chunk${i}`);

    // Fetch các vector đã tồn tại
    const fetchResult = await index.namespace(`nami-faq-${lang}`).fetch(chunkIds);
    const existingIds = fetchResult?.vectors ? Object.keys(fetchResult.vectors) : [];

    // Chỉ lưu những chunk chưa tồn tại hoặc cần update (có thể check published_at hoặc indexedAt)
    const upsertData = [];
    const vectors = await embeddings.embedDocuments(chunks);
    for (let i = 0; i < chunks.length; i++) {
      const id = `${post.slug}_chunk${i}`;
      const already = existingIds.includes(id);
      let shouldUpsert = !already;

      // Nếu muốn update khi bài mới hơn:
      if (already && fetchResult.vectors[id]?.metadata?.published_at) {
        const oldTime = new Date(fetchResult.vectors[id].metadata.published_at).getTime();
        const newTime = new Date(post.published_at).getTime();
        shouldUpsert = newTime > oldTime;
      }

      if (shouldUpsert) {
        upsertData.push({
          id,
          values: vectors[i],
          metadata: {
            post_id: post.id,
            title: post.title,
            slug: post.slug,
            category_slug: category_slug || '',
            lang,
            url: `https://test.nami.exchange/${lang}/support/faq/${category_slug?.replace(/^faq-(vi|en)-/, '') || ''}/${post.slug}`,
            published_at: post.published_at,
            tags: post.tags.map(t => t.slug),
            excerpt: post.custom_excerpt || post.excerpt,
            text: chunks[i],
            chunkNumber: i,
            chunkTotal: chunks.length,
            indexedAt: new Date().toISOString()
          }
        });
      }
    }

    // Upsert nếu có vector mới/cần update
    if (upsertData.length > 0) {
      await index.namespace(`nami-faq-${lang}`).upsert(upsertData);
      console.log(`✅ [${lang}] ${post.title} (${upsertData.length}/${chunks.length} chunks upserted)`);
    } else {
      console.log(`⏩ Bỏ qua: ${post.title} (không có chunk mới cần lưu)`);
    }
  }
  console.log('🏁 Index xong FAQ Ghost API!');
}


main().catch(console.error);
module.exports = async function namiFaq() {
  // Code lấy/crawl/build của bạn ở đây.
  // Trả về chuỗi hoặc object
  return 'Rebuild OK!'; // Ví dụ trả về string đơn giản
};