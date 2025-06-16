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


async function get_nami_blog_posts(query_type = 'latest', keyword = '') {
    console.log(`Lấy tin tức Nami: type=${query_type}, keyword=${keyword}`);
    try {
        const allPosts = await fetchAllNamiBlogPosts();

        if (!allPosts || allPosts.length === 0) {
            return { error: `Không tìm thấy bài đăng blog nào từ Nami.` };
        }

        let langFilteredPosts = allPosts.filter(post => {
            const hasEnTag = post.tags.some(tag => tag.slug === 'en');
            const hasViTag = post.tags.some(tag => tag.slug === 'vi'); // Nếu bạn có tag 'vi'

            if (lang === 'en') {
                return hasEnTag || !hasViTag; // Ưu tiên bài có tag 'en', hoặc bài không có tag 'vi' (có thể là tiếng Anh mặc định)
            } else { // lang === 'vi'
                return hasViTag || !hasEnTag; // Ưu tiên bài có tag 'vi', hoặc bài không có tag 'en'
            }
        });

        if (langFilteredPosts.length === 0) {
            // Fallback: nếu không tìm thấy bài nào theo ngôn ngữ, trả về bài bất kỳ (ví dụ, bài tiếng Anh nếu hỏi tiếng Anh)
            langFilteredPosts = allPosts;
        }

        let filteredPosts = [];

        // Logic lọc dựa trên query_type và tiêu đề/tóm tắt/nội dung
        // Các loại từ ảnh: Tin tức (chung), Sự kiện, Mới niêm yết, Hủy niêm yết
        if (query_type === 'latest') {
            // "Tin tức" chung hoặc "Mới nhất" - lấy các bài đăng gần nhất
            filteredPosts = allPosts.slice(0, 5); // Lấy 5 bài mới nhất
        } else if (query_type === 'events') { // Từ "Sự kiện"
            const eventKeywords = ['event', 'events', 'sự kiện', 'competition', 'giải đấu', 'campaign', 'campaigns', 'khuyến mãi', 'promo', 'promos', 'ưu đãi'];
            filteredPosts = allPosts.filter(post => 
                eventKeywords.some(kw => post.title.toLowerCase().includes(kw)) ||
                eventKeywords.some(kw => post.custom_excerpt?.toLowerCase().includes(kw))
            ).slice(0, 3);
        } else if (query_type === 'new_listing') { // Từ "Mới niêm yết"
            const listingKeywords = ['list', 'listing', 'niêm yết', 'lists', 'new coin', 'mã mới'];
            filteredPosts = allPosts.filter(post => 
                listingKeywords.some(kw => post.title.toLowerCase().includes(kw)) ||
                listingKeywords.some(kw => post.custom_excerpt?.toLowerCase().includes(kw))
            ).slice(0, 3);
        } else if (query_type === 'delisting') { // Từ "Hủy niêm yết"
            const delistingKeywords = ['delist', 'delisting', 'hủy niêm yết', 'remove', 'gỡ bỏ'];
            filteredPosts = allPosts.filter(post => 
                delistingKeywords.some(kw => post.title.toLowerCase().includes(kw)) ||
                delistingKeywords.some(kw => post.custom_excerpt?.toLowerCase().includes(kw))
            ).slice(0, 3);
        } else if (keyword) {
            // Nếu có từ khóa, tìm kiếm trong tiêu đề và custom_excerpt của tất cả bài đăng
            filteredPosts = allPosts.filter(post => 
                post.title.toLowerCase().includes(keyword.toLowerCase()) ||
                post.custom_excerpt?.toLowerCase().includes(keyword.toLowerCase()) ||
                (post.html && convert(post.html, { limits: { maxInputLength: 1000 } }).toLowerCase().includes(keyword.toLowerCase())) // Giới hạn đọc HTML để tránh quá tải
            ).slice(0, 3);
        } else {
            filteredPosts = allPosts.slice(0, 3); // Mặc định là 3 bài mới nhất nếu không rõ loại và không có từ khóa
        }


        if (filteredPosts.length === 0) {
             return { error: `Không tìm thấy tin tức/bài đăng nào phù hợp với yêu cầu của bạn.` };
        }
        
        let formattedSummaries = [];
        for (const post of filteredPosts) {

            const tags = post.primary_tag.slug;
            const result = tags.split("-").slice(2).join("-");
            
            const url = `${webUrl}/${result}/${post.slug}` ;
            // console.log(url)

            // Lấy tóm tắt tùy chỉnh hoặc tạo từ nội dung HTML
            const rawSummary = post.custom_excerpt || convert(post.html, {
                wordwrap: 130,
                selectors: [{ selector: 'a', options: { ignoreHref: true } }]
            }).substring(0, 250); // Lấy tối đa 250 ký tự

            formattedSummaries.push({
                title: post.title,
                published_at: new Date(post.published_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' }),
                summary_text: rawSummary + (rawSummary.length >= 250 ? '...' : ''), // Đảm bảo có dấu ... nếu bị cắt
                url: url
            });
        }
        
        

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
        console.error(`Lỗi khi lấy tin tức/blog Nami (type: ${query_type}, keyword: ${keyword}):`, error.response?.data || error.message);
        throw { error: `Không thể lấy tin tức/blog từ Nami lúc này. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.` };
    }
}

const availableFunctions = {
    get_nami_blog_posts,
    
};

module.exports = availableFunctions;