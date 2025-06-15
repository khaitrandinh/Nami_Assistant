// test_nami_blog_api.js
require('dotenv').config(); // Tải biến môi trường từ .env

// Import hàm cần test
const { get_nami_blog_posts } = require('./testGhost');

async function runTest() {
    console.log("--- Bắt đầu kiểm tra hàm get_nami_blog_posts ---");

    // Test 1: Lấy các bài đăng mới nhất (latest)
    console.log("\n--- Test 1: Lấy 3 bài đăng mới nhất ---");
    try {
        const result1 = await get_nami_blog_posts('latest');
        console.log("Kết quả Test 1 (latest):", JSON.stringify(result1, null, 2));
        if (result1.error) {
            console.error("Lỗi Test 1:", result1.error);
        } else if (result1.posts && result1.posts.length > 0) {
            console.log(`Tìm thấy ${result1.posts.length} bài đăng mới nhất.`);
        } else {
            console.log("Không tìm thấy bài đăng nào.");
        }
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 1:", error.message);
    }

    // Test 2: Lấy các sự kiện (events)
    console.log("\n--- Test 2: Lấy các bài đăng Sự kiện ---");
    try {
        const result2 = await get_nami_blog_posts('events');
        console.log("Kết quả Test 2 (events):", JSON.stringify(result2, null, 2));
        if (result2.error) {
            console.error("Lỗi Test 2:", result2.error);
        } else if (result2.posts && result2.posts.length > 0) {
            console.log(`Tìm thấy ${result2.posts.length} bài đăng sự kiện.`);
        } else {
            console.log("Không tìm thấy bài đăng sự kiện nào.");
        }
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 2:", error.message);
    }

    // Test 3: Lấy các bài niêm yết mới (new_listing)
    console.log("\n--- Test 3: Lấy các bài niêm yết mới ---");
    try {
        const result3 = await get_nami_blog_posts('new_listing');
        console.log("Kết quả Test 3 (new_listing):", JSON.stringify(result3, null, 2));
        if (result3.error) {
            console.error("Lỗi Test 3:", result3.error);
        } else if (result3.posts && result3.posts.length > 0) {
            console.log(`Tìm thấy ${result3.posts.length} bài đăng niêm yết mới.`);
        } else {
            console.log("Không tìm thấy bài đăng niêm yết mới nào.");
        }
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 3:", error.message);
    }

    // Test 4: Lấy bài đăng theo từ khóa (keyword)
    console.log("\n--- Test 4: Lấy bài đăng theo từ khóa 'HOME' ---");
    try {
        const result4 = await get_nami_blog_posts('latest', 'HOME'); // Hoặc 'Defi App'
        console.log("Kết quả Test 4 (keyword 'HOME'):", JSON.stringify(result4, null, 2));
        if (result4.error) {
            console.error("Lỗi Test 4:", result4.error);
        } else if (result4.posts && result4.posts.length > 0) {
            console.log(`Tìm thấy ${result4.posts.length} bài đăng liên quan đến 'HOME'.`);
        } else {
            console.log("Không tìm thấy bài đăng nào với từ khóa 'HOME'.");
        }
    } catch (error) {
        console.error("Lỗi nghiêm trọng trong Test 4:", error.message);
    }

    console.log("\n--- Hoàn tất kiểm tra hàm get_nami_blog_posts ---");
}

runTest();