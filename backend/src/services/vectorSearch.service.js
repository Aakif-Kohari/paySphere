/**
 * @fileoverview Vector Search & Chunking Service
 * @description Handles text chunking of PDF/Text documents and performs 
 * cosine similarity search to retrieve relevant context for the RAG pipeline.
 * 
 * Note: This implementation uses a mock TF-IDF/Bag-of-Words approach for 
 * architectural demonstration. In production, this would integrate with 
 * OpenAI Embeddings API and a Vector Database like Pinecone or Qdrant.
 * Issue: #1001
 */

/**
 * Chunks a large text document into overlapping segments.
 * @param {string} text - The full document text
 * @param {number} chunkSize - Target characters per chunk
 * @param {number} overlap - Number of overlapping characters between chunks
 * @returns {string[]} Array of text chunks
 */
function chunkDocument(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = Math.min(startIndex + chunkSize, text.length);

        // Try to break at a sentence or paragraph boundary if possible
        if (endIndex < text.length) {
            const lastPeriod = text.lastIndexOf('.', endIndex);
            const lastNewline = text.lastIndexOf('\n', endIndex);
            const breakPoint = Math.max(lastPeriod, lastNewline);

            if (breakPoint > startIndex + (chunkSize / 2)) {
                endIndex = breakPoint + 1;
            }
        }

        chunks.push(text.slice(startIndex, endIndex).trim());
        startIndex = endIndex - overlap;
    }

    return chunks.filter(c => c.length > 0);
}

/**
 * Generates a mock embedding (Bag-of-Words frequency vector) for a text string.
 * In production, replace this with an API call to an embedding model.
 * @param {string} text 
 * @param {string[]} vocabulary - The global vocabulary list for the tenant
 * @returns {number[]} Vector representation
 */
function generateMockEmbedding(text, vocabulary) {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    const vector = new Array(vocabulary.length).fill(0);

    words.forEach(word => {
        const index = vocabulary.indexOf(word);
        if (index !== -1) {
            vector[index] += 1;
        }
    });

    return vector;
}

/**
 * Calculates Cosine Similarity between two vectors.
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} Similarity score (0 to 1)
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

/**
 * Searches the knowledge base for chunks relevant to the user's query.
 * @param {Array} allChunks - Array of KnowledgeChunk documents
 * @param {string} query - The employee's question
 * @param {number} topK - Number of top results to return
 * @returns {Array} Top K relevant chunks with similarity scores
 */
function searchKnowledgeBase(allChunks, query, topK = 3) {
    if (allChunks.length === 0) return [];

    // Build a simple vocabulary from all chunks (Mocking a vector space)
    const vocabulary = new Set();
    allChunks.forEach(chunk => {
        chunk.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).forEach(w => vocabulary.add(w));
    });
    const vocabArray = Array.from(vocabulary);

    const queryVector = generateMockEmbedding(query, vocabArray);

    // Calculate similarity for each chunk
    const scoredChunks = allChunks.map(chunk => {
        const chunkVector = chunk.embedding && chunk.embedding.length === vocabArray.length
            ? chunk.embedding
            : generateMockEmbedding(chunk.content, vocabArray);

        return {
            ...chunk.toObject ? chunk.toObject() : chunk,
            score: cosineSimilarity(queryVector, chunkVector)
        };
    });

    // Sort by score descending and return top K
    return scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(c => c.score > 0.05); // Filter out completely irrelevant noise
}

module.exports = { chunkDocument, generateMockEmbedding, searchKnowledgeBase };
