require('dotenv').config();
const mongoose = require('mongoose');
const { Client } = require('@elastic/elasticsearch');

// Adjust this path to where your Employee model is actually located
const Employee = require('../models/employee.model'); 

const esClient = new Client({ 
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200' 
});

async function runSync() {
    console.log('Starting Elasticsearch sync...');

    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        // 2. Fetch all active employees
        // We exclude soft-deleted records to keep the search index clean
        const employees = await Employee.find({ 
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] 
        }).lean();

        if (employees.length === 0) {
            console.log('No active employees found to sync.');
            process.exit(0);
        }

        console.log(`Found ${employees.length} employees. Preparing bulk payload...`);

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
            console.error('Bulk sync completed with errors.');
            // Elasticsearch bulk responses pack error details deeply; this extracts them
            const erroredDocuments = bulkResponse.items.filter(item => item.index && item.index.error);
            console.error(JSON.stringify(erroredDocuments, null, 2));
        } else {
            console.log(`Successfully synced ${employees.length} employees to Elasticsearch!`);
        }

    } catch (error) {
        console.error('Fatal error during sync:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB connection closed.');
        process.exit(0);
    }
}

runSync();
