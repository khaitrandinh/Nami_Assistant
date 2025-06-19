// test_create_alert.js
require('dotenv').config(); // Tải biến môi trường từ .env
const { create_nami_alert } = require('./test'); // Import hàm cần test

// Cấu hình các biến môi trường cần thiết (đảm bảo chúng có trong .env của bạn)
const NAMI_USER_AUTH_TOKEN = process.env.NAMI_USER_AUTH_TOKEN; // ID người dùng Nami để xác thực

async function runTestAlerts() {
    console.log("--- Bắt đầu kiểm tra hàm create_nami_alert ---");

    if (!NAMI_USER_AUTH_TOKEN) {
        console.error("Lỗi: NAMI_USER_AUTH_TOKEN không được cấu hình trong .env. Vui lòng cấu hình trước khi test.");
        return;
    }

    // Test Case 1: PRICE_DROPS_TO (Giá giảm xuống dưới)
    console.log("\n--- Test 1: BTC giảm xuống dưới $90,000 (Tiếng Việt, chỉ 1 lần) ---");
    try {
        const result1 = await create_nami_alert(
            'PRICE_DROPS_TO',
            ['BTC'],
            'USDT',
            'SPOT',
            '90000', // value là string
            null, null, 'ONLY_ONCE', 'vi'
        );
        console.log("Kết quả Test 1:", JSON.stringify(result1, null, 2));
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 1:", error.message);
    }

    // Test Case 2: PRICE_RISES_ABOVE (Giá tăng lên trên)
    console.log("\n--- Test 2: ETH tăng trên $3500 (Tiếng Anh, luôn luôn) ---");
    try {
        const result2 = await create_nami_alert(
            'PRICE_RISES_ABOVE',
            ['ETH'],
            'USDT',
            'SPOT',
            '3500', // value là string
            null, null, 'ALWAYS', 'en'
        );
        console.log("Kết quả Test 2:", JSON.stringify(result2, null, 2));
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 2:", error.message);
    }

    // Test Case 3: DAY_CHANGE_IS_OVER (Biến động 24h tăng trên %)
    console.log("\n--- Test 3: SOL biến động 24h tăng trên 5% (Tiếng Anh, 1 lần/ngày) ---");
    try {
        const result3 = await create_nami_alert(
            'DAY_CHANGE_IS_OVER',
            ['SOL'],
            'USDT',
            'SPOT',
            '0.05', // value là string, 0.05 cho 5%
            null, null, 'ONCE_A_DAY', 'en'
        );
        console.log("Kết quả Test 3:", JSON.stringify(result3, null, 2));
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 3:", error.message);
    }

    // Test Case 4: DURATION_CHANGE (Biến động trong khoảng 'interval' tăng hoặc giảm)
    console.log("\n--- Test 4: BNB biến động 10% trong 4 giờ (Tiếng Việt, chỉ 1 lần) ---");
    try {
        const result4 = await create_nami_alert(
            'DURATION_CHANGE',
            ['BNB'],
            'USDT',
            'NAO_FUTURES',
            null, // value là null
            10, // percentage_change là số (10 cho 10%)
            4, // interval là số (4 giờ)
            'ONLY_ONCE', 'vi'
        );
        console.log("Kết quả Test 4:", JSON.stringify(result4, null, 2));
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 4:", error.message);
    }

    // Test Case 5: Cảnh báo nhiều tài sản (Giả định API Nami hỗ trợ multi-asset cho loại này)
    console.log("\n--- Test 5: BTC và ETH giảm xuống dưới $100,000 (Tiếng Việt, 1 lần/ngày) ---");
    try {
        const result5 = await create_nami_alert(
            'PRICE_DROPS_TO',
            ['BTC', 'ETH'], // Mảng base_assets
            'USDT',
            'SPOT',
            '100000', // value là string
            null, null, 'ONCE_A_DAY', 'vi'
        );
        console.log("Kết quả Test 5:", JSON.stringify(result5, null, 2));
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 5:", error.message);
    }


    console.log("\n--- Hoàn tất kiểm tra hàm create_nami_alert ---");
}

runTestAlerts();