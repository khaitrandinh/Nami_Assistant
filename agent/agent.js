const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
// const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { createToolCallingAgent, AgentExecutor } = require("langchain/agents");
const { BufferMemory } = require("langchain/memory");
const buildTools = require("./tools");
// const tools = await buildTools();
require('dotenv').config();
// const {getAcademyRAG } = require("./rag");
// const { BufferMemory } = require("langchain/memory"); //  đúng cách mới
const prompt = require("./systemPrompt"); //  prompt cố định


const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    maxOutputTokens: 2048,
    temperature: 0.2,
    apiKey: process.env.GOOGLE_API_KEY,
});


let executor = null;
async function createAgentExecutor() {
    if (executor) return executor;

    const tools = await buildTools();
    const agent = await createToolCallingAgent({
        llm: model,
        tools,
        prompt,
        // verbose: true
    });
    const memory = new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true,
        inputKey: "input",
        outputKey: "output"  // Chỉ định rõ key để lấy
    });
    executor = new AgentExecutor({
        agent,
        tools,
        memory,
        verbose: true,
        inputKey: "input",   
        outputKey: "output", 
    });
    // console.log("Agent executor created with tools:", executor);
    return executor;
}

async function runAgentWithMetadata(userInput,detectedLang = 'vi') {
    // console.log("Running agent with input:", userInput);
    // console.log("Detected language:", detectedLang);

    const executor = await createAgentExecutor();
    
    // Store tool results để có thể truy cập sau
    let toolResults = {};
    
    // Override tool execution để capture results
    const originalTools = executor.tools;
    executor.tools = originalTools.map((tool) => {
        if (tool.name === 'emotion_support') {
            const originalFunc = tool.func;
            tool.func = async (input) => {
                const result = await originalFunc(input);
                toolResults.emotion_support = result; // Store result
                return result;
            };
        }
        return tool;
    });
    const inputWithLang = `[lang=${detectedLang}]\n${userInput}`;
    const result = await executor.invoke({
        input: inputWithLang,
    });

    // console.log("=== DEBUG RESULT STRUCTURE ===");
    // console.log("Result keys:", Object.keys(result));
    // console.log("Result:", JSON.stringify(result, null, 2));
    
    // Safe access với nhiều fallback options
    let output = "No output";
    
    if (result.output) {
        output = result.output;
    } else if (result.returnValues?.output) {
        output = result.returnValues.output;
    } else if (result.returnValues) {
        // Nếu returnValues có duy nhất 1 key, lấy value của key đó
        const keys = Object.keys(result.returnValues);
        if (keys.length === 1) {
            output = result.returnValues[keys[0]];
        } else if (keys.length > 1) {
            // Nếu có nhiều key, ưu tiên theo thứ tự
            const priorityKeys = ['output', 'response', 'text', 'content'];
            for (const key of priorityKeys) {
                if (result.returnValues[key]) {
                    output = result.returnValues[key];
                    break;
                }
            }
        }
    } else if (result.log) {
        output = result.log;
    }

    // console.log("=== FINAL OUTPUT ===");
    // console.log("Output:", output);

    return {
        response: {
            output: output
        },
        metadata: {
        tool_calls: Object.keys(toolResults).length ? toolResults : null,
        log: result.log || null,
    }
    };
}

module.exports = {
    createAgentExecutor,    
    runAgentWithMetadata
};