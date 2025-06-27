// apiHandlers.js
const axios = require('axios');
require('dotenv').config({path: '../.env'});
// require('dotenv').config();
const { convert } = require('html-to-text');
const cheerio = require('cheerio');
const Fuse = require('fuse.js');

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
let lastFetchedAt = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // TTL: 5 phút

async function fetchAllNamiBlogPosts() {
    const now = Date.now();
    
    // Kiểm tra cache còn hợp lệ không
    if (allNamiBlogPosts.length > 0 && lastFetchedAt && (now - lastFetchedAt < CACHE_TTL_MS)) {
        return allNamiBlogPosts;
    }

    const perPage = 100;
    let page = 1;
    let posts = [];
    let totalPages = 1;

    try {
        do {
            const url = `${NAMI_BLOG_API_BASE_URL}/posts/?key=${NAMI_BLOG_API_KEY}&limit=${perPage}&page=${page}&include=tags&order=published_at%20desc&filter=tags:[noti-vi-su-kien,noti-en-events,noti-en-nami-news,noti-vi-tin-tuc-ve-nami,noti-vi-token-moi-niem-yet,noti-vi-huy-niem-yet,noti-en-new-cryptocurrency-listing,noti-en-delisting]`;
            const response = await axios.get(url);
            const data = response.data;

            posts = posts.concat(data.posts);
            totalPages = data.meta.pagination.pages;
            page += 1;
        } while (page <= totalPages);

        // Cập nhật cache
        allNamiBlogPosts = posts;
        lastFetchedAt = Date.now();

        return allNamiBlogPosts;
    } catch (error) {
        console.error("Lỗi khi lấy tất cả bài đăng blog Nami:", error.response?.data || error.message);
        throw new Error("Không thể lấy dữ liệu blog từ Nami.");
    }
}


// console.log(allNamiBlogPosts)

let webUrl = "https://nami.exchange/support/announcement"


async function get_nami_blog_posts(query_type = 'latest', keyword = '', lang = 'vi', month = null, year = null) {
    console.log(`Lấy tin tức Nami: type=${query_type}, keyword=${keyword}, lang=${lang}, month=${month}, year=${year}`);
    try {
        const allPosts = await fetchAllNamiBlogPosts();

        if (!allPosts || allPosts.length === 0) {
            return { error: `Không tìm thấy bài đăng blog nào từ Nami.` };
        }

        // Bước 1: Lọc bài đăng theo ngôn ngữ (giữ nguyên)
        let langFilteredPosts = allPosts.filter(post => {
            const postTags = post.tags || [];
            const isEnglishPost = postTags.some(tag => tag.slug === 'en') || (post.primary_tag && post.primary_tag.slug.includes('-en-'));
            const isVietnamesePost = postTags.some(tag => tag.slug === 'vi') || (post.primary_tag && post.primary_tag.slug.includes('-vi-'));

            if (lang === 'en') {
                return isEnglishPost;
            } else if (lang === 'vi') {
                return isVietnamesePost;
            }
            return true;
        });

        if (langFilteredPosts.length === 0) {
            langFilteredPosts = allPosts.filter(post => {
                const postTags = post.tags || [];
                const hasExplicitLangTag = postTags.some(tag => tag.slug === 'en' || tag.slug === 'vi') || 
                                           (post.primary_tag && (post.primary_tag.slug.includes('-en-') || post.primary_tag.slug.includes('-vi-')));
                return !hasExplicitLangTag;
            });
            if (langFilteredPosts.length === 0) {
                langFilteredPosts = allPosts;
            }
        }
        
        // Bước 2: Lọc bài đăng theo THỜI GIAN
        let timeFilteredPosts = langFilteredPosts;
        if (month !== null || year !== null) {
            timeFilteredPosts = langFilteredPosts.filter(post => {
                const postDate = new Date(post.published_at);
                const postMonth = postDate.getMonth() + 1; // getMonth() trả về 0-11
                const postYear = postDate.getFullYear();

                const monthMatch = (month === null || postMonth === month);
                const yearMatch = (year === null || postYear === year);

                return monthMatch && yearMatch;
            });

            if (timeFilteredPosts.length === 0) {
                // Nếu không tìm thấy bài đăng nào theo tháng/năm, trả về thông báo lỗi cho Gemini xử lý
                return { error: `Không tìm thấy bài đăng nào trong ${month ? 'tháng ' + month : ''}${year ? ' năm ' + year : ''}. Vui lòng thử một khoảng thời gian khác.` };
            }
        }

        // Bước 3: Lọc bài đăng theo query_type/chủ đề dựa trên SLUG TAGS (Áp dụng trên timeFilteredPosts)
        let filteredPosts = [];

        // Quyết định có nên cắt số lượng bài đăng hay không.
        // Nếu có tháng/năm cụ thể, chúng ta muốn trả về TẤT CẢ các bài khớp, không cắt.
        const applySliceLimit = (month === null && year === null);
        const defaultSliceLimit = 5; // Mặc định 5 bài nếu không có tháng/năm cụ thể

        if (query_type === 'latest' || query_type === 'news') {
            filteredPosts = applySliceLimit ? timeFilteredPosts.slice(0, defaultSliceLimit) : timeFilteredPosts;
        } else if (query_type === 'events') {
            const eventTagSlugs = ['event', 'events', 'sự kiện', 'competition', 'giải-dau', 'campaign', 'campaigns', 'khuyến-mai', 'promo', 'promos', 'ưu-đãi'];
            const eventFiltered = timeFilteredPosts.filter(post => 
                (post.primary_tag && eventTagSlugs.some(slug => post.primary_tag.slug.includes(slug))) ||
                (post.tags && post.tags.some(tag => eventTagSlugs.some(slug => tag.slug.includes(slug))))
            );
            filteredPosts = applySliceLimit ? eventFiltered.slice(0, defaultSliceLimit) : eventFiltered;
        } else if (query_type === 'new_listing') {
            const listingTagSlugs = ['new-cryptocurrency-listing', 'token-moi-niem-yet', 'listing', 'niêm-yet', 'officially-lists', 'list']; // Thêm 'list'
            const listingFiltered = timeFilteredPosts.filter(post => 
                (post.primary_tag && listingTagSlugs.some(slug => post.primary_tag.slug.includes(slug))) ||
                (post.tags && post.tags.some(tag => listingTagSlugs.some(slug => tag.slug.includes(slug))))
            );
            filteredPosts = applySliceLimit ? listingFiltered.slice(0, defaultSliceLimit) : listingFiltered;
        } else if (query_type === 'delisting') {
            const delistingTagSlugs = ['delisting', 'huy-niem-yet', 'remove'];
            const delistingFiltered = timeFilteredPosts.filter(post => 
                (post.primary_tag && delistingTagSlugs.some(slug => post.primary_tag.slug.includes(slug))) ||
                (post.tags && post.tags.some(tag => delistingTagSlugs.some(slug => tag.slug.includes(slug))))
            );
            filteredPosts = applySliceLimit ? delistingFiltered.slice(0, defaultSliceLimit) : delistingFiltered;
        } else if (query_type === 'trending' || keyword) {
            const keywordFiltered = timeFilteredPosts.filter(post => 
                post.title.toLowerCase().includes(keyword.toLowerCase()) ||
                post.custom_excerpt?.toLowerCase().includes(keyword.toLowerCase()) ||
                (post.html && convert(post.html, { limits: { maxInputLength: 1000 } }).toLowerCase().includes(keyword.toLowerCase()))
            );
            filteredPosts = applySliceLimit ? keywordFiltered.slice(0, defaultSliceLimit) : keywordFiltered;
        } else {
            // Default/fallback if query_type doesn't explicitly match, still applies time filter
            filteredPosts = applySliceLimit ? timeFilteredPosts.slice(0, defaultSliceLimit) : timeFilteredPosts;
        }

        // Nếu sau tất cả các bộ lọc, không còn bài đăng nào khớp
        if (filteredPosts.length === 0) {
             return { error: `Không tìm thấy tin tức/bài đăng nào phù hợp với yêu cầu của bạn.` };
        }
        
        let formattedSummaries = [];
        for (const post of filteredPosts) {

            const tags = post.primary_tag.slug;
            const result = tags.split("-").slice(2).join("-");
            
            const finalUrl = `${webUrl}/${result}/${post.slug}` ;
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
        console.error(`Lỗi khi lấy tin tức/blog Nami (type: ${query_type}, keyword: ${keyword}, lang: ${lang}, month: ${month}, year: ${year}):`, error.response?.data || error.message);
        throw { error: `Không thể lấy tin tức/blog từ Nami lúc này. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.` };
    }
}

// Porfolio_User
async function get_nami_token_symbol(assetId) {
    if (namiAssetIdMap[assetId]) {
        return namiAssetIdMap[assetId];
    }
    try {
        const response = await axios.get(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/asset/config`);
        
        // console.log('Full API Response:', JSON.stringify(response.data, null, 2));
        const assets = response.data.data;
        // console.log('Assets data:', assets);
        
        const foundAsset = assets.find(asset => asset.id === assetId);
        if (foundAsset) {
            // console.log('Found asset:', foundAsset);
            namiAssetIdMap[assetId] = foundAsset.assetCode;
            return foundAsset.assetCode;
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

async function get_user_portfolio_performance(lang = 'vi', nameCurrency = 'VNST') {
    console.log("Đang lấy api")
    let baseCurrency;
    if (nameCurrency === 'VNST') {
        baseCurrency = 39;
    } else {
        baseCurrency = 22;
    }

    console.log(`Lấy hiệu suất portfolio: lang=${lang}, baseCurrency=${baseCurrency}`);

    try {
        // console.log("TOKEN:",process.env.NAMI_USER_AUTH_TOKEN)
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return {
                error: (lang === 'vi')
                    ? "Không thể truy cập dữ liệu portfolio. Vui lòng cung cấp token xác thực."
                    : "Cannot access portfolio data. Authentication token is missing."
            };
        }
        // console.log("TOKEN:",process.env.NAMI_USER_AUTH_TOKEN)
        const portfolioResponse = await axios.get(
            `${process.env.NAMI_TEST_API_BASE_URL}/api/v3/metric/spot-statistic/portfolio-assets?baseCurrency=${baseCurrency}`,
            {
                headers: {
                    'fakeauthorization': `${process.env.NAMI_USER_AUTH_TOKEN}`,
                }
            }
        );
        // console.log(portfolioResponse)
        const portfolioData = portfolioResponse.data.data;
        if (!portfolioData || portfolioData.length === 0) {
            return {
                error: (lang === 'vi')
                    ? "Danh mục đầu tư của bạn trống hoặc không có dữ liệu."
                    : "Your portfolio is empty or no data available."
            };
        }

        let totalPortfolioValue = 0;
        let totalPurchaseCost = 0;
        let assetDetails = [];

        let usdToVnstRate = 1;
        if (baseCurrency === 22) {
            try {
                const marketWatchResponse = await axios.get(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/spot/market_watch`, {
                    params: { symbol: "USDTVNST" }
                });
                const dataArr = marketWatchResponse.data.data;
                const usdVnstData = Array.isArray(dataArr) ? dataArr.find(item => item.s === "USDTVNST") : null;
                if (usdVnstData && usdVnstData.p) {
                    usdToVnstRate = parseFloat(usdVnstData.p);
                }
            } catch (err) {
                console.warn("Không thể lấy tỷ giá USDTVNST. Gán mặc định 1.");
            }
        }

        for (const asset of portfolioData) {
            const assetId = asset.assetId;
            const amount = parseFloat(asset.totalAmount);
            const avgPrice = parseFloat(asset.avgPrice);
            const totalQuoteBuy = parseFloat(asset.totalQuoteBuy);
            const totalQuoteSell = parseFloat(asset.totalQuoteSell);

            if (amount <= 0 && totalQuoteBuy === 0 && totalQuoteSell === 0) continue;

            const symbol_name = await get_nami_token_symbol(assetId);
            if (!symbol_name) {
                console.warn(`Không tìm thấy symbol cho assetId ${assetId}.`);
                continue;
            }

            const assetQuoteCurrency = baseCurrency === 22 ? "USDT" : "VNST";
            const marketWatchSymbol = `${symbol_name}${assetQuoteCurrency}`;
            let currentPrice = 0;
            let priceChange24hPercent = 0;

            if (marketWatchSymbol === "VNSTVNST" || marketWatchSymbol === "USDTUSDT") {
                currentPrice = 1;
            } else if (marketWatchSymbol === "VNSTUSDT") {
                currentPrice = 1 / usdToVnstRate;
            } else {
                try {
                    const marketWatchResponse = await axios.get(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/spot/market_watch`, {
                        params: { symbol: marketWatchSymbol }
                    });
                    const rawMarketData = marketWatchResponse.data.data;
                    const matched = Array.isArray(rawMarketData) ? rawMarketData.find(i => i.s === marketWatchSymbol) : null;
                    if (matched && matched.p) {
                        currentPrice = parseFloat(matched.p);
                        priceChange24hPercent = parseFloat((currentPrice - (matched.ld || 0)) / matched.ld) * 100;
                    }
                } catch (e) {
                    console.warn(`Không lấy được giá ${marketWatchSymbol}:`, e.message);
                }
            }

            const assetCurrentValue = currentPrice * amount;
            const pnl = assetCurrentValue + totalQuoteSell - totalQuoteBuy;
            const pnlPercent = (totalQuoteBuy > 0) ? (pnl / totalQuoteBuy) * 100 : 0;

            totalPortfolioValue += assetCurrentValue;
            totalPurchaseCost += totalQuoteBuy;

            assetDetails.push({
                symbol: symbol_name,
                amount,
                current_price: currentPrice,
                pnl_value: pnl,
                pnl_percent: pnlPercent,
                price_change_24h_percent: priceChange24hPercent
            });
        }

        const totalCurrentValueForAllocation = assetDetails.reduce((acc, asset) => acc + (asset.current_price * asset.amount), 0);
        assetDetails.forEach(asset => {
            asset.allocation_percent = (totalCurrentValueForAllocation > 0)
                ? (asset.current_price * asset.amount / totalCurrentValueForAllocation) * 100
                : 0;
        });

        const totalPnL = totalPortfolioValue - totalPurchaseCost;
        const totalPnLPercent = (totalPurchaseCost > 0) ? (totalPnL / totalPurchaseCost) * 100 : 0;

        const locale = (lang === 'vi') ? 'vi-VN' : 'en-US';

        const formatNumber = (value, currentLocale, minDecimal = 2, maxDecimal = 2) => {
            if (typeof value !== 'number') return 'N/A';
            return new Intl.NumberFormat(currentLocale, {
                minimumFractionDigits: minDecimal,
                maximumFractionDigits: maxDecimal,
                useGrouping: true
            }).format(value);
        };

        let displayCurrencySymbol = '₫';
        let displayCurrencyName = nameCurrency;

        if (baseCurrency === 22) {
            displayCurrencySymbol = '$';
            displayCurrencyName = 'USDT';
        } else if (baseCurrency === 39) {
            displayCurrencySymbol = '₫';
            displayCurrencyName = 'VNST';
        }

        let responseSummary = (lang === 'vi')
            ? `**Tổng quan danh mục đầu tư của bạn (tính bằng ${displayCurrencyName}):**\n\n`
            : `**Your Portfolio Overview (in ${displayCurrencyName}):**\n\n`;

        responseSummary += `- ${(lang === 'vi') ? `Bạn đang nắm giữ` : `Holding`} ${assetDetails.length} ${(lang === 'vi') ? `loại tài sản` : `assets`}.\n`;
        responseSummary += `- ${(lang === 'vi') ? `Tổng giá trị hiện tại` : `Total value`}: ${displayCurrencySymbol}${formatNumber(totalPortfolioValue, locale)}\n`;
        responseSummary += `- PnL: ${totalPnLPercent.toFixed(2)}% (${displayCurrencySymbol}${formatNumber(totalPnL, locale)})\n\n`;

        responseSummary += (lang === 'vi') ? `**Tỷ lệ phân bổ:**\n` : `**Asset Allocation:**\n`;
        assetDetails.sort((a, b) => b.allocation_percent - a.allocation_percent)
            .forEach(asset => {
                responseSummary += `- ${asset.symbol}: ${asset.allocation_percent.toFixed(2)}%\n`;
            });

        responseSummary += `\n${(lang === 'vi') ? `**Hiệu suất 24h:**\n` : `**24h Performance:**\n`}`;
        assetDetails.sort((a, b) => b.pnl_percent - a.pnl_percent).slice(0, 10).forEach(asset => {
            const emoji = asset.pnl_percent > 0 ? '📈' : (asset.pnl_percent < 0 ? '📉' : '↔️');
            responseSummary += `- ${asset.symbol}: ${asset.pnl_percent.toFixed(2)}% ${emoji} (24h: ${asset.price_change_24h_percent.toFixed(2)}%)\n`;
        });

        return {
            source: "Nami Portfolio",
            summary: responseSummary,
            portfolio_data: {
                total_value: totalPortfolioValue,
                total_pnl_percent: totalPnLPercent,
                assets: assetDetails
            }
        };

    } catch (error) {
        console.error(`Lỗi khi lấy hiệu suất portfolio:`, error.response?.data || error.message);
        if (error.response && error.response.status === 401) {
            return {
                error: (lang === 'vi')
                    ? "Lỗi xác thực: Token không hợp lệ."
                    : "Authentication error: Invalid token."
            };
        }
        return {
            error: (lang === 'vi')
                ? `Không thể lấy dữ liệu lúc này.`
                : `Unable to fetch portfolio.`
        };
    }
}

async function get_nami_notification_setting_internal(lang = 'vi') { // Đổi tên để tránh nhầm lẫn
    console.log(`Lấy cài đặt thông báo cho người dùng.`);
    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return {
                error: (lang === 'vi') ? "Không thể truy cập cài đặt thông báo. Vui lòng cung cấp token xác thực." : "Cannot access notification settings. Authentication token is missing."
            };
        }

        const response = await axios.get(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/alert_price/setting`, {
            headers: {
                'fakeauthorization': process.env.NAMI_USER_AUTH_TOKEN
            }
        });

        if (response.data.status === 'ok' && response.data.data) {
            const settings = response.data.data;
            console.log(settings)
            return {
                success: true,
                useDeviceNoti: settings.deviceNoti,
                emailNoti: settings.emailNoti,
                lang: settings.lang || 'vi'
            };
        } else {
            return { error: (lang === 'vi') ? "Không thể lấy cài đặt thông báo hiện tại." : "Unable to retrieve current notification settings." };
        }
    } catch (error) {
        console.error(`Lỗi khi lấy cài đặt thông báo:`, error.response?.data || error.message);
        return { error: (lang === 'vi') ? "Không thể lấy cài đặt thông báo lúc này. Vui lòng thử lại sau." : "Unable to retrieve notification settings at this time." };
    }
}


async function update_nami_notification_setting(useDeviceNoti, useEmailNoti, lang = 'vi') {
    console.log(`Cập nhật cài đặt thông báo: useDeviceNoti=${useDeviceNoti}, useEmailNoti=${useEmailNoti}`);
    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return {
                error: (lang === 'vi') ? "Không thể cập nhật cài đặt thông báo. Vui lòng cung cấp token xác thực." : "Cannot update notification settings. Authentication token is missing."
            };
        }

        const payload = {
            useDeviceNoti: useDeviceNoti,
            useEmailNoti: useEmailNoti
        };

        const response = await axios.put(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/alert_price/setting`, payload, {
            headers: {
                'fakeauthorization': process.env.NAMI_USER_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status === 'ok') {
            return {
                success: true,
                message: (lang === 'vi') ?
                    `Cài đặt thông báo của bạn đã được cập nhật thành công: Thông báo trên thiết bị ${useDeviceNoti ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}, Thông báo Email ${useEmailNoti ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}.` :
                    `Your notification settings have been updated successfully: Device notifications ${useDeviceNoti ? 'ENABLED' : 'DISABLED'}, Email notifications ${useEmailNoti ? 'ENABLED' : 'DISABLED'}.`
            };
        } else {
            return { error: (lang === 'vi') ? "Không thể cập nhật cài đặt thông báo." : "Unable to update notification settings." };
        }
    } catch (error) {
        console.error(`Lỗi khi cập nhật cài đặt thông báo:`, error.response?.data || error.message);
        return { error: (lang === 'vi') ? "Không thể cập nhật cài đặt thông báo lúc này. Vui lòng thử lại sau." : "Unable to update notification settings at this time." };
    }
}


async function create_nami_alert(alert_type, base_assets, quote_asset='USDT', product_type='SPOT', value = null, percentage_change = null, interval = null, frequency = 'ONLY_ONCE', lang = 'vi') {
    console.log(`Tạo cảnh báo Nami: type=${alert_type}, assets=${base_assets.join(',')}, quote=${quote_asset}, product=${product_type}, value=${value}, pct_change=${percentage_change}, interval=${interval}, freq=${frequency}, lang=${lang}`);

    if (!process.env.NAMI_USER_AUTH_TOKEN) {
        return { error: (lang === 'vi') ? "Không thể tạo cảnh báo. ID người dùng Nami chưa được cấu hình." : "Cannot create alert. Nami User ID is not configured." };
    }
    const translatedAlertTypes = {
        'REACH_PRICE': { vi: 'đạt đến giá', en: 'reach the price' },
        'PRICE_RISES_ABOVE': { vi: 'tăng lên trên', en: 'rise above' },
        'PRICE_DROPS_TO': { vi: 'giảm xuống dưới', en: 'drop below' },
        'CHANGE_IS_OVER': { vi: 'tăng trên một ngưỡng', en: 'change over a threshold' },
        'CHANGE_IS_UNDER': { vi: 'giảm dưới một ngưỡng', en: 'change under a threshold' },
        'DAY_CHANGE_IS_OVER': { vi: 'biến động 24h tăng trên', en: '24h change over' },
        'DAY_CHANGE_IS_DOWN': { vi: 'biến động 24h giảm xuống', en: '24h change down' },
        'DURATION_CHANGE_IS_OVER': { vi: 'biến động trong khoảng thời gian tăng trên', en: 'duration change over' },
        'DURATION_CHANGE_IS_UNDER': { vi: 'biến động trong khoảng thời gian giảm dưới', en: 'duration change under' },
        'DURATION_CHANGE': { vi: 'biến động trong khoảng thời gian', en: 'duration change' }
    };
    const translatedAlertType = translatedAlertTypes[alert_type] ? translatedAlertTypes[alert_type][lang] : alert_type;

    let valueDisplay = '';
    // UPDATED: Adjust valueDisplay logic for DAY_CHANGE_IS_OVER/DOWN
    if (['REACH_PRICE', 'PRICE_RISES_ABOVE', 'PRICE_DROPS_TO'].includes(alert_type)) {
        const currencySymbol = (quote_asset === 'USDT') ? '$' : ((quote_asset === 'VNST') ? ' VNST' : '');
        valueDisplay = `${currencySymbol}${value}`;
    } else if (['DAY_CHANGE_IS_OVER', 'DAY_CHANGE_IS_DOWN'].includes(alert_type)) {
        valueDisplay = `${value}%`; // For DAY_CHANGE, value is the percentage
    }
    else if (['CHANGE_IS_OVER', 'CHANGE_IS_UNDER', 'DURATION_CHANGE_IS_OVER', 'DURATION_CHANGE_IS_UNDER', 'DURATION_CHANGE'].includes(alert_type)) {
        valueDisplay = `${percentage_change}%`;
    }
    if (interval !== null && (alert_type.includes('DURATION') || alert_type.includes('CHANGE_IS_OVER') || alert_type.includes('CHANGE_IS_UNDER'))) {
        valueDisplay += ` ${(lang === 'vi' ? 'trong' : 'in')} ${interval} ${(lang === 'vi' ? 'giờ' : 'hours')}`;
    }

    let payload = {
        baseAsset: base_assets[0],
        baseAssets: base_assets,
        isMulti: base_assets.length > 1,
        quoteAsset: quote_asset,
        productType: product_type,
        alertType: alert_type,
        frequency: frequency,
        lang: lang
    };

    // --- Validation Checks (UPDATED) ---
    if (['REACH_PRICE', 'PRICE_RISES_ABOVE', 'PRICE_DROPS_TO'].includes(alert_type)) {
        if (value === null || isNaN(parseFloat(value))) {
            return { error: (lang === 'vi') ? "Vui lòng cung cấp giá trị ngưỡng hợp lệ cho loại cảnh báo giá." : "Please provide a valid threshold value for this price alert type." };
        }
        // Ensure percentage_change and interval are null for these types
        percentage_change = null;
        interval = null;
    } else if (['CHANGE_IS_OVER', 'CHANGE_IS_UNDER', 'DURATION_CHANGE_IS_OVER', 'DURATION_CHANGE_IS_UNDER', 'DURATION_CHANGE'].includes(alert_type)) {
        if (percentage_change === null || isNaN(percentage_change)) {
            return { error: (lang === 'vi') ? "Vui lòng cung cấp phần trăm biến động hợp lệ cho loại cảnh báo này." : "Please provide a valid percentage change for this alert type." };
        }
        // Ensure value is null for these types
        value = null;

        // Check interval for DURATION_CHANGE types AND CHANGE_IS_OVER/CHANGE_IS_UNDER
        if (interval === null) {
            return { error: (lang === 'vi') ? "Vui lòng cung cấp khoảng thời gian (interval) hợp lệ cho loại cảnh báo biến động." : "Please provide a valid interval for this change alert type." };
        }
        const validIntervals = ['1', '4', '8', '12', '24'];
        if (!validIntervals.includes(String(interval))) {
             return { error: (lang === 'vi') ? "Khoảng thời gian không hợp lệ. Chỉ chấp nhận các giá trị: 1, 4, 8, 12, 24 giờ." : "Invalid interval. Only accepts: 1, 4, 8, 12, 24 hours." };
        }

    } else if (['DAY_CHANGE_IS_OVER', 'DAY_CHANGE_IS_DOWN'].includes(alert_type)) {
        if (value === null || isNaN(parseFloat(value))) {
             return { error: (lang === 'vi') ? "Vui lòng cung cấp giá trị phần trăm biến động hợp lệ cho loại cảnh báo 24h." : "Please provide a valid percentage change value for this 24h alert type." };
        }
        // Ensure percentage_change and interval are null for these types
        percentage_change = null;
        interval = null; // DAY_CHANGE_IS_OVER/DOWN không có interval

    }
    // --- END Validation ---

    // --- Cập nhật logic xây dựng Payload dựa trên các giá trị đã được validate/điều chỉnh ---
    if (['REACH_PRICE', 'PRICE_RISES_ABOVE', 'PRICE_DROPS_TO'].includes(alert_type)) {
        payload.value = String(value);
        payload.percentage_change = null; // Explicitly set to null for API
    } else if (['CHANGE_IS_OVER', 'CHANGE_IS_UNDER', 'DURATION_CHANGE_IS_OVER', 'DURATION_CHANGE_IS_UNDER', 'DURATION_CHANGE'].includes(alert_type)) {
        // Convert percentage_change to decimal if it's an integer
        if (percentage_change !== null && percentage_change > 1) {
            payload.percentage_change = percentage_change / 100;
        } else {
            payload.percentage_change = percentage_change;
        }
        payload.value = null; // Explicitly set to null for API
        payload.interval = interval; // Set interval as it's required for these types
    } else if (['DAY_CHANGE_IS_OVER', 'DAY_CHANGE_IS_DOWN'].includes(alert_type)) {
        // value is the percentage, convert to decimal if it's an integer
        if (value !== null && parseFloat(value) > 1) {
            payload.value = String(parseFloat(value) / 100);
        } else {
            payload.value = String(value);
        }
        payload.percentage_change = null; // Explicitly set to null for API
        payload.interval = null; // Explicitly set to null for API
    }
    // --- Kết thúc cập nhật logic xây dựng Payload ---


    try {
        const response = await axios.post(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/alert_price`, payload, {
            headers: {
                'fakeauthorization': process.env.NAMI_USER_AUTH_TOKEN
            }
        });

        if (response.data.status === 'ok') {
            let initialMessage = (lang === 'vi') ?
                `Cảnh báo **"${base_assets.join(', ')}/${quote_asset} ${translatedAlertType} ${valueDisplay}"** đã được cài đặt thành công! Hệ thống sẽ thông báo đến bạn.\n` :
                `Alert **"${base_assets.join(', ')}/${quote_asset} to ${translatedAlertType} ${valueDisplay}"** successfully set! You will be notified.\n`;

            const notificationSetting = await get_nami_notification_setting_internal(lang);
            if (notificationSetting.success) {
                const deviceNotiStatus = notificationSetting.useDeviceNoti;
                const emailNotiStatus = notificationSetting.emailNoti && notificationSetting.emailNoti.includes("@") ? true : false;

                let settingMessage = (lang === 'vi') ?
                    `\nCài đặt thông báo hiện tại của bạn là:\n - Thông báo trên thiết bị **${deviceNotiStatus ? 'ĐANG BẬT' : 'ĐANG TẮT'}**, Thông báo Email **${emailNotiStatus ? 'ĐANG BẬT' : 'ĐANG TẮT'}**.\n` :
                    `\nYour current notification settings are:\n - Device notifications are **${deviceNotiStatus ? 'ENABLED' : 'DISABLED'}**, Email notifications are **${emailNotiStatus ? 'ENABLED' : 'DISABLED'}**.\n`;

                if (!deviceNotiStatus || !emailNotiStatus ) {
                    settingMessage += (lang === 'vi') ?
                        `\n- Để đảm bảo nhận được cảnh báo, bạn có muốn tôi bật cả thông báo trên thiết bị và qua email không?` :
                        `\n- To ensure you receive alerts, would you like me to enable both device and email notifications?`;
                } else {
                    settingMessage += (lang === 'vi') ?
                        `\nBạn có thể quản lý cảnh báo trong Cài đặt Thông báo.` :
                        `\nYou can manage alerts in your Notification Settings.`;
                }
                return {
                    success: true,
                    message: `${initialMessage}${settingMessage}`,
                    ask_to_enable_notifications: (!deviceNotiStatus || !emailNotiStatus)
                };
            } else {
                console.warn("Không thể kiểm tra cài đặt thông báo sau khi tạo cảnh báo:", notificationSetting.error);
                return {
                    success: true,
                    message: `${initialMessage} ${(lang === 'vi') ? `Bạn có thể quản lý cảnh báo trong Cài đặt Thông báo.` : `You can manage alerts in your Notification Settings.`}`
                };
            }
        } else {
            console.error("Nami API returned OK status but not 'ok' status field. Full response data:", response.data);
            const apiErrorData = response.data;
            let errorMessage = (lang === 'vi') ? "Đã xảy ra lỗi khi tạo cảnh báo." : "An error occurred while creating the alert.";

            if (apiErrorData && typeof apiErrorData.message === 'string') {
                errorMessage = (lang === 'vi') ? `Lỗi: ${apiErrorData.message}` : `Error: ${apiErrorData.message}`;
            } else if (apiErrorData && typeof apiErrorData.error === 'string') {
                switch(apiErrorData.error) {
                    case 'INVALID_MAX_ALERT': errorMessage = (lang === 'vi') ? "Bạn đã đạt giới hạn 50 cảnh báo." : "You have reached the maximum of 50 alerts."; break;
                    case 'INVALID_MAX_ALERT_PER_PAIR': errorMessage = (lang === 'vi') ? "Bạn đã đạt giới hạn 10 cảnh báo cho cặp này." : "You have reached the maximum of 10 alerts for this pair."; break;
                    case 'BODY_MISSING': errorMessage = (lang === 'vi') ? "Thiếu thông tin cần thiết để tạo cảnh báo." : "Missing required information to create alert."; break;
                    case 'INVALID_PRICE': errorMessage = (lang === 'vi') ? "Giá trị ngưỡng không hợp lệ." : "Invalid threshold value."; break;
                    case 'INVALID_INTERVAL': errorMessage = (lang === 'vi') ? "Khoảng thời gian không hợp lệ. Chỉ chấp nhận các giá trị: 1, 4, 8, 12, 24 giờ." : "Invalid interval. Only accepts: 1, 4, 8, 12, 24 hours."; break;
                    default: errorMessage += ` (${apiErrorData.error})`;
                }
            } else {
                 errorMessage += (lang === 'vi') ? " (phản hồi không xác định)." : " (unknown response).";
            }
            return { error: errorMessage };
        }

    } catch (error) {
        console.error(`Lỗi khi gọi API tạo cảnh báo:`, error.response?.data || error.message);
        const apiErrorData = error.response?.data;
        let userFacingError = (lang === 'vi') ? `Không thể tạo cảnh báo lúc này. Vui lòng thử lại sau.` : `Unable to create alert at this time. Please try again later.`;

        if (apiErrorData && typeof apiErrorData.message === 'string') {
            userFacingError = (lang === 'vi') ? `Lỗi API: ${apiErrorData.message}` : `API Error: ${apiErrorData.message}`;
        } else if (error.response && error.response.status === 401) {
            userFacingError = (lang === 'vi') ? "Lỗi xác thực: Token không hợp lệ. Vui lòng kiểm tra lại token của bạn." : "Authentication error: Invalid token. Please check your token.";
        } else if (error.response) {
            userFacingError = (lang === 'vi') ? `Lỗi API ${error.response.status}: ${JSON.stringify(apiErrorData)}` : `API Error ${error.response.status}: ${JSON.stringify(apiErrorData)}`;
        } else {
            userFacingError = (lang === 'vi') ? `Lỗi kết nối hoặc không xác định: ${error.message}` : `Connection or unknown error: ${error.message}`;
        }
        return { error: userFacingError };
    }
}


let allNamiFAQ = {}; // cache theo tag

async function fetchAllNamiFAQ(tagsForAPI = 'faq') {
  // 1) Trả về cache nếu đã có
  if (Array.isArray(allNamiFAQ[tagsForAPI])) {
    return allNamiFAQ[tagsForAPI];
  }

  const perPage = 100;
  let page = 1;
  let posts = [];
  let totalPages = 1;

  try {
    // 2) Fetch hết pagination với filter tagsForAPI
    do {
      const url = [
        `${process.env.NAMI_BLOG_API_BASE_URL}/posts/`,
        `?key=${process.env.NAMI_BLOG_API_KEY}`,
        `&limit=${perPage}`,
        `&page=${page}`,
        `&include=tags`,
        `&order=published_at%20desc`,
        `&filter=tags:[${tagsForAPI}]`
      ].join('');

      const { data } = await axios.get(url);
      posts = posts.concat(data.posts);
      totalPages = data.meta.pagination.pages;
      page++;
    } while (page <= totalPages);

    // 3) Lọc:
    //    - Bắt buộc có đúng tagsForAPI
    //    - Loại bỏ bất kỳ post nào có tag bắt đầu bằng 'noti-'
    const lowerReq = tagsForAPI.toLowerCase();
    const filtered = posts.filter(post => {
      const slugs = post.tags.map(t => t.slug.toLowerCase());

      // Bỏ nếu không chứa tag bắt buộc
      if (!slugs.includes(lowerReq)) return false;

      // Bỏ nếu có bất kỳ tag nào bắt đầu bằng 'noti-'
      if (slugs.some(s => s.startsWith('noti') || s.startsWith('noti'))) return false;

      return true;
    });

    // 4) Cache & return
    allNamiFAQ[tagsForAPI] = filtered;
    console.log(filtered.length)
    return filtered;

  } catch (error) {
    console.error(
      `Lỗi khi lấy FAQ posts (tag=${tagsForAPI}):`,
      error.response?.data || error.message
    );
    throw new Error("Không thể lấy dữ liệu blog từ Nami.");
  }
}

// fetchAllNamiFAQ('faq-vi-nap-rut-tien-ma-hoa').then(r=>console.log(r))

let webUrlFaq = "https://nami.exchange/support/faq/"

async function get_nami_onboarding_guide(lang = 'vi', keyword = '', category_slug = null) {
    console.log(`Đang lấy hướng dẫn onboarding cho ngôn ngữ: ${lang}, từ khóa: ${keyword}, category_slug: ${category_slug}`);
    
    try {
        // let fetchTagsForAPI = 'faq';

        // Mapping categories to specific slugs
        const categorySlugMap = {
            'huong-dan-chung': 'faq-vi-huong-dan-chung',
            'dang-ky-tai-khoan-va-mat-khau': 'faq-vi-dang-ky-tai-khoan-va-mat-khau',
            'chuc-nang-tai-khoan': 'faq-vi-chuc-nang-tai-khoan',
            'nap-rut-tien-ma-hoa': 'faq-vi-nap-rut-tien-ma-hoa',
            'giao-dich-spot': 'faq-vi-giao-dich-spot',
            'giao-dich-futures': 'faq-vi-giao-dich-futures',
            'quy-doi': 'faq-vi-quy-doi',
            'daily-staking': 'faq-vi-daily-staking',
            'token-nami': 'faq-vi-token-nami',
            'hop-tac-kinh-doanh': 'faq-vi-hop-tac-kinh-doanh',
            'gioi-thieu-nguoi-dung-moi': 'faq-vi-gioi-thieu-nguoi-dung-moi',
            'tutorials': 'faq-en-tutorials',
            'register-account-and-password': 'faq-en-register-account-and-password',
            'account-functions': 'faq-en-account-functions',
            'crypto-deposit-withdrawal': 'faq-en-crypto-deposit-withdrawal',
            'spot-trading': 'faq-en-spot-trading',
            'futures-trading': 'faq-en-futures-trading',
            'swap': 'faq-en-swap',
            'daily-staking-en': 'faq-en-daily-staking',
            'nami-token': 'faq-en-nami-token',
            'business-cooperation': 'faq-en-business-cooperation',
        };

        let fetchTags = [];
        let targetSlugForFilter = null;
        if (category_slug && categorySlugMap[category_slug]) {
            targetSlugForFilter = categorySlugMap[category_slug];
            fetchTags.push(targetSlugForFilter);
        }
        // console.log("Các tag đang truyền vào fetchAllNamiFAQ:", fetchTags);
        let faqPosts = [];
        for (const tag of fetchTags) {
            const posts = await fetchAllNamiFAQ(tag);
            faqPosts.push(...posts);
        }
    // console.log("faqPosts:",fetchTags)
        // Xoá trùng (nếu có bài viết trùng giữa các tag)
        faqPosts = faqPosts.filter((post, index, self) =>
            index === self.findIndex(p => p.id === post.id)
        );
        //  console.log("faqPosts: ",faqPosts.length)
        if (!faqPosts || faqPosts.length === 0) {
            return { 
                error: (lang === 'vi') 
                    ? "Không tìm thấy bài viết hướng dẫn nào về onboarding." 
                    : "No onboarding guide articles found." 
            };
        }
        
        // Sau khi đã có faqPosts
        let sortedPosts = faqPosts;

        // Nếu có từ khóa, áp dụng fuzzy search với Fuse.js
        if (keyword && keyword.trim().length > 1) {
            const fuse = new Fuse(faqPosts, {
                includeScore: true,
                threshold: 0.35,
                ignoreLocation: true,
                keys: [
                    { name: 'title', weight: 0.5 },
                    { name: 'custom_excerpt', weight: 0.2 },
                    { name: 'html', weight: 0.1 },
                    { name: 'tags.name', weight: 0.2 },
                ],
            });

            const results = fuse.search(keyword.trim());
            sortedPosts = results.map(res => ({ ...res.item, _score: res.score }));

            // ✅ Boost nếu tiêu đề chứa từ khóa chính xác (exact match hoặc chứa cụm)
            const kwNorm = keyword.trim().toLowerCase();

            sortedPosts.sort((a, b) => {
                const boost = (post) => {
                    const title = (post.title || '').toLowerCase();
                    if (title === kwNorm) return -1000; // Ưu tiên cao nhất nếu tiêu đề trùng khớp hoàn toàn
                    if (title.includes(`(${kwNorm})`)) return -800; // Khớp trong ngoặc
                    if (title.includes(kwNorm)) return -500;        // Khớp nội dung
                    return 0; // không boost
                };

                const scoreA = (a._score || 1) + boost(a);
                const scoreB = (b._score || 1) + boost(b);
                return scoreA - scoreB; // sắp xếp tăng dần (score thấp là tốt hơn)
            });

            console.log("🔍 Fuzzy matched posts with boost:");
            sortedPosts.slice(0, 5).forEach(res => {
                console.log(`→ ${res.title} | score+boost: ${(res._score || 1).toFixed(3)}`);
            });
        }  
        //     let scoreA = 0;
        //     let scoreB = 0;

        //     // Category scoring
        //     const getCategoryScore = (post, slug) => {
        //         let score = 0;
        //         if (post.primary_tag && post.primary_tag.slug.toLowerCase() === slug) score += 100;
        //         if (post.tags.some(tag => tag.slug.toLowerCase() === slug)) score += 50;
        //         return score;
        //     };
            
        //     if (targetSlugForFilter) {
        //         scoreA += getCategoryScore(a, targetSlugForFilter);
        //         scoreB += getCategoryScore(b, targetSlugForFilter);
        //     }

        //     // Keyword relevance scoring
        //     const checkKeywordRelevance = (post, rawKeyword) => {
        //         let postScore = 0;
        //         const keyword = normalizeText(rawKeyword);
        //         const title = normalizeText(post.title || '');
        //         const htmlContent = normalizeText(post.html || '');
        //         const excerpt = normalizeText(post.excerpt || '');
        //         const tags = (post.tags || []).map(tag => normalizeText(tag.name));
        //         // Chia từ khóa thành các từ riêng lẻ để tìm kiếm chính xác hơn
        //         const keywords = keyword.split(/\s+/).filter(w => w.length > 2); // Chỉ xét từ có 3 ký tự trở lên
        //         // 1. Khớp chính xác tiêu đề
        //         if (title === keyword) postScore += 50; // Ưu tiên rất cao nếu tiêu đề khớp chính xác
        //         // 2. Kiểm tra sự xuất hiện của từng từ khóa
        //         keywords.forEach(kw => {
        //             if (title.includes(kw)) postScore += 15; // Mỗi từ trong tiêu đề
        //             if (excerpt.includes(kw)) postScore += 10; // Mỗi từ trong excerpt
        //             if (htmlContent.includes(kw)) postScore += 3; // Giảm trọng số cho nội dung HTML lớn
        //             if (tags.some(tag => tag.includes(kw))) postScore += 8; // Mỗi từ trong tags
        //         });

        //         // 3. Khớp cụm từ trong tiêu đề hoặc excerpt (quan trọng hơn)
        //         if (title.includes(keyword)) postScore += 20; // Nếu cả cụm từ có trong tiêu đề
        //         if (excerpt.includes(keyword)) postScore += 15; // Nếu cả cụm từ có trong excerpt

        //         // 4. Ưu tiên bài viết mới hơn nếu điểm tương đồng bằng nhau (sẽ được xử lý sau)

        //         return postScore;
        //     };


        //     if (keyword) {
        //         scoreA += checkKeywordRelevance(a, keyword);
        //         scoreB += checkKeywordRelevance(b, keyword);
        //     }


        //     // Final sorting
        //     if (scoreA !== scoreB) {
        //         return scoreB - scoreA;
        //     }
        //     return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        // });
        console.log("Sorted FAQ posts:", sortedPosts.map(p => p.title));

        if (faqPosts.length === 0) {
            return { 
                error: (lang === 'vi') 
                    ? `Không tìm thấy hướng dẫn nào phù hợp với yêu cầu của bạn${keyword ? ` (từ khóa "${keyword}")` : ''}${category_slug ? ` trong mục "${category_slug}"` : ''}. Vui lòng thử từ khóa khác hoặc hỏi chung.`
                    : `No guide found matching your request${keyword ? ` (keyword "${keyword}")` : ''}${category_slug ? ` in category "${category_slug}"` : ''}. Please try a different keyword or ask generally.`
            };
        }

        // Enhanced content extraction for different HTML structures
        const extractContentFromHtml = (htmlContent, lang) => {
            const $ = cheerio.load(htmlContent);
            const extractedContent = [];

            // Remove HTML comments and script tags
            $('<!--kg-card-begin: html-->').remove();
            $('<!--kg-card-end: html-->').remove();
            $('script').remove();

            // Extract structured content based on different HTML patterns
            const processElement = (elem) => {
                const $elem = $(elem);
                const tagName = $elem.get(0).tagName?.toLowerCase();
                const text = $elem.text().trim();

                if (!text || text.length < 10) return;

                switch (tagName) {
                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                    case 'h5':
                    case 'h6':
                        extractedContent.push({
                            type: 'heading',
                            level: parseInt(tagName.charAt(1)),
                            content: text
                        });
                        break;
                    
                    case 'p':
                        // Check for step patterns
                        const stepPatterns = [
                            /^(bước|step)\s*\d+\s*[:\-\.]/i,
                            /^(i{1,3}|iv|v|vi{1,3}|ix|x)\s*[\.\:]/i,
                            /^\d+[\.\)]\s*/,
                            /^(lưu ý|note|quan trọng|important)\s*[:\-]/i
                        ];
                        
                        const isStep = stepPatterns.some(pattern => pattern.test(text));
                        
                        if (isStep || text.length > 30) {
                            extractedContent.push({
                                type: isStep ? 'step' : 'paragraph',
                                content: text
                            });
                        }
                        break;
                    
                    case 'ul':
                    case 'ol':
                        const listItems = [];
                        $elem.find('li').each((i, li) => {
                            const liText = $(li).text().trim();
                            if (liText && liText.length > 5) {
                                listItems.push(liText);
                            }
                        });
                        
                        if (listItems.length > 0) {
                            extractedContent.push({
                                type: 'list',
                                ordered: tagName === 'ol',
                                items: listItems
                            });
                        }
                        break;
                    
                    case 'blockquote':
                        extractedContent.push({
                            type: 'quote',
                            content: text
                        });
                        break;
                }
            };

            // Process all relevant elements
            $('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote').each((i, elem) => {
                processElement(elem);
            });

            return extractedContent;
        };

        // Enhanced link extraction
        const extractLinksFromHtml = (htmlContent) => {
            const $ = cheerio.load(htmlContent);
            const links = [];
            const addedUrls = new Set();

            // Extract links from "More information" or "Thông tin thêm" sections
            const linkSectionSelectors = [
                'strong:contains("More information")',
                'strong:contains("Thông tin thêm")',
                'strong:contains("Additional resources")',
                'strong:contains("Tài liệu tham khảo")'
            ];

            linkSectionSelectors.forEach(selector => {
                $(selector).parent().nextAll('ul, ol').first().find('a').each((i, link) => {
                    const $link = $(link);
                    const href = $link.attr('href');
                    const text = $link.text().trim();
                    
                    if (href && text && !addedUrls.has(href)) {
                        const cleanUrl = href.replace(/\?ref=blog\.nami\.exchange$/, '');
                        links.push({ url: cleanUrl, text });
                        addedUrls.add(href);
                    }
                });
            });

            // Extract other relevant links
            $('a[href*="nami.exchange"]').each((i, link) => {
                const $link = $(link);
                const href = $link.attr('href');
                const text = $link.text().trim();
                
                if (href && text && text.length > 5 && !addedUrls.has(href)) {
                    const cleanUrl = href.replace(/\?ref=blog\.nami\.exchange$/, '');
                    if (!cleanUrl.includes('#') && !text.toLowerCase().includes('tại đây')) {
                        links.push({ url: cleanUrl, text });
                        addedUrls.add(href);
                    }
                }
            });

            return links;
        };

        // Enhanced image extraction
        // const extractImagesFromHtml = (htmlContent) => {
        //     const $ = cheerio.load(htmlContent);
        //     const images = [];
            
        //     $('img').each((i, img) => {
        //         const $img = $(img);
        //         const src = $img.attr('src');
        //         const alt = $img.attr('alt') || `Hình ảnh ${i + 1}`;
                
        //         if (src && src.startsWith('http')) {
        //             images.push({ url: src, alt });
        //         }
        //     });
            
        //     return images;
        // };

        // Generate enhanced summary
        let finalSummaryText = (lang === 'vi') 
            ? "**Dưới đây là thông tin và hướng dẫn từ Nami Exchange:**\n" 
            : "**Here is the information and guide from Nami Exchange:**\n";

        const maxArticlesToSummarize = 3;
        const postsToSummarize = sortedPosts.slice(0, Math.min(sortedPosts.length, maxArticlesToSummarize));

        
        let allLinks = [];
        let allImages = [];
        // let tags = fetchTags; 
        for (const post of postsToSummarize) {

            // const tags = fetchTags; 
            // const result = tags.split("-").slice(2).join("-");
            const postUrl = `${webUrlFaq}${category_slug}/${post.slug}`;
            
            finalSummaryText += `### ${post.title}\n\n`;
            
            // Add post excerpt if available
            const excerpt = (post.custom_excerpt || post.excerpt || '').trim();
                if (excerpt.length > 10) {
                    finalSummaryText += `**${excerpt}*\n\n`;
            }


            // Extract and format content
            const extractedContent = extractContentFromHtml(post.html, lang);
            let contentAdded = 0;
            const maxContentItems = 8;

            for (const item of extractedContent) {
                if (contentAdded >= maxContentItems) break;

                switch (item.type) {
                    case 'heading':
                        if (item.level <= 3) {
                            finalSummaryText += `${'#'.repeat(item.level + 1)} ${item.content}\n\n`;
                            contentAdded++;
                        }
                        break;
                    
                    case 'step':
                        finalSummaryText += `📋 **${item.content}**\n\n`;
                        contentAdded++;
                        break;
                    
                    case 'paragraph':
                        if (item.content.length > 20) {
                            finalSummaryText += `${item.content}\n\n`;
                            contentAdded++;
                        }
                        break;
                    
                    case 'list':
                        if (item.items.length > 0) {
                            item.items.slice(0, 5).forEach(listItem => {
                                finalSummaryText += `• ${listItem}\n`;
                            });
                            finalSummaryText += '\n';
                            contentAdded++;
                        }
                        break;
                    
                    case 'quote':
                        finalSummaryText += `> ${item.content}\n\n`;
                        contentAdded++;
                        break;
                }
            }

            // Extract links and images
            const postLinks = extractLinksFromHtml(post.html);
            // const postImages = extractImagesFromHtml(post.html);
            
            allLinks.push(...postLinks);
            // allImages.push(...postImages);

            // Add link to the full article
            finalSummaryText += `[📖 Đọc bài viết đầy đủ](${postUrl})\n\n`;
            finalSummaryText += '---\n\n';
        }

        // Add related links section
        if (allLinks.length > 0) {
            finalSummaryText += (lang === 'vi') 
                ? "## 🔗 Liên kết liên quan\n\n" 
                : "## 🔗 Related Links\n\n";
            
            // Remove duplicates and limit links
            const uniqueLinks = allLinks.filter((link, index, self) => 
                self.findIndex(l => l.url === link.url) === index
            ).slice(0, 10);
            
            uniqueLinks.forEach(link => {
                finalSummaryText += `• [${link.text}](${link.url})\n`;
            });
            finalSummaryText += '\n';
        }

        // Add general resource links
        const generalLinks = [
            { slug: 'tutorials', vi: 'Tổng hợp hướng dẫn cơ bản', en: 'Basic Tutorials Collection' },
            { slug: 'account-functions', vi: 'Chức năng tài khoản', en: 'Account Functions' },
            { slug: 'deposit-withdraw', vi: 'Hướng dẫn Nạp/Rút tiền', en: 'Deposit/Withdrawal Guide' },
            { slug: 'spot-trading', vi: 'Giao dịch Spot', en: 'Spot Trading' },
            { slug: 'futures-trading', vi: 'Giao dịch Futures', en: 'Futures Trading' }
        ];

        finalSummaryText += (lang === 'vi') 
            ? "## 📚 Tài nguyên hữu ích khác\n\n" 
            : "## 📚 Other Useful Resources\n\n";
        
        generalLinks.forEach(link => {
            const title = lang === 'vi' ? link.vi : link.en;
            finalSummaryText += `• [${title}](${webUrlFaq}${link.slug})\n`;
        });

        

        // Add footer
        finalSummaryText += (lang === 'vi') 
            ? "\n---\n\n💡 **Cần hỗ trợ thêm?** Truy cập [Trung tâm hỗ trợ Nami Exchange](https://nami.exchange/vi/support) hoặc liên hệ team hỗ trợ 24/7.\n\n"
            : "\n---\n\n💡 **Need more help?** Visit [Nami Exchange Support Center](https://nami.exchange/en/support) or contact our 24/7 support team.\n\n";
        
        finalSummaryText += `[🏠 ${lang === 'vi' ? 'Trang chủ FAQ' : 'FAQ Homepage'}](${webUrlFaq})`;

        // const uniqueLines = new Set();
        // const cleanedParagraphs = finalSummaryText
        // .split('\n')
        // .map(line => line.trim())
        // .filter(line => {
        //     if (!line || line === '•') return false;
        //     const isDuplicate = uniqueLines.has(line);
        //     if (!isDuplicate) uniqueLines.add(line);
        //     return !isDuplicate;
        // });


        return {
            source: "Nami FAQ",
            summary: finalSummaryText,
            posts_count: postsToSummarize.length,
            total_found: sortedPosts.length
        };

    } catch (error) {
        console.error(`Lỗi khi lấy hướng dẫn onboarding:`, error.response?.data || error.message);
        return { 
            error: (lang === 'vi') 
                ? "Không thể lấy hướng dẫn onboarding lúc này. Vui lòng thử lại sau." 
                : "Unable to retrieve onboarding guide at this time. Please try again later." 
        };
    }
}

// get_nami_onboarding_guide('vi', 'mã giới thiệu', 'chuc-nang-tai-khoan').then(r=> console.log(r))

// keyword: 'mã giới thiệu', category_slug: 'chuc-nang-tai-khoan'
// const availableFunctions = {
//     get_nami_token_info,
//     get_nami_blog_posts,
//     get_user_portfolio_performance,
//     create_nami_alert,
//     update_nami_notification_setting,
//     get_nami_onboarding_guide
// };
// get_user_portfolio_performance('en').then(r=>console.log(r))
// get_nami_onboarding_guide('vi', 'KYC', 'chuc-nang-tai-khoan').then(r=>console.log(r))
// get_nami_onboarding_guide('vi','daily Stacking','daily-staking-en').then(r=>console.log(r))
module.exports = {
  get_nami_token_info,
  get_user_portfolio_performance,
  get_nami_blog_posts,
  get_nami_onboarding_guide,
  create_nami_alert,
  update_nami_notification_setting
 };