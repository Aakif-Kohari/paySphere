/**
 * @fileoverview LLM Prompt Builder for RAG
 * @description Constructs strict system prompts to prevent hallucinations 
 * and enforce citations from the provided HR policy context.
 * Issue: #1001
 */

/**
 * Builds the final prompt payload to send to an LLM (e.g., OpenAI, Anthropic).
 * 
 * @param {string} userQuery - The employee's question
 * @param {Array} contextChunks - Array of retrieved KnowledgeChunk objects
 * @returns {{ system: string, user: string }} The formatted prompt messages
 */
function buildRAGPrompt(userQuery, contextChunks) {
    const systemPrompt = `You are an expert, professional, and helpful HR Assistant for the company. 
Your task is to answer employee questions strictly based on the provided company policy context.

RULES:
1. ONLY use the information provided in the <context> tags to answer the question.
2. If the answer is not present in the context, you MUST reply exactly with: "I don't have enough information in the company handbook to answer this. Please escalate this to the HR team."
3. Do NOT hallucinate, invent, or assume any policies, numbers, or dates that are not explicitly stated in the context.
4. Maintain a professional, empathetic, and clear tone.
5. If referencing a specific rule, cite the document title at the end of your sentence (e.g., [Leave Policy]).`;

    let contextString = '';
    if (contextChunks && contextChunks.length > 0) {
        contextChunks.forEach((chunk, index) => {
            contextString += `\n<document id="${index + 1}" title="${chunk.documentTitle}">\n${chunk.content}\n</document>\n`;
        });
    } else {
        contextString = 'No relevant context found in the company handbook.';
    }

    const userPrompt = `
<context>
${contextString}
</context>

<employee_question>
${userQuery}
</employee_question>

Please provide a clear, accurate answer based ONLY on the context above. If the context does not contain the answer, follow Rule #2.`;

    return {
        system: systemPrompt,
        user: userPrompt
    };
}

/**
 * Mock LLM API Call
 * In production, this would make an HTTP POST to OpenAI/Anthropic APIs.
 * For this architectural implementation, it returns a simulated response 
 * to demonstrate the pipeline flow without requiring external API keys.
 * 
 * @param {Object} promptPayload - The {system, user} payload
 * @returns {Promise<string>} The AI generated response
 */
async function callLLM(promptPayload) {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // Heuristic mock response based on context presence
    if (promptPayload.user.includes('No relevant context found')) {
        return "I don't have enough information in the company handbook to answer this. Please escalate this to the HR team.";
    }

    return "Based on the company handbook, [Mock AI Response summarizing the retrieved context]. If you need further clarification on how this applies to your specific department, please let me know or escalate this ticket to HR.";
}

module.exports = { buildRAGPrompt, callLLM };
