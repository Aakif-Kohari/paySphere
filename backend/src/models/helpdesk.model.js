/**
 * @fileoverview Helpdesk & Knowledge Base Schemas
 * @description Stores vectorized policy document chunks and tracks HR support tickets.
 * Issue: #1001
 */
const mongoose = require('mongoose');

/**
 * Knowledge Document Chunk Schema
 * Stores segmented text from uploaded HR handbooks for RAG retrieval.
 * In a production environment, `embedding` would be a high-dimensional vector 
 * stored in a dedicated Vector DB (Pinecone/Qdrant). Here we store it in MongoDB 
 * with a mock TF-IDF array for architectural demonstration.
 */
const knowledgeChunkSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    documentTitle: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // page number, section, etc.
    // Mock embedding vector (array of floats) for cosine similarity search
    embedding: [{ type: Number }],
}, { timestamps: true });

knowledgeChunkSchema.index({ tenantId: 1, documentTitle: 1 });
const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);

/**
 * HR Ticket Schema
 * Tracks escalated queries that the AI could not resolve or that require human intervention.
 */
const hrTicketSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    originalQuery: { type: String, required: true },
    aiResponse: { type: String, default: '' },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        default: 'Open',
        index: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    messages: [{
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderType: { type: String, enum: ['Employee', 'HR', 'System'] },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    resolvedAt: { type: Date, default: null },
}, { timestamps: true });

const HRTicket = mongoose.model('HRTicket', hrTicketSchema);

module.exports = { KnowledgeChunk, HRTicket };
