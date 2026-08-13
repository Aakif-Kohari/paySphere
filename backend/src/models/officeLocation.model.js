/**
 * @fileoverview Office Location & Geo-Fence Schema
 * @description Stores GeoJSON boundaries for office locations to enforce 
 * geospatial attendance clock-ins. Supports Points (radius) and Polygons.
 * Issue: #930
 */
const mongoose = require('mongoose');

const officeLocationSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        address: { type: String, default: '' },
        // GeoJSON standard: Point (for radius) or Polygon (for complex boundaries)
        geometry: {
            type: { type: String, enum: ['Point', 'Polygon'], required: true },
            coordinates: { type: mongoose.Schema.Types.Mixed, required: true }
            // Point: [lng, lat], Polygon: [[[lng, lat], ...]]
        },
        radiusMeters: { type: Number, default: 50, min: 10, max: 5000 }, // Tolerance radius for Points
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// 2dsphere index is CRITICAL for MongoDB $geoWithin and $near queries
officeLocationSchema.index({ geometry: '2dsphere' });
officeLocationSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('OfficeLocation', officeLocationSchema);
