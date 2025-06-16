// apiHandlers.js
const axios = require('axios');
require('dotenv').config();
const { convert } = require('html-to-text');
// // Định nghĩa các base URL từ .env
// const COINGECKO_API_BASE_URL = process.env.COINGECKO_API_BASE_URL; // Ví dụ: https://api.coingecko.com/api/v3
// const NAMI_CONFIG_API_BASE_URL = process.env.NAMI_CONFIG_API_BASE_URL; // Ví dụ: https://nami.exchange/api/v3
// const NAMI_SPOT_API_BASE_URL = process.env.NAMI_SPOT_API_BASE_URL; // Ví dụ: https://nami.exchange/api/v3/spot

// Cache để lưu ID CoinGecko và Nami
// let coingeckoCoinIdMap = {};


const NAMI_BLOG_API_BASE_URL = process.env.NAMI_BLOG_API_BASE_URL;
const NAMI_BLOG_API_KEY = process.env.NAMI_BLOG_API_KEY; 

let namiAssetIdMap = {};


async function get_nami_asset_id(token_symbol) {
    if (namiAssetIdMap[token_symbol.toUpperCase()]) {
        return namiAssetIdMap[token_symbol.toUpperCase()];
    }
    try {
        const response = await axios.get(`${process.env.NAMI_CONFIG_API_BASE_URL}/asset/config`);
        
        // console.log('Full API Response:', JSON.stringify(response.data, null, 2));
        const assets = response.data.data;
        // console.log('Assets data:', assets);
        
        const foundAsset = assets.find(asset => asset.assetCode.toLowerCase() === token_symbol.toLowerCase());
        if (foundAsset) {
            // console.log('Found asset:', foundAsset);
            namiAssetIdMap[token_symbol.toUpperCase()] = foundAsset.id;
            return foundAsset.id;
        }
        // console.log(`Asset with code ${token_symbol} not found`);
        return null;
    } catch (error) {
        console.error(`Error fetching Nami Asset ID for ${token_symbol}:`, error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        return null;
    }
}

// --- Hàm xử lý get_coingecko_token_details ---
// async function get_coingecko_token_details(token_symbol) {
//     const coinId = await get_coingecko_id(token_symbol);
//     if (!coinId) {
//         return { error: `Không tìm thấy thông tin cho token ${token_symbol} trên CoinGecko.` };
//     }
//     try {
//         // GET Coingecko: get info token -> /coins/{id}
//         // Ảnh bạn cung cấp chính là dữ liệu từ endpoint này.
//         const response = await axios.get(`${COINGECKO_API_BASE_URL}/coins/${coinId}`, {
//             params: {
//                 localization: "false",
//                 tickers: "false",
//                 market_data: "true",
//                 community_data: "false",
//                 developer_data: "false",
//                 sparkline: "false"
//             }
//         });
//         const data = response.data; // Dữ liệu trực tiếp là object của 1 token, không phải array

//         const description = data.description ? data.description.en : "Không có mô tả.";
//         // Lấy câu đầu tiên làm use case sơ bộ, loại bỏ HTML tags
//         const useCase = description.split('.')[0].replace(/<[^>]*>?/gm, '');

//         return {
//             source: "CoinGecko",
//             symbol: data.symbol?.toUpperCase(),
//             name: data.name,
//             id: data.id,
//             image_url: data.image?.large,
//             use_case: useCase,
//             current_price_usd: data.market_data?.current_price?.usd,
//             market_cap_usd: data.market_data?.market_cap?.usd,
//             total_volume_24h_usd: data.market_data?.total_volume?.usd,
//             price_change_percentage_24h: data.market_data?.price_change_percentage_24h,
//             tokenomics: {
//                 circulating_supply: data.market_data?.circulating_supply,
//                 total_supply: data.market_data?.total_supply,
//                 max_supply: data.market_data?.max_supply
//             },
//             ath_usd: data.market_data?.ath?.usd,
//             atl_usd: data.market_data?.atl?.usd,
//             last_updated: data.last_updated
//         };
//     } catch (error) {
//         console.error(`Error fetching CoinGecko details for ${token_symbol}:`, error.message);
//         return { error: `Lỗi khi lấy thông tin CoinGecko cho ${token_symbol}.` };
//     }
// }

// --- Hàm xử lý get_nami_token_info ---
async function get_nami_token_info(token_symbol) {
    const namiId = await get_nami_asset_id(token_symbol);
    if (!namiId) {
        return { error: `Không tìm thấy ID Nami cho token ${token_symbol}.` };
    }
    try {
        const response = await axios.get(`${process.env.NAMI_SPOT_API_BASE_URL}`, {
            params: { id: namiId }
        });
        const assetInfoData = response.data.data; // Dữ liệu chính nằm trong response.data.data

        if (!assetInfoData) {
             return { error: `Không có dữ liệu chi tiết cho token ${token_symbol} từ Nami hoặc phản hồi không hợp lệ.` };
        }

        let formattedData = {};

        // Thông tin cơ bản
        formattedData.name = assetInfoData.name;
        formattedData.symbol = assetInfoData.symbol?.toUpperCase();

        // Mô tả/Use Case (ưu tiên tiếng Việt, loại bỏ HTML, làm sạch)
        formattedData.description_vi = assetInfoData.description?.vi || assetInfoData.description?.en || "Không có mô tả chi tiết.";
        let cleanedDescription = formattedData.description_vi.replace(/<[^>]*>?/gm, '');
        formattedData.use_case_summary = cleanedDescription.split('.')[0] + '.';
        if (formattedData.use_case_summary.length < 50 && cleanedDescription.length > 50) {
            formattedData.use_case_summary = cleanedDescription.substring(0, Math.min(200, cleanedDescription.length)) + (cleanedDescription.length > 200 ? '...' : '');
        }

        // Dữ liệu thị trường (từ coingecko_metadata)
        const cg_metadata = assetInfoData.coingecko_metadata;
        if (cg_metadata) {
            formattedData.market_data = {
                current_price_usd: cg_metadata.current_price,
                market_cap_usd: cg_metadata.market_cap,
                total_volume_24h_usd: cg_metadata.total_volume,
                price_change_percentage_24h: cg_metadata.price_change_percentage_24h,
                cmc_rank: assetInfoData.cmc_rank // Lấy cmc_rank từ Nami data gốc
            };
        }

        // Tokenomics
        formattedData.tokenomics = {
            circulating_supply: assetInfoData.circulating_supply,
            total_supply: assetInfoData.total_supply,
            max_supply: assetInfoData.max_supply
        };

        // URLs (cho Gemini biết các nguồn để trích dẫn hoặc hướng dẫn người dùng)
        formattedData.urls = {
            website: assetInfoData.urls?.website?.[0],
            twitter: assetInfoData.urls?.twitter?.[0]
        };

        // --- Tạo một chuỗi tóm tắt CÓ CẤU TRÚC để Gemini dễ dàng tổng hợp ---
        let summaryString = `**Thông tin chi tiết về ${formattedData.name} (${formattedData.symbol}):**\n\n`;

        // 1. Mục đích/Trường hợp sử dụng
        if (formattedData.use_case_summary && formattedData.use_case_summary !== 'Không có mô tả chi tiết.') {
            summaryString += `**Mục đích/Trường hợp sử dụng/Dùng để làm gì:** ${formattedData.use_case_summary}\n\n`;
        }

        // 2. Dữ liệu thị trường
        if (formattedData.market_data && formattedData.market_data.current_price_usd) {
            summaryString += `**Dữ liệu thị trường hiện tại:**\n`;
            summaryString += `- Giá: ${formattedData.market_data.current_price_usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} (cập nhật gần đây)\n`;
            summaryString += `- Vốn hóa thị trường: ${formattedData.market_data.market_cap_usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
            summaryString += `- Khối lượng giao dịch 24h: ${formattedData.market_data.total_volume_24h_usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
            summaryString += `- Thay đổi giá 24h: ${formattedData.market_data.price_change_percentage_24h ? formattedData.market_data.price_change_percentage_24h.toFixed(2) : 'N/A'}%\n`;
            if (formattedData.market_data.cmc_rank) {
                summaryString += `- Xếp hạng Vốn hóa thị trường: #${formattedData.market_data.cmc_rank}\n\n`;
            }
        }

        // 3. Tokenomics
        if (formattedData.tokenomics.circulating_supply || formattedData.tokenomics.total_supply) {
            summaryString += `**Tokenomics:**\n`;
            summaryString += `- Tổng cung lưu hành: ${formattedData.tokenomics.circulating_supply ? formattedData.tokenomics.circulating_supply.toLocaleString() : 'N/A'}\n`;
            summaryString += `- Tổng cung tối đa: ${formattedData.tokenomics.max_supply ? formattedData.tokenomics.max_supply.toLocaleString() : 'N/A'}\n\n`;
        }

        // 4. Liên kết hữu ích
        if (formattedData.urls.website) {
            summaryString += `Để biết thêm chi tiết, bạn có thể truy cập website chính thức: ${formattedData.urls.website}\n`;
        } else if (formattedData.urls.twitter) {
             summaryString += `Bạn có thể tìm thêm thông tin trên Twitter: ${formattedData.urls.twitter}\n`;
        }

        return {
            source: "Nami",
            summary: summaryString, 
            full_data_extracted: formattedData 
        };

    } catch (error) {
        console.error(`Lỗi khi lấy thông tin token Nami cho ${token_symbol} (ID: ${namiId}):`, error.response?.data || error.message);
        return { error: `Không thể lấy thông tin token ${token_symbol} từ Nami. Vui lòng kiểm tra lại mã token hoặc thử lại sau.` };
    }
}


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


async function get_nami_blog_posts(query_type = 'latest', keyword = '', lang = 'vi') { // Đảm bảo lang có giá trị mặc định
    console.log(`Lấy tin tức Nami: type=${query_type}, keyword=${keyword}, lang=${lang}`); // Thêm log này để debug
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
    get_nami_token_info,
    get_nami_blog_posts
    
};

module.exports = availableFunctions;