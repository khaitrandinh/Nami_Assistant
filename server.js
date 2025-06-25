const express = require("express");
const cors = require("cors");
const { createAgentExecutor } = require("./agent/agent");
require("dotenv").config();
const detectLanguage = require("./utils/langDetect");


const app = express();

app.use(cors({
    origin: '*', // frontend dev
    methods: ["GET", "POST"],
}));
app.use(express.json());
app.use(express.static("public"));

let executorPromise = null;

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post("/chat", async (req, res) => {
    const userInput = req.body.message;

    if (!userInput) {
        return res.status(400).json({ error: "Missing 'message' in request body" });
    }

    try {
        const detectedLang = await detectLanguage(userInput);
        console.log(`Detected user language: ${detectedLang}`);
        
        if (!executorPromise) {
            executorPromise = createAgentExecutor();
        }
        const executor = await executorPromise;
        const result = await executor.invoke({
            input: userInput,
            lang: detectedLang // nếu agent hỗ trợ
        });

        return res.json({
            returnValues: result.returnValues,
            output: result.output,
            log: result.log,
        });
    } catch (err) {
        console.error("Error processing /chat:", err);
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AI Server is running at http://localhost:${PORT}`);
});
