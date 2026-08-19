/**
 * @fileoverview Fleet Management Schemas
 * @description Tracks company vehicles, trip logs, fuel expenses, and maintenance schedules.
 * Issue: #1206
 */
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    licensePlate: { type: String, required: true, unique: true, uppercase: true },
    vin: { type: String, default: '' },
    fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'], default: 'Petrol' },

    currentOdometer: { type: Number, default: 0, min: 0 },
    lastServiceOdometer: { type: Number, default: 0, min: 0 },
    nextServiceOdometer: { type: Number, default: 10000, min: 0 }, // e.g., every 10,000 km

    status: {
        type: String,
        enum: ['Available', 'Assigned', 'In Maintenance', 'Retired'],
        default: 'Available',
        index: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null }
}, { timestamps: true });

const tripLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    date: { type: Date, required: true },
    startOdometer: { type: Number, required: true, min: 0 },
    endOdometer: { type: Number, required: true, min: 0 },
    distanceKm: { type: Number, required: true, min: 0 },

    fuelAddedLiters: { type: Number, default: 0, min: 0 },
    fuelCost: { type: Number, default: 0, min: 0 },
    fuelReceiptUrl: { type: String, default: '' },

    purpose: { type: String, default: 'Business' },
    notes: { type: String, default: '' }
}, { timestamps: true });

tripLogSchema.index({ vehicleId: 1, date: -1 });

const maintenanceScheduleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    type: { type: String, enum: ['Routine Service', 'Tire Rotation', 'Oil Change', 'Repair', 'Inspection'], required: true },
    dueOdometer: { type: Number, required: true },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ['Pending', 'Completed', 'Overdue'], default: 'Pending' },
    completedAt: { type: Date, default: null },
    cost: { type: Number, default: 0 },
    notes: { type: String, default: '' }
}, { timestamps: true });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
const TripLog = mongoose.model('TripLog', tripLogSchema);
const MaintenanceSchedule = mongoose.model('MaintenanceSchedule', maintenanceScheduleSchema);

module.exports = { Vehicle, TripLog, MaintenanceSchedule };
