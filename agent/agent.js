const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
// const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { createToolCallingAgent, AgentExecutor } = require("langchain/agents");
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

// Khi gọi tool get_nami_blog_posts LUÔN LUÔN truyền đủ các field: query_type, keyword (nếu không có thì để rỗng), lang, month, year (nếu không có thì null)
async function createAgentExecutor() {
    const tools = await buildTools();
    const agent = await createToolCallingAgent({
        llm: model,
        tools,
        prompt,
        // verbose: true
    });

    const executor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
    });
    console.log("Agent executor created with tools:", executor);
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
    executor.tools = originalTools.map(tool => {
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
    
    const result = await executor.invoke({
        input: userInput,
        lang: detectedLang 
    });
    console.log("Agent execution result:", result);
    return {
        response: {
            output: result.returnValues?.output || result.output || "No output returned",
            log: result.log || [],
            tool_calls: toolResults 
        }
        // result.output,
        // metadata: {
        //     toolResults,
        // }
    };
}
module.exports = {
    createAgentExecutor,    
    runAgentWithMetadata
};