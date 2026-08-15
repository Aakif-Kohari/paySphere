/**
 * @fileoverview IndexedDB Configuration via Dexie.js
 * @description Sets up the local offline database for caching payroll drafts
 * and queuing API mutations when the network is unavailable.
 * 
 * Issue: #815
 */

import Dexie from 'dexie';

/**
 * PaySphere Offline Database
 * Stores drafts and sync queue items locally
 */
export const db = new Dexie('PaySphereOfflineDB');

// Define schema
// Version 1: Initial schema
db.version(1).stores({
    // Payroll drafts: keyed by employeeId + month + year to prevent duplicates
    payrollDrafts: '++id, employeeId, month, year, updatedAt, status',

    // Sync queue: FIFO queue of failed API mutations to retry when online
    syncQueue: '++id, endpoint, method, payload, timestamp, retryCount',

    // App state: track online/offline status and last sync time
    appState: 'key'
});

/**
 * Adds a failed API request to the sync queue for later retry
 * @param {string} endpoint - API endpoint (e.g., '/api/payroll')
 * @param {string} method - HTTP method (POST, PUT, DELETE)
 * @param {Object} payload - Request body
 */
export async function addToSyncQueue(endpoint, method, payload) {
    try {
        await db.syncQueue.add({
            endpoint,
            method,
            payload,
            timestamp: new Date().toISOString(),
            retryCount: 0,
        });
        console.log('[Offline] Added to sync queue:', endpoint);
    } catch (error) {
        console.error('[Offline] Failed to add to sync queue:', error);
    }
}

/**
 * Retrieves all pending items in the sync queue
 * @returns {Promise<Array>} Array of queued mutations
 */
export async function getSyncQueue() {
    return await db.syncQueue.orderBy('timestamp').toArray();
}

/**
 * Removes a successfully synced item from the queue
 * @param {number} id - The Dexie auto-incremented ID
 */
export async function removeFromSyncQueue(id) {
    await db.syncQueue.delete(id);
}

/**
 * Clears the entire sync queue (e.g., on logout)
 */
export async function clearSyncQueue() {
    await db.syncQueue.clear();
}

/**
 * Saves a payroll draft locally
 * @param {Object} draft - The payroll draft data
 */
export async function savePayrollDraft(draft) {
    const { employeeId, month, year, ...data } = draft;

    // Upsert based on employee + period
    const existing = await db.payrollDrafts
        .where({ employeeId, month, year })
        .first();

    if (existing) {
        await db.payrollDrafts.update(existing.id, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } else {
        await db.payrollDrafts.add({
            employeeId,
            month,
            year,
            ...data,
            updatedAt: new Date().toISOString(),
            status: 'draft'
        });
    }
}

/**
 * Retrieves a specific payroll draft
 */
export async function getPayrollDraft(employeeId, month, year) {
    return await db.payrollDrafts
        .where({ employeeId, month, year })
        .first();
}

/**
 * Clears all local drafts (e.g., after successful server sync)
 */
export async function clearPayrollDrafts() {
    await db.payrollDrafts.clear();
}
