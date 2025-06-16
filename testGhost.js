const axios = require('axios');
require('dotenv').config();
const { convert } = require('html-to-text');

const NAMI_BLOG_API_BASE_URL = process.env.NAMI_BLOG_API_BASE_URL;
const NAMI_BLOG_API_KEY = process.env.NAMI_BLOG_API_KEY; 

let allNamiBlogPosts = []; // Cache để lưu tất cả bài đăng blog

// --- Hàm nội bộ để lấy tất cả bài đăng blog từ Nami ---
// Dựa vào hàm fetchAllPosts bạn cung cấp, sử dụng axios
async function fetchAllNamiBlogPosts() {
    if (allNamiBlogPosts.length > 0) {
        // Trả về cache nếu đã có dữ liệu và không quá cũ (có thể thêm logic TTL)
        // Ví dụ, không fetch lại trong X phút
        // return allNamiBlogPosts;
    }

    const perPage = 100; // max per request for Ghost API
    let page = 1;
    let posts = [];
    let totalPages = 1;

    try {
        do {
            const url = `${NAMI_BLOG_API_BASE_URL}/posts/?key=${NAMI_BLOG_API_KEY}&limit=${perPage}&page=${page}&include=tags&filter=visibility:public&order=published_at%20desc`;
            const response = await axios.get(url); // Dùng axios thay vì fetch
            const data = response.data; // Dữ liệu trực tiếp từ response.data

            posts = posts.concat(data.posts);
            totalPages = data.meta.pagination.pages;
            page += 1;
        } while (page <= totalPages);
        allNamiBlogPosts = posts; // Cập nhật cache
        return allNamiBlogPosts;
    } catch (error) {
        console.error(`Lỗi khi lấy tất cả bài đăng blog Nami:`, error.response?.data || error.message);
        throw new Error("Không thể lấy dữ liệu blog từ Nami.");
    }
}

// console.log(allNamiBlogPosts)

let webUrl = "https://nami.exchange/support/announcement"


async function get_nami_blog_posts(query_type = 'latest', keyword = '', lang = 'vi') {
    console.log(`Lấy tin tức Nami: type=${query_type}, keyword=${keyword}, lang=${lang}`);
    try {
        const allPosts = await fetchAllNamiBlogPosts();

        if (!allPosts || allPosts.length === 0) {
            return { error: `Không tìm thấy bài đăng blog nào từ Nami.` };
        }

        // Bước 1: Lọc bài đăng theo ngôn ngữ (chắc chắn khớp nhất)
        let langFilteredPosts = allPosts.filter(post => {
            const postTags = post.tags || [];
            const isEnglishPost = postTags.some(tag => tag.slug === 'en') || (post.primary_tag && post.primary_tag.slug.includes('-en-'));
            const isVietnamesePost = postTags.some(tag => tag.slug === 'vi') || (post.primary_tag && post.primary_tag.slug.includes('-vi-'));

            if (lang === 'en') {
                return isEnglishPost;
            } else if (lang === 'vi') {
                return isVietnamesePost;
            }
            return true; // Fallback: nếu không có tag ngôn ngữ rõ ràng, giữ lại
        });

        // Fallback: nếu không có bài nào khớp ngôn ngữ trực tiếp, thử các bài không có tag ngôn ngữ cụ thể
        if (langFilteredPosts.length === 0) {
            langFilteredPosts = allPosts.filter(post => {
                const postTags = post.tags || [];
                const hasExplicitLangTag = postTags.some(tag => tag.slug === 'en' || tag.slug === 'vi') || 
                                           (post.primary_tag && (post.primary_tag.slug.includes('-en-') || post.primary_tag.slug.includes('-vi-')));
                return !hasExplicitLangTag;
            });
            if (langFilteredPosts.length === 0) {
                langFilteredPosts = allPosts; // Cuối cùng, nếu vẫn không có, lấy tất cả
            }
        }
        
        let filteredPosts = [];

        // Bước 2: Lọc bài đăng theo query_type/chủ đề dựa trên SLUG TAGS
        if (query_type === 'latest' || query_type === 'news') {
            filteredPosts = langFilteredPosts.slice(0, 5); // Lấy 5 bài mới nhất sau khi lọc ngôn ngữ
        } else if (query_type === 'events') {
            const eventTagSlugs = ['event', 'events', 'campaign', 'campaigns', 'competition', 'giai-dau', 'su-kien', 'khuyen-mai'];
            filteredPosts = langFilteredPosts.filter(post => 
                (post.primary_tag && eventTagSlugs.some(slug => post.primary_tag.slug.includes(slug))) ||
                (post.tags && post.tags.some(tag => eventTagSlugs.some(slug => tag.slug.includes(slug))))
            ).slice(0, 3);
        } else if (query_type === 'new_listing') {
            const listingTagSlugs = ['new-cryptocurrency-listing', 'token-moi-niem-yet', 'listing', 'niem-yet'];
            filteredPosts = langFilteredPosts.filter(post => 
                (post.primary_tag && listingTagSlugs.some(slug => post.primary_tag.slug.includes(slug))) ||
                (post.tags && post.tags.some(tag => listingTagSlugs.some(slug => tag.slug.includes(slug))))
            ).slice(0, 3);
        } else if (query_type === 'delisting') {
            const delistingTagSlugs = ['delisting', 'huy-niem-yet', 'remove'];
            filteredPosts = langFilteredPosts.filter(post => 
                (post.primary_tag && delistingTagSlugs.some(slug => post.primary_tag.slug.includes(slug))) ||
                (post.tags && post.tags.some(tag => delistingTagSlugs.some(slug => tag.slug.includes(slug))))
            ).slice(0, 3);
        } else if (query_type === 'trending' || keyword) {
            // "Xu hướng" vẫn có thể dựa vào từ khóa hoặc mới nhất.
            // Nếu có từ khóa, tìm kiếm trong tiêu đề và custom_excerpt
            filteredPosts = langFilteredPosts.filter(post => 
                post.title.toLowerCase().includes(keyword.toLowerCase()) ||
                post.custom_excerpt?.toLowerCase().includes(keyword.toLowerCase()) ||
                (post.html && convert(post.html, { limits: { maxInputLength: 1000 } }).toLowerCase().includes(keyword.toLowerCase()))
            ).slice(0, 3);
        } else {
            // Fallback cuối cùng nếu không có query_type nào khớp
            filteredPosts = langFilteredPosts.slice(0, 3);
        }

        if (filteredPosts.length === 0) {
             return { error: `Không tìm thấy tin tức/bài đăng nào phù hợp với yêu cầu của bạn.` };
        }
        
        let formattedSummaries = [];
        for (const post of filteredPosts) {
            const finalUrl = post.url; 

            // Sử dụng custom_excerpt nếu có, nếu không thì tóm tắt từ html
            const rawSummary = post.custom_excerpt || convert(post.html, {
                wordwrap: 130,
                selectors: [{ selector: 'a', options: { ignoreHref: true } }]
            }).substring(0, 250);

            formattedSummaries.push({
                title: post.title,
                published_at: new Date(post.published_at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                summary_text: rawSummary + (rawSummary.length >= 250 ? '...' : ''),
                url: finalUrl
            });
        }
        
        // ... (phần tạo responseText và return giữ nguyên) ...
        let responseText = (lang === 'vi') ? `Dưới đây là một số cập nhật từ Nami Exchange:\n\n` : `Here are some updates from Nami Exchange:\n\n`;
        formattedSummaries.forEach((item, index) => {
            responseText += `${index + 1}. **${item.title}**\n`;
            responseText += `   ${(lang === 'vi') ? 'Xuất bản' : 'Published'}: ${item.published_at}\n`;
            responseText += `   ${(lang === 'vi') ? 'Tóm tắt' : 'Summary'}: ${item.summary_text}\n`;
            responseText += `   [${(lang === 'vi') ? 'Đọc thêm tại đây' : 'Read more here'}](${item.url})\n\n`;
        });
        
        return {
            source: "Nami Blog",
            summary: responseText,
            posts: formattedSummaries
        };

    } catch (error) {
        console.error(`Lỗi khi lấy tin tức/blog Nami (type: ${query_type}, keyword: ${keyword}, lang: ${lang}):`, error.response?.data || error.message);
        throw { error: `Không thể lấy tin tức/blog từ Nami lúc này. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.` };
    }
}


const availableFunctions = {
    get_nami_blog_posts,
    
};

module.exports = availableFunctions;