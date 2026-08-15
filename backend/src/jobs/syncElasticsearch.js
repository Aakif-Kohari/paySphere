require('dotenv').config();
const mongoose = require('mongoose');
const { Client } = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

// Adjust this path to where your Employee model is actually located
const Employee = require('../models/employee.model'); 

const esClient = new Client({ 
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200' 
});

async function runSync() {
    logger.info('Starting Elasticsearch sync...');

    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        logger.info('Connected to MongoDB.');

        // 2. Fetch all active employees
        // We exclude soft-deleted records to keep the search index clean
        const employees = await Employee.find({ 
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] 
        }).lean();

        if (employees.length === 0) {
            logger.info('No active employees found to sync.');
            process.exit(0);
        }

        logger.info(`Found ${employees.length} employees. Preparing bulk payload...`);

        // 3. Format the data for the Bulk API
        // The bulk API requires a flat array with action metadata followed by the document
        const bulkPayload = employees.flatMap(emp => [
            // Action instruction: index this document with the same ID as MongoDB
            { index: { _index: 'employees', _id: emp._id.toString() } },
            // The actual document data to index
            {
                tenantId: emp.tenantId.toString(),
                fullName: emp.fullName,
                email: emp.email || '',
                department: emp.department || 'Unassigned',
                role: emp.role || 'Unassigned',
                employmentStatus: emp.employmentStatus,
                companyName: emp.companyName
            }
        ]);

        // 4. Send the bulk request to Elasticsearch
        const bulkResponse = await esClient.bulk({ refresh: true, body: bulkPayload });

        if (bulkResponse.errors) {
            logger.error('Bulk sync completed with errors.');
            // Elasticsearch bulk responses pack error details deeply; this extracts them
            const erroredDocuments = bulkResponse.items.filter(item => item.index && item.index.error);
            logger.error('Elasticsearch sync errors detail', { errors: erroredDocuments });
        } else {
            logger.info(`Successfully synced ${employees.length} employees to Elasticsearch!`);
        }

    } catch (error) {
        logger.error('Fatal error during sync', { error: error.message || error });
    } finally {
        await mongoose.disconnect();
        logger.info('MongoDB connection closed.');
        process.exit(0);
    }
}

runSync();
