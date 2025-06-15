const axios = require('axios');
require('dotenv').config();
const { convert } = require('html-to-text');

const NAMI_BLOG_API_BASE_URL = process.env.NAMI_BLOG_API_BASE_URL;
const NAMI_BLOG_API_KEY = process.env.NAMI_BLOG_API_KEY; 

// let namiAssetIdMap = {};
// let allNamiBlogPosts = []; 

// // const siteUrl = 'https://blog.nami.exchange';
// // const contentApiKey = 'bafd2bfa46387a4f2ce13c7ea0';
// // async function fetchAllPosts() {
// //   const perPage = 100; // max per request
// //   let page = 1;
// //   let allPosts = [];
// //   let totalPages = 1;
// //   do {
// //     const url = `${siteUrl}/ghost/api/content/posts/?key=${contentApiKey}&limit=${perPage}&page=${page}&filter=visibility:public`;
// //     const response = await fetch(url);
// //     const data = await response.json();
// //     allPosts = allPosts.concat(data.posts);
// //     totalPages = data.meta.pagination.pages;
// //     page += 1;
// //   } while (page <= totalPages);
// //   return allPosts;
// // }
// // fetchAllPosts()
// //   .then(posts => {
// //     console.log(`Fetched ${posts.length} published posts.`);
// //     // console.log(posts);
// //   })
// //   .catch(error => {
// //     console.error('Error fetching posts:', error);
// //   });


// async function fetchAllNamiBlogPosts() {
//     if (allNamiBlogPosts.length > 0) {
//         // Trả về cache nếu đã có dữ liệu và không quá cũ (có thể thêm logic TTL)
//         // Ví dụ, không fetch lại trong X phút
//         // return allNamiBlogPosts;
//     }

//     const perPage = 100; // max per request for Ghost API
//     let page = 1;
//     let posts = [];
//     let totalPages = 1;

//     try {
//         do {
//             const url = `${NAMI_BLOG_API_BASE_URL}/posts/?key=${NAMI_BLOG_API_KEY}&limit=${perPage}&page=${page}&filter=visibility:public&order=published_at%20desc`;
//             const response = await axios.get(url); // Dùng axios thay vì fetch
//             const data = response.data; // Dữ liệu trực tiếp từ response.data

//             posts = posts.concat(data.posts);
//             totalPages = data.meta.pagination.pages;
//             page += 1;
//         } while (page <= totalPages);
//         allNamiBlogPosts = posts; // Cập nhật cache
//         return allNamiBlogPosts;
//     } catch (error) {
//         console.error(`Lỗi khi lấy tất cả bài đăng blog Nami:`, error.response?.data || error.message);
//         throw new Error("Không thể lấy dữ liệu blog từ Nami.");
//     }
// }
// console.log("Tittle" , fetchAllNamiBlogPosts())

// async function get_nami_blog_posts(query_type = 'latest', keyword = '') {
//     console.log(`Lấy tin tức Nami: type=${query_type}, keyword=${keyword}`);
//     try {
//         const allPosts = await fetchAllNamiBlogPosts();

//         if (!allPosts || allPosts.length === 0) {
//             return { error: `Không tìm thấy bài đăng blog nào từ Nami.` };
//         }

//         let relevantPosts = [];

//         if (query_type === 'latest') {
//             relevantPosts = allPosts.slice(0, 3); // Lấy 3 bài mới nhất
//         } else if (query_type === 'campaigns' || query_type === 'promos') {
//             // Lọc bài đăng có từ khóa liên quan đến chiến dịch/khuyến mãi
//             const campaignKeywords = ['campaign', 'promo', 'offer', 'khuyến mãi', 'ưu đãi', 'giải đấu', 'sự kiện'];
//             relevantPosts = allPosts.filter(post => 
//                 campaignKeywords.some(keyword => post.title.toLowerCase().includes(keyword)) ||
//                 campaignKeywords.some(keyword => post.custom_excerpt?.toLowerCase().includes(keyword)) ||
//                 campaignKeywords.some(keyword => (post.html && convert(post.html, { limits: { maxInputLength: 1000 } }).toLowerCase().includes(keyword))) // Chỉ kiểm tra một phần nhỏ của HTML
//             ).slice(0, 3); // Lấy 3 bài liên quan nhất
//         } else if (query_type === 'trending' || query_type === 'hot_topic' || keyword) {
//             // "Xu hướng" có thể khó định nghĩa từ API đơn thuần.
//             // Có thể là bài đăng gần đây có nhiều tương tác (nếu API hỗ trợ),
//             // hoặc đơn giản là các bài đăng mới nhất hoặc chứa từ khóa.
//             // Ở đây, chúng ta sẽ xem xét các bài gần nhất có từ khóa hoặc là các bài mới nhất.
//             if (keyword) {
//                 relevantPosts = allPosts.filter(post => 
//                     post.title.toLowerCase().includes(keyword.toLowerCase()) ||
//                     post.custom_excerpt?.toLowerCase().includes(keyword.toLowerCase()) ||
//                     (post.html && convert(post.html, { limits: { maxInputLength: 1000 } }).toLowerCase().includes(keyword.toLowerCase()))
//                 ).slice(0, 3);
//             } else {
//                 relevantPosts = allPosts.slice(0, 3); // Mặc định là mới nhất nếu không có từ khóa cụ thể
//             }
//         } else {
//             relevantPosts = allPosts.slice(0, 1); // Mặc định 1 bài mới nhất nếu không rõ loại
//         }

//         if (relevantPosts.length === 0) {
//              return { error: `Không tìm thấy tin tức/bài đăng nào phù hợp với yêu cầu của bạn.` };
//         }

//         let formattedSummaries = [];
//         for (const post of relevantPosts) {
//             const textContent = convert(post.html, {
//                 wordwrap: 130,
//                 selectors: [{ selector: 'a', options: { ignoreHref: true } }]
//             });
//             const summary = post.custom_excerpt || textContent.substring(0, 250) + (textContent.length > 250 ? '...' : '');

//             formattedSummaries.push({
//                 title: post.title,
//                 published_at: new Date(post.published_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' }),
//                 summary: summary,
//                 url: post.url
//             });
//         }

//         let responseText = `Dưới đây là một số bài đăng/tin tức từ Nami Exchange:\n\n`;
//         formattedSummaries.forEach((item, index) => {
//             responseText += `${index + 1}. **${item.title}**\n`;
//             responseText += `   Xuất bản: ${item.published_at}\n`;
//             responseText += `   Tóm tắt: ${item.summary}\n`;
//             responseText += `   [Đọc thêm tại đây](${item.url})\n\n`;
//         });
        
//         return {
//             source: "Nami Blog",
//             summary: responseText,
//             posts: formattedSummaries // Trả về cả mảng chi tiết nếu Gemini cần
//         };

//     } catch (error) {
//         console.error(`Lỗi khi lấy tin tức/blog Nami (type: ${query_type}, keyword: ${keyword}):`, error.response?.data || error.message);
//         return { error: `Không thể lấy tin tức/blog từ Nami lúc này. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.` };
//     }
// }
// get_nami_blog_posts('What is trending on Nami this week?').then(r =>console.log(r));

// console.log(allNamiBlogPosts);

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
            const url = `${NAMI_BLOG_API_BASE_URL}/posts/?key=${NAMI_BLOG_API_KEY}&limit=${perPage}&page=${page}&filter=visibility:public&order=published_at%20desc`;
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


async function get_nami_blog_posts(query_type = 'latest', keyword = '') {
    console.log(`Lấy tin tức Nami: type=${query_type}, keyword=${keyword}`);
    try {
        const allPosts = await fetchAllNamiBlogPosts();

        if (!allPosts || allPosts.length === 0) {
            return { error: `Không tìm thấy bài đăng blog nào từ Nami.` };
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
            // Lấy tóm tắt tùy chỉnh hoặc tạo từ nội dung HTML
            const rawSummary = post.custom_excerpt || convert(post.html, {
                wordwrap: 130,
                selectors: [{ selector: 'a', options: { ignoreHref: true } }]
            }).substring(0, 250); // Lấy tối đa 250 ký tự

            formattedSummaries.push({
                title: post.title,
                published_at: new Date(post.published_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' }),
                summary_text: rawSummary + (rawSummary.length >= 250 ? '...' : ''), // Đảm bảo có dấu ... nếu bị cắt
                url: post.url
            });
        }

        let responseText = `Dưới đây là một số cập nhật từ Nami Exchange:\n\n`;
        formattedSummaries.forEach((item, index) => {
            responseText += `${index + 1}. **${item.title}**\n`;
            responseText += `   Xuất bản: ${item.published_at}\n`;
            responseText += `   Tóm tắt: ${item.summary_text}\n`;
            responseText += `   [Đọc thêm tại đây](${item.url})\n\n`;
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