// server.js
const express = require('express');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(express.json());

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


async function get_nami_token_info(token_symbol) {
    const namiId = await get_nami_asset_id(token_symbol);
    if (!namiId) {
        return { error: `Không tìm thấy ID Nami cho token ${token_symbol}.` };
    }
    try {
        const response = await axios.get(`${process.env.NAMI_SPOT_API_BASE_URL}`, {
            params: { id: namiId }
        });
        const assetInfoData = response.data.data; 

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
                cmc_rank: assetInfoData.cmc_rank 
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
            summaryString += `**Mục đích/Trường hợp sử dụng:** ${formattedData.use_case_summary}\n\n`;
        }

        // 2. Dữ liệu thị trường
        if (formattedData.market_data && formattedData.market_data.current_price_usd) {
            summaryString += `Dữ liệu thị trường hiện tại:\n`;
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
            summaryString += `Tokenomics:\n`;
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
            summary: summaryString, // TRẢ VỀ CHUỖI TÓM TẮT ĐỂ GEMINI DỄ DÙNG
            full_data_extracted: formattedData // Dữ liệu đầy đủ đã được trích xuất (để debug nếu cần)
        };

    } catch (error) {
        console.error(`Lỗi khi lấy thông tin token Nami cho ${token_symbol} (ID: ${namiId}):`, error.response?.data || error.message);
        return { error: `Không thể lấy thông tin token ${token_symbol} từ Nami. Vui lòng kiểm tra lại mã token hoặc thử lại sau.` };
    }
}

// get_nami_token_info('xrp').then(r =>console.log(r));
// console.log("NAMI_USER_AUTH_TOKEN",process.env.NAMI_USER_AUTH_TOKEN)

async function get_nami_token_symbol(assetId) {
    if (namiAssetIdMap[assetId]) {
        return namiAssetIdMap[assetId];
    }
    try {
        const response = await axios.get(`${process.env.NAMI_CONFIG_API_BASE_URL_TEST}/asset/config`);
        
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

// get_nami_token_symbol(1).then(r=>console.log(r))


async function get_user_portfolio_performance(lang = 'vi') {
    console.log(`Lấy hiệu suất portfolio: lang=${lang}`);
    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return { error: (lang === 'vi') ? "Không thể truy cập dữ liệu portfolio. Vui lòng cung cấp token xác thực." : "Cannot access portfolio data. Authentication token is missing." };
        }

        const portfolioResponse = await axios.get(`${process.env.NAMI_PORTFOLIO_API_BASE_URL}/api/v3/metric/spot-statistic/portfolio-assets?baseCurrency=39`, {
            headers: {
                'fakeauthorization': `${process.env.NAMI_USER_AUTH_TOKEN}`
            },
        });
        const portfolioData = portfolioResponse.data.data; 

        if (!portfolioData || portfolioData.length === 0) {
            return { error: (lang === 'vi') ? "Danh mục đầu tư của bạn trống hoặc không có dữ liệu." : "Your portfolio is empty or no data available." };
        }

        let totalPortfolioValue = 0; 
        let totalPurchaseCost = 0;
        let assetDetails = []; 

        for (const asset of portfolioData) {
            const assetId = asset.assetId; 
            const amount = parseFloat(asset.totalAmount);
            const avgPrice = parseFloat(asset.avgPrice);
            const totalQuoteBuy = parseFloat(asset.totalQuoteBuy);
            const totalQuoteSell = parseFloat(asset.totalQuoteSell);
            
            if (amount <= 0 && totalQuoteBuy === 0 && totalQuoteSell === 0) continue; 

            const symbol_name = await get_nami_token_symbol(assetId);
            if (!symbol_name) {
                console.warn(`Không tìm thấy symbol cho assetId ${assetId}. Bỏ qua tài sản này.`);
                continue;
            }

            let currentPrice = 0;
            let priceChange24hPercent = 0; 
            
            const quoteCurrency = 'VNST'; 
            const marketWatchSymbol = `${symbol_name}${quoteCurrency}`; 

            if (['VNSTVNST'].includes(marketWatchSymbol.toUpperCase())) {
                currentPrice = 1; 
            } else {
                try {
                    const marketWatchResponse = await axios.get(`${process.env.NAMI_SPOT_API_MARKET_WATCH}`, {
                        params: { symbol: marketWatchSymbol }
                    });
                    const rawMarketData = marketWatchResponse.data.data;
                    const matchedSymbolData = rawMarketData.find(item => item.s === marketWatchSymbol);

                    if (matchedSymbolData && matchedSymbolData.p) { 
                        currentPrice = parseFloat(matchedSymbolData.p);
                        priceChange24hPercent = parseFloat(matchedSymbolData.lh || matchedSymbolData.c || 0); 
                    }
                } catch (marketWatchError) {
                    console.warn(`Lỗi khi lấy giá market_watch cho ${symbol_name}:`, marketWatchError.response?.data || marketWatchError.message);
                }
            }
            console.log(currentPrice)
            const assetCurrentValue = currentPrice * amount;
            const pnl = assetCurrentValue + totalQuoteSell - totalQuoteBuy;
            const pnlPercent = (totalQuoteBuy > 0) ? (pnl / totalQuoteBuy) * 100 : 0;
            console.log(`${symbol_name}current`,assetCurrentValue)
            totalPortfolioValue += assetCurrentValue;
            totalPurchaseCost += totalQuoteBuy; 
            // console.log("totalPortfolioValue", totalPortfolioValue);
            // console.log("totalPurchaseCost", totalPurchaseCost);
            assetDetails.push({
                symbol: symbol_name,
                amount: amount,
                current_price: currentPrice,
                pnl_value: pnl,
                pnl_percent: pnlPercent,
                price_change_24h_percent: priceChange24hPercent,
            });
        }

        let totalCurrentValueForAllocation = 0;
        assetDetails.forEach(asset => totalCurrentValueForAllocation += asset.current_price * asset.amount);

        assetDetails.forEach(asset => {
            if (totalCurrentValueForAllocation > 0) {
                asset.allocation_percent = ((asset.current_price * asset.amount) / totalCurrentValueForAllocation) * 100;
            } else {
                asset.allocation_percent = 0;
            }
        });

        const totalPnL = totalPortfolioValue - totalPurchaseCost;
        const totalPnLPercent = (totalPurchaseCost > 0) ? (totalPnL / totalPurchaseCost) * 100 : 0;

        let responseSummary = (lang === 'vi') ? `**Tổng quan danh mục đầu tư của bạn (tính bằng VNST):**\n\n` : `**Your Portfolio Overview (in VNST):**\n\n`;
        responseSummary += (lang === 'vi') ? `- Bạn đang nắm giữ ${assetDetails.length} loại tài sản.\n` : `- You are holding ${assetDetails.length} assets.\n`;
        responseSummary += (lang === 'vi') ? `- Tổng giá trị hiện tại: ${totalPortfolioValue.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' })}\n` : `- Total current value: ${totalPortfolioValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
        responseSummary += (lang === 'vi') ? `- Tổng lợi nhuận/thua lỗ (PnL): ${totalPnLPercent.toFixed(2)}% (${totalPnL.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' })})\n\n` : `- Total PnL: ${totalPnLPercent.toFixed(2)}% (${totalPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})\n\n`;

        responseSummary += (lang === 'vi') ? `**Tỷ lệ phân bổ tài sản:**\n` : `**Asset Allocation:**\n`;
        assetDetails.sort((a, b) => b.allocation_percent - a.allocation_percent)
                    .forEach(asset => {
                        responseSummary += `- ${asset.symbol}: ${asset.allocation_percent.toFixed(2)}%\n`;
                    });
        responseSummary += `\n`;


        responseSummary += (lang === 'vi') ? `**Hiệu suất tài sản chính (24h):**\n` : `**Key Asset Performance (24h):**\n`; 
        assetDetails.sort((a, b) => b.pnl_percent - a.pnl_percent) 
                    .slice(0, 10) 
                    .forEach(asset => {
            const emoji = asset.pnl_percent > 0 ? '📈' : (asset.pnl_percent < 0 ? '📉' : '↔️');
            responseSummary += `- ${asset.symbol}: ${asset.pnl_percent.toFixed(2)}% ${emoji} (thay đổi 24h: ${asset.price_change_24h_percent.toFixed(2)}%)\n`;
        });
        responseSummary += `\n`;

        responseSummary += (lang === 'vi') ? `Lưu ý: Hiệu suất được tính dựa trên dữ liệu 24h gần nhất và giá trị mua/bán từ lịch sử giao dịch. Thông tin về xu hướng giá theo tuần/tháng hiện không khả dụng. Để có thông tin chi tiết hơn, vui lòng kiểm tra Nami Exchange.\n` : `Note: Performance calculated based on latest 24h data and buy/sell values from trade history. Weekly/monthly price trend information is not currently available. For more detailed information, please check Nami Exchange.\n`;

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
            return { error: (lang === 'vi') ? "Lỗi xác thực: Vui lòng đảm bảo token API người dùng hợp lệ." : "Authentication error: Please ensure valid user API token is provided." };
        }
        return { error: (lang === 'vi') ? `Không thể lấy dữ liệu portfolio của bạn lúc này. Vui lòng kiểm tra lại token xác thực hoặc thử lại sau.` : `Cannot retrieve your portfolio data at this time. Please check authentication token or try again later.` };
    }
}

get_user_portfolio_performance().then(r=>console.log(r))


const availableFunctions = {
    get_nami_token_info,
    get_user_portfolio_performance
    
};

module.exports = availableFunctions;