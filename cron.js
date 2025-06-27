// cron.js
const cron = require("node-cron");
const { exec } = require("child_process");
require('dotenv').config();
// Schedule: mỗi ngày lúc 00:00 (giờ VN)
cron.schedule("39 14 * * *", () => {
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  console.log(`🔄 [${now}] Rebuild Binance Academy KB bắt đầu...`);

  exec("node utils/rebuild-academy-kb.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [${now}] Lỗi khi rebuild:`, error.message);
      return;
    }
    if (stderr) {
      console.warn(`⚠️ [${now}] Stderr:`, stderr.trim());
    }
    console.log(`✅ [${now}] Rebuild hoàn thành:\n${stdout.trim()}`);
  });
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});

console.log("⏰ Cron job đã được khởi động: sẽ chạy mỗi ngày lúc 14:15 (giờ VN).");
