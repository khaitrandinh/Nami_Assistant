const express = require("express");
const cors = require("cors");
const { createAgentExecutor, runAgentWithMetadata } = require("./agent/agent");
require("dotenv").config();
const detectLanguage = require("./utils/langDetect");
const { exec } = require("child_process");

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

// app.post("/chat", async (req, res) => {
//     const userInput = req.body.message;

//     if (!userInput) {
//         return res.status(400).json({ error: "Missing 'message' in request body" });
//     }

//     try {
//         const detectedLang = await detectLanguage(userInput);
//         // console.log(`Detected user language: ${detectedLang}`);
        
//         if (!executorPromise) {
//             executorPromise = createAgentExecutor();
//         }
//         const executor = await executorPromise;
//         const result = await executor.invoke({
//             input: userInput,
//             lang: detectedLang // nếu agent hỗ trợ
//         }); 
//         console.log("Agent result:", result);
//         return res.json({
//             returnValues: result.returnValues,
//             output: result.output,
//             log: result.log,
//             // toolCalls: result.tool_calls ?? [] 
//         });
//     } catch (err) {
//         console.error("Error processing /chat:", err);
//         return res.status(500).json({ error: "Internal server error. Please try again later." });
//     }
// });

app.get("/api/rebuild-kb", (req, res) => {
  exec("node utils/rebuild-academy-kb.js", (error, stdout, stderr) => {
    if (error) return res.status(500).send("Lỗi: " + error.message);
    if (stderr) console.warn(stderr);
    res.send("Rebuild OK:\n" + stdout);
  });
});

app.get("/api/namiFaq", (req, res) => {
  exec("node utils/namiFaq.js", (error, stdout, stderr) => {
    if (error) return res.status(500).send("Lỗi: " + error.message);
    if (stderr) console.warn(stderr);
    res.send("Rebuild OK:\n" + stdout);
  });
});
app.post("/chat", async (req, res) => {
    const userInput = req.body.message;

    if (!userInput) {
        return res.status(400).json({ error: "Missing 'message' in request body" });
    }

    try {
        const detectedLang = await detectLanguage(userInput);
        console.log(`Detected user language: ${detectedLang}`);
        
        // Sử dụng runAgentWithMetadata thay vì createAgentExecutor trực tiếp
        const result = await runAgentWithMetadata(userInput, detectedLang);
        
        // console.log("Agent result:", result.response.tool_calls);
        // const emotionData1 = result.metadata?.toolResults?.emotion_support;
        // const emotionData2 = result.metadata?.toolResults?.['emotion_support'];
        // Extract emotion support data nếu có
        // const emotionData = result.metadata?.toolResults?.emotion_support;
        // console.log("Emotion support data:", emotionData);
        // Prepare response
        console.log("Agent result:", result.metadata.tool_calls);
        const response = {
            output: result.response,
            // Giữ nguyên format cũ để tương thích
            returnValues: { output: result.response },
            toolCalls: result.metadata.tool_calls
        };
        // console.log("Agent result:", response);
        
        // Thêm emotion support data nếu có
        // if (emotionData) {
        //     response.emotionSupport = {
        //         needsSupport: emotionData.needsSupport,
        //         confirmSupport: emotionData.confirmSupport,
        //         message_vi: emotionData.message_vi,
        //         message_en: emotionData.message_en,
        //         emotionLevel: emotionData.emotionLevel,
        //         score: emotionData.score,
        //         adjustedScore: emotionData.adjustedScore
        //     };
        // }
        // console.log("Agent result:", response);
        return res.json(response);
        
    } catch (err) {
        console.error("Error processing /chat:", err);
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AI Server is running at http://localhost:${PORT}`);
});
