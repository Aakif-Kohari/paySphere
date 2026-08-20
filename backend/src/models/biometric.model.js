/**
 * @fileoverview Biometric Device & Raw Punch Log Schemas
 * @description Registers physical hardware devices and stores unprocessed, 
 * timestamped punch events before reconciliation.
 * Issue: #1002
 */
const mongoose = require('mongoose');

/**
 * Biometric Device Schema
 * Registers physical hardware (e.g., eSSL, ZKTeco) to a tenant.
 */
const biometricDeviceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    deviceName: { type: String, required: true, trim: true }, // e.g., "Factory Floor Main Gate"
    deviceSerial: { type: String, required: true, unique: true, trim: true },
    deviceIp: { type: String, required: true },
    location: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    secretKey: { type: String, default: 'biometric-device-secret-key' },
    isActive: { type: Boolean, default: true },
    lastPingAt: { type: Date, default: null },
}, { timestamps: true });

const BiometricDevice = mongoose.model('BiometricDevice', biometricDeviceSchema);

/**
 * Raw Punch Log Schema
 * Stores unprocessed, timestamped events pushed from physical devices.
 */
const rawPunchLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BiometricDevice', required: true, index: true },

    // External ID from the biometric device (often a numeric badge ID)
    externalEmployeeId: { type: String, required: true, index: true },

    timestamp: { type: Date, required: true, index: true },
    punchType: { type: String, enum: ['IN', 'OUT', 'UNKNOWN'], default: 'UNKNOWN' },

    // Metadata for anomaly detection
    deviceIp: { type: String, required: true },
    verificationType: { type: String, enum: ['Fingerprint', 'FaceID', 'RFID', 'PIN'], default: 'Fingerprint' },

    // Reconciliation Status
    status: {
        type: String,
        enum: ['Unprocessed', 'Reconciled', 'Flagged', 'Ignored'],
        default: 'Unprocessed',
        index: true
    },
    anomalyFlags: [{ type: String }], // e.g., ['Missing OUT', 'Buddy Punching Suspected']
}, { timestamps: true });

// Compound index for fast chronological fetching per device/employee
rawPunchLogSchema.index({ tenantId: 1, externalEmployeeId: 1, timestamp: 1 });
const RawPunchLog = mongoose.model('RawPunchLog', rawPunchLogSchema);

module.exports = { BiometricDevice, RawPunchLog };
