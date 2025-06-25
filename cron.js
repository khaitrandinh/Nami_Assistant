// cron.js
const cron = require("node-cron");
const { exec } = require("child_process");

cron.schedule("0 0 * * *", () => {
    console.log("🔄 Rebuild Binance Academy KB...");
    exec("npx tsx utils/rebuild-academy-kb.js");
});
