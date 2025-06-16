// server.js
const express = require('express');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(express.json());

let namiAssetIdMap = {};
// console.log("URL",process.env.NAMI_CONFIG_API_BASE_URL)


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

get_nami_token_info('xrp').then(r =>console.log(r));


