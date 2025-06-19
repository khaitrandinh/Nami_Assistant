// apiHandlers.js
const axios = require('axios');
require('dotenv').config();
const { convert } = require('html-to-text');


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
const baseUrl = process.env.NAMI_PORTFOLIO_API_BASE_URL || 'https://test.nami.exchange';

    console.log("Headers được gửi:", {
        fakeauthorization: process.env.NAMI_USER_AUTH_TOKEN,
        URL: process.env.NAMI_PORTFOLIO_API_BASE_URL,
        // cookie: req?.headers?.cookie || 'Không có cookie'
        });
    console.log("👉 Base URL used:", baseUrl);

    console.log("Đang lấy api")
    let baseCurrency;
    if (nameCurrency === 'VNST') {
        baseCurrency = 39;
    } else {
        baseCurrency = 22;
    }

    console.log(`Lấy hiệu suất portfolio: lang=${lang}, baseCurrency=${baseCurrency}`);

    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return {
                error: (lang === 'vi')
                    ? "Không thể truy cập dữ liệu portfolio. Vui lòng cung cấp token xác thực."
                    : "Cannot access portfolio data. Authentication token is missing."
            };
        }

        const portfolioResponse = await axios.get(
            `${process.env.NAMI_TEST_API_BASE_URL}/api/v3/metric/spot-statistic/portfolio-assets?baseCurrency=${baseCurrency}`,
            {
                headers: {
                    'fakeauthorization': `${process.env.NAMI_USER_AUTH_TOKEN}` || '18',
                    'Host': `test.nami.exchange`
                },
                _hearders:{
                    'Host': `test.nami.exchange`
                }
            }
        );
        console.log(portfolioResponse)
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
                    const marketWatchResponse = await axios.get(`${process.env.NAMI_SPOT_API_MARKET_WATCH}`, {
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

// get_nami_notification_setting_internal('vi').then(r=> console.log(r))
// Hàm để cập nhật cài đặt thông báo của người dùng
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


// MODIFIED: create_nami_alert sẽ tự động kiểm tra và gợi ý
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
    if (alert_type.includes('PRICE')) {
        const currencySymbol = (quote_asset === 'USDT') ? '$' : ((quote_asset === 'VNST') ? ' VNST' : '');
        valueDisplay = `${currencySymbol}${value}`;
    } else if (alert_type.includes('CHANGE') || alert_type.includes('DURATION')) {
        valueDisplay = `${percentage_change}%`;
    }
    if (interval !== null && (alert_type.includes('DURATION'))) {
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

    if (value !== null) {
        payload.value = String(value);
    }
    if (percentage_change !== null) {
        payload.percentage_change = percentage_change;
    }
    if (interval !== null) {
        payload.interval = interval;
    }

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

            // NEW: Kiểm tra cài đặt thông báo sau khi tạo cảnh báo thành công
            const notificationSetting = await get_nami_notification_setting_internal(lang);
            // console.log(notificationSetting)
            if (notificationSetting.success) {
                const deviceNotiStatus = notificationSetting.useDeviceNoti;
                const emailNotiStatus = notificationSetting.emailNoti.includes("@")? true :false;
                
                // console.log("emailNotiStatus",deviceNotiStatus)
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
                    ask_to_enable_notifications: (!deviceNotiStatus || !emailNotiStatus) // Cờ để Gemini biết gợi ý bật
                };
            } else {
                console.warn("Không thể kiểm tra cài đặt thông báo sau khi tạo cảnh báo:", notificationSetting.error);
                return {
                    success: true,
                    message: `${initialMessage} ${(lang === 'vi') ? `Bạn có thể quản lý cảnh báo trong Cài đặt Thông báo.` : `You can manage alerts in your Notification Settings.`}`
                };
            }
        } else {
            const errorMessageKey = response.data.error;
            let errorMessage = (lang === 'vi') ? "Đã xảy ra lỗi khi tạo cảnh báo." : "An error occurred while creating the alert.";
            switch(errorMessageKey) {
                case 'INVALID_MAX_ALERT': errorMessage = (lang === 'vi') ? "Bạn đã đạt giới hạn 50 cảnh báo." : "You have reached the maximum of 50 alerts."; break;
                case 'INVALID_MAX_ALERT_PER_PAIR': errorMessage = (lang === 'vi') ? "Bạn đã đạt giới hạn 10 cảnh báo cho cặp này." : "You have reached the maximum of 10 alerts for this pair."; break;
                case 'BODY_MISSING': errorMessage = (lang === 'vi') ? "Thiếu thông tin cần thiết để tạo cảnh báo." : "Missing required information to create alert."; break;
                case 'INVALID_PRICE': errorMessage = (lang === 'vi') ? "Giá trị ngưỡng không hợp lệ." : "Invalid threshold value."; break;
                case 'INVALID_INTERVAL': errorMessage = (lang === 'vi') ? "Khoảng thời gian không hợp lệ. Chỉ chấp nhận các giá trị: 1, 4, 8, 12, 24 giờ." : "Invalid interval. Only accepts: 1, 4, 8, 12, 24 hours."; break;
                default: errorMessage += ` (${errorMessageKey})`;
            }
            return { error: errorMessage };
        }

    } catch (error) {
        console.error(`Lỗi khi gọi API tạo cảnh báo:`, error.response?.data || error.message);
        const apiError = error.response?.data;
        let userFacingError = (lang === 'vi') ? `Không thể tạo cảnh báo lúc này. Vui lòng thử lại sau.` : `Unable to create alert at this time. Please try again later.`;
        if (apiError && apiError.message && typeof apiError.message === 'string') {
            userFacingError = (lang === 'vi') ? `Lỗi: ${apiError.message}` : `Error: ${apiError.message}`;
        }
        return { error: userFacingError };
    }
}



const availableFunctions = {
    get_nami_token_info,
    get_nami_blog_posts,
    get_user_portfolio_performance,
    create_nami_alert,
    update_nami_notification_setting
};

module.exports = availableFunctions;