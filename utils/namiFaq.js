require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const cheerio = require('cheerio');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { Pinecone } = require('@pinecone-database/pinecone');

const GHOST_API_URL =
  'https://blog.nami.exchange/ghost/api/v3/content/posts/' +
  '?key=bafd2bfa46387a4f2ce13c7ea0' +
  '&page=1&limit=200' +
  '&include=tags,primary_tag' +
  '&order=published_at%20DESC' +
  '&filter=tags:[faq,faq-vi-hop-tac-kinh-doanh,faq-en-business-cooperation,faq-vi-daily-staking,faq-en-daily-staking]';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'text-embedding-004',
});
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});

// Danh sách slug chính được chấp nhận
const ALLOWED_PRIMARY_SLUGS = [
  'faq-vi-huong-dan-chung',
  'faq-vi-chuc-nang-tai-khoan',
  'faq-vi-nap-rut-tien-ma-hoa',
  'faq-vi-giao-dich-spot',
  'faq-vi-giao-dich-futures',
  'faq-vi-quy-doi',
  'faq-vi-daily-staking',
  'faq-vi-token-nami',
  'faq-vi-hop-tac-kinh-doanh',
  'faq-en-tutorials',
  'faq-en-account-functions',
  'faq-en-crypto-deposit-withdrawal',
  'faq-en-spot-trading',
  'faq-en-futures-trading',
  'faq-en-swap',
  'faq-en-daily-staking',
  'faq-en-nami-token',
  'faq-en-business-cooperation'
];

// 🔧 Tối ưu 1: Batch processing và rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const BATCH_SIZE = 10; // Số posts xử lý cùng lúc
const EMBEDDING_BATCH_SIZE = 100; // Số texts embed cùng lúc
const UPSERT_BATCH_SIZE = 100; // Số vectors upsert cùng lúc

async function extractChunks(html) {
  const $ = cheerio.load(html || '');
  // 🔧 Tối ưu 2: Loại bỏ nhiều elements không cần thiết hơn
  $('script, style, nav, footer, aside, .kg-card-html, .kg-bookmark-card, .kg-gallery-card').remove();
  $('<!--kg-card-begin: html-->, <!--kg-card-end: html-->').remove();

  const rawSegments = [];
  let currentHeading = '';

  $('h1, h2, h3, h4, p, li').each((_, elem) => {
    const $elem = $(elem);
    const tag = elem.tagName.toLowerCase();
    const text = $elem.text().trim();
    if (!text || text.length < 10) return; // 🔧 Tối ưu 3: Bỏ qua text quá ngắn

    // Headers
    if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
      currentHeading = text;
      return;
    }

    // Strong paragraphs as headers (EN style)
    if (tag === 'p' && $elem.children('strong').length === 1 && text.length < 100) {
      currentHeading = text;
      return;
    }

    // Step detection với regex tối ưu hơn
    if (tag === 'p' || tag === 'li') {
      const stepMatch = text.match(/^(?:Bước|Step)\s*\d+\s*[:\.]/i);
      if (stepMatch) {
        rawSegments.push({
          text,
          heading: stepMatch[0],
          type: 'step'
        });
        return;
      }

      // 🔧 Tối ưu 4: Phân loại content type
      const isQuestion = text.includes('?') || /^(Câu hỏi|Question|Q\d+|Làm thế nào|How to)/i.test(text);

      rawSegments.push({
        text,
        heading: currentHeading,
        type: isQuestion ? 'question' : 'content'
      });
    }
  });

  // Text splitting với context preservation
  const finalSegments = [];
  for (const seg of rawSegments) {
    if (seg.text.length <= textSplitter.chunkSize) {
      finalSegments.push(seg);
    } else {
      const pieces = await textSplitter.splitText(seg.text);
      for (let i = 0; i < pieces.length; i++) {
        finalSegments.push({
          text: pieces[i],
          heading: seg.heading,
          type: seg.type,
          isPartial: pieces.length > 1,
          partIndex: i,
          partTotal: pieces.length
        });
      }
    }
  }

  return finalSegments;
}

function detectLangAndPrimarySlug(post) {
  // 1) Dùng primary_tag nếu hợp lệ
  let slug = post.primary_tag?.slug;
  if (!ALLOWED_PRIMARY_SLUGS.includes(slug)) {
    // 2) Nếu không, dò qua post.tags để tìm slug hợp lệ đầu tiên
    slug = post.tags.map(t => t.slug).find(s => ALLOWED_PRIMARY_SLUGS.includes(s));
  }
  // 3) Nếu vẫn không có, fallback
  if (!slug) slug = 'general';
  // 4) Xác định lang
  const lang = slug.startsWith('faq-en') ? 'en' : 'vi';
  return { lang, primarySlug: slug };
}

// 🔧 Tối ưu 5: Batch embedding function
async function embedInBatches(texts) {
  const allEmbeddings = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    console.log(`🔄 Embedding batch ${Math.floor(i/EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(texts.length/EMBEDDING_BATCH_SIZE)}`);
    try {
      const batchEmbeddings = await embeddings.embedDocuments(batch);
      allEmbeddings.push(...batchEmbeddings);
      if (i + EMBEDDING_BATCH_SIZE < texts.length) {
        await delay(1000);
      }
    } catch (error) {
      console.error(`❌ Embedding batch failed:`, error);
      await delay(5000);
      const retryEmbeddings = await embeddings.embedDocuments(batch);
      allEmbeddings.push(...retryEmbeddings);
    }
  }
  return allEmbeddings;
}

// 🔧 Tối ưu 6: Batch upsert function
async function upsertInBatches(index, namespace, vectors) {
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
    const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE);
    console.log(`📤 Upserting batch ${Math.floor(i/UPSERT_BATCH_SIZE) + 1}/${Math.ceil(vectors.length/UPSERT_BATCH_SIZE)}`);
    try {
      await index.namespace(namespace).upsert(batch);
      await delay(500);
    } catch (error) {
      console.error(`❌ Upsert batch failed:`, error);
      await delay(3000);
      await index.namespace(namespace).upsert(batch);
    }
  }
}

// 🔧 Tối ưu 7: Process posts in batches
async function processPostsBatch(posts, index) {
  const results = [];
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    console.log(`🔄 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(posts.length/BATCH_SIZE)}`);
    const batchPromises = batch.map(post => processSinglePost(post, index));
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    if (i + BATCH_SIZE < posts.length) {
      await delay(2000);
    }
  }
  return results;
}

async function processSinglePost(post, index) {
  try {
    const { lang, primarySlug } = detectLangAndPrimarySlug(post);
    const namespace = `nami-faq-${lang}-${primarySlug}`;

    const segments = await extractChunks(post.html);
    if (!segments.length) return { success: false, reason: 'No segments' };

    const texts    = segments.map(s => s.text);
    const chunkIds = texts.map((_, i) => `${post.slug}_chunk${i}`);

    // 🔧 Tối ưu 8: Parallel fetch và embedding
    const [fetchResult, vectorsValues] = await Promise.all([
      index.namespace(namespace).fetch(chunkIds),
      embedInBatches(texts)
    ]);
    console.log('Embedding dimension:', vectorsValues[0].length);
    const existingIds = fetchResult.vectors ? Object.keys(fetchResult.vectors) : [];

    const upsertData = [];
    for (let i = 0; i < texts.length; i++) {
      const id = chunkIds[i];
      const already = existingIds.includes(id);
      let shouldUpsert = !already;
      if (already) {
        const oldTime = new Date(fetchResult.vectors[id].metadata.published_at).getTime();
        const newTime = new Date(post.published_at).getTime();
        shouldUpsert = newTime > oldTime;
      }
      if (shouldUpsert) {
        upsertData.push({
          id,
          values: vectorsValues[i],
          metadata: {
            post_id:      post.id,
            title:        post.title,
            excerpt:      post.custom_excerpt || post.excerpt || '',
            slug:         post.slug,
            url:          `https://nami.exchange/${lang}/support/faq/${primarySlug.replace(/^faq-(vi|en)-/, '')}/${post.slug}`,
            published_at: post.published_at,
            tags:         post.tags.map(t => t.slug),
            primary_tag:  primarySlug,
            heading:      segments[i].heading || '',
            content_type: segments[i].type,
            chunkNumber:  i,
            chunkTotal:   texts.length,
            indexedAt:    new Date().toISOString(),
            lang,
            text_length:  texts[i].length,
            has_question: texts[i].includes('?'),
            is_partial:   segments[i].isPartial || false,
          },
        });
      }
    }

    if (upsertData.length > 0) {
      await upsertInBatches(index, namespace, upsertData);
      console.log(`✅ [${lang}/${primarySlug}] ${post.title}: upsert ${upsertData.length}/${texts.length}`);
    } else {
      console.log(`⏩ [${lang}/${primarySlug}] ${post.title}: no new chunks`);
    }

    return { success: true, upserted: upsertData.length, total: texts.length };

  } catch (error) {
    console.error(`❌ Error processing post ${post.slug}:`, error);
    return { success: false, error: error.message };
  }
}

async function namiFaq() {
  console.log('🚀 Starting FAQ crawl...');
  const startTime = Date.now();
  try {
    const { data } = await axios.get(GHOST_API_URL);
    const posts = data.posts || [];
    console.log(`📊 Found ${posts.length} posts to process`);

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    const results = await processPostsBatch(posts, index);

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
    const totalUpserted = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .reduce((sum, r) => sum + r.value.upserted, 0);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`
🏁 FAQ Crawl Complete!
⏱️  Duration: ${duration.toFixed(2)}s
📊 Posts processed: ${posts.length}
✅ Successful: ${successful}
❌ Failed: ${failed}
📤 Total chunks upserted: ${totalUpserted}
    `);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Graceful shutdown...');
  process.exit(0);
});

namiFaq().catch(console.error);

module.exports = namiFaq;
