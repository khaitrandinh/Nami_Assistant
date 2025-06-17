async function get_user_portfolio_performance(lang = 'vi') {
    // console.log(`Lấy hiệu suất portfolio: base_currency=${base_currency}, time_period=${time_period}, lang=${lang}`);
    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return { error: (lang === 'vi') ? "Không thể truy cập dữ liệu portfolio. Vui lòng cung cấp token xác thực." : "Cannot access portfolio data. Authentication token is missing." };
        }

        // 1. Lấy dữ liệu portfolio từ Nami
        const portfolioResponse = await axios.get(`${process.env.NAMI_PORTFOLIO_API_BASE_URL}/api/v3/metric/spot-statistic/portfolio-assets?baseCurrency=72`, {
            headers: {
                'fakeauthorization': `${process.env.NAMI_USER_AUTH_TOKEN}` // Giả định Bearer token
            },
            // params: {
            //     baseCurrency: base_currency,
            //     page: 1, // Lấy trang đầu tiên, có thể cần phân trang nếu portfolio lớn
            //     limit: 100 // Tăng giới hạn nếu có nhiều tài sản
            // }
        });
        const portfolioData = portfolioResponse.data.data; // Dữ liệu nằm trong response.data.data
        // console.log("portfo:",portfolioData)

        if (!portfolioData || portfolioData.length === 0) {
            return { error: (lang === 'vi') ? "Danh mục đầu tư của bạn trống hoặc không có dữ liệu." : "Your portfolio is empty or no data available." };
        }

        let totalPortfolioValue = 0; // Tổng giá trị hiện tại của portfolio
        let totalPurchaseCost = 0;   // Tổng chi phí mua ban đầu
        let assetDetails = [];       // Chi tiết từng tài sản

        // 2. Lặp qua từng tài sản, lấy giá hiện tại và tính toán
        for (const asset of portfolioData) {
            const assetId = asset.assetId; 
            const amount = asset.totalAmount;
            const avgPrice = asset.avgPrice; // Giá mua trung bình
            const totalQuoteBuy = asset.totalQuoteBuy;
            const totalQuoteSell = asset.totalQuoteSell;
            
            if (amount <= 0) continue; // Bỏ qua tài sản không nắm giữ

            let currentPrice = 0;
            let priceChangePercent = 0; // Thay đổi giá % (24h mặc định)
            const symbol_name = await get_nami_token_symbol(assetId);
            const marketWatchSymbol = `${symbol_name}${asset.quoteCurrency || 'VNST'}`;
            // console.log(assetId)
            if (['VNSTVNST', 'USDTVNST'].includes(marketWatchSymbol)) {
                // console.log(`Bỏ qua lấy giá cho cặp ${marketWatchSymbol}`);
                continue;
            } else {
                try {
                    const coinId = assetId; 
                    if (coinId) {
                        const priceResponse = await axios.get(`${process.env.NAMI_SPOT_API_MARKET_WATCH}`, {
                            params: {
                                symbol: marketWatchSymbol
                            }
                        });
                        // console.log(priceResponse.data)
                        const rawMarketData = priceResponse.data.data;
                        const matchedSymbolData = rawMarketData.find(item => item.s === marketWatchSymbol);
                        // console.log("rawMarketData",matchedSymbolData.p)
                        if (matchedSymbolData  && matchedSymbolData .p) { 
                        marketDataFromNami = {
                            current_price_usd: parseFloat(matchedSymbolData.p),
                            high_24h_usd: parseFloat(matchedSymbolData.h),
                            low_24h_usd: parseFloat(matchedSymbolData.l),
                        };
                        } else {
                            console.warn(`Không tìm thấy dữ liệu thị trường hợp lệ (trường 'p') từ market_watch cho ${marketWatchSymbol}.`);
                        }
                    }
                } catch (priceError) {
                    console.warn(`Không thể lấy giá hiện tại cho ${symbol_name} từ Nami:`, priceError.message);
                    // currentPrice sẽ vẫn là 0, ảnh hưởng đến tính toán
                }
            }
            console.log("Giá hiện tại",marketDataFromNami)
            // const assetCurrentValue = currentPrice * amount;
            // const assetPurchaseCost = avgPrice * amount;
            // const pnl = assetCurrentValue - assetPurchaseCost;
            // const pnlPercent = (assetPurchaseCost > 0) ? (pnl / assetPurchaseCost) * 100 : 0;
            // console.log(symbol_name,assetId,amount,avgPrice,totalQuoteBuy,totalQuoteSell)
            
            const  pnl = (amount * marketDataFromNami.current_price_usd) + totalQuoteSell - totalQuoteBuy ;
            const pnl_percent = ((pnl/totalQuoteBuy)*100).toFixed(2);
            // console.log(`PNL của ${symbol_name}`, pnl)
            // console.log(`PNL percent của ${symbol_name}`, pnl_percent.toFixed(2))

            // totalPortfolioValue += assetCurrentValue; //    
            // totalPurchaseCost += assetPurchaseCost;
            
            assetDetails.push({
                symbol: symbol_name,
                amount: amount,
                current_price: marketDataFromNami.current_price_usd,
                pnl_percent: pnl_percent,
                // price_change_24h_percent: priceChangePercent
            });
        }
        console.log(assetDetails)
        // // 3. Tính toán tổng PnL cho portfolio
        // const totalPnL = totalPortfolioValue - totalPurchaseCost;
        // const totalPnLPercent = (totalPurchaseCost > 0) ? (totalPnL / totalPurchaseCost) * 100 : 0;

        // 4. Tổng hợp thông tin
        let responseSummary = (lang === 'vi') ? `**Tổng quan danh mục đầu tư của bạn:**\n\n` : `**Your Portfolio Overview:**\n\n`;
        responseSummary += (lang === 'vi') ? `- Bạn đang nắm giữ ${assetDetails.length} tài sản.\n` : `- You are holding ${assetDetails.length} assets.\n`;
        responseSummary += (lang === 'vi') ? `- Tổng giá trị hiện tại: ${totalPortfolioValue.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' })}\n` : `- Total current value: ${totalPortfolioValue.toLocaleString('en-US', { style: 'currency', currency: 'VND' })}\n`;
        responseSummary += (lang === 'vi') ? `- Tổng lợi nhuận/thua lỗ (PnL): ${totalPnLPercent.toFixed(2)}% (${totalPnL.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND' })})\n\n` : `- Total PnL: ${totalPnLPercent.toFixed(2)}% (${totalPnL.toLocaleString('en-US', { style: 'currency', currency: 'VND' })})\n\n`;

        responseSummary += (lang === 'vi') ? `**Hiệu suất tài sản chính (24h):**\n` : `**Key Asset Performance (24h):**\n`;
        assetDetails.sort((a, b) => b.pnl_percent - a.pnl_percent) // Sắp xếp theo PnL
                    .slice(0, 5) // Chỉ hiển thị 5 tài sản hàng đầu
                    .forEach(asset => {
            const emoji = asset.pnl_percent > 0 ? '🚀' : (asset.pnl_percent < 0 ? '📉' : '↔️');
            responseSummary += `- ${asset.symbol}: ${asset.pnl_percent.toFixed(2)}% ${emoji} (thay đổi 24h: ${asset.price_change_24h_percent.toFixed(2)}%)\n`;
        });
        responseSummary += `\n`;

        responseSummary += (lang === 'vi') ? `Lưu ý: Hiệu suất được tính dựa trên dữ liệu 24h gần nhất. Để có thông tin chi tiết hơn, vui lòng kiểm tra Nami Exchange.\n` : `Note: Performance calculated based on latest 24h data. For more detailed information, please check Nami Exchange.\n`;

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
        // Kiểm tra lỗi 401 Unauthorized
        if (error.response && error.response.status === 401) {
            return { error: (lang === 'vi') ? "Lỗi xác thực: Vui lòng đảm bảo token API người dùng hợp lệ." : "Authentication error: Please ensure valid user API token is provided." };
        }
        return { error: (lang === 'vi') ? `Không thể lấy dữ liệu portfolio của bạn lúc này. Vui lòng kiểm tra lại token xác thực hoặc thử lại sau.` : `Cannot retrieve your portfolio data at this time. Please check authentication token or try again later.` };
    }
}