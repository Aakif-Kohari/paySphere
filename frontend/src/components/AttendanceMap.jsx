/**
 * @fileoverview Interactive Geo-Fence Map Component
 * @description Uses Leaflet to allow Admins to draw polygons or drop pins 
 * to define office boundaries for attendance tracking.
 * Issue: #930
 */
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import PropTypes from 'prop-types';

// Fix default Leaflet marker icon paths in bundlers
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick, mode }) {
    useMapEvents({
        click(e) {
            if (mode === 'point') {
                onMapClick(e.latlng);
            } else if (mode === 'polygon') {
                onMapClick(e.latlng);
            }
        },
    });
    return null;
}

MapClickHandler.propTypes = { onMapClick: PropTypes.func.isRequired, mode: PropTypes.string.isRequired };

export default function AttendanceMap({ initialGeometry, initialRadius, onSave }) {
    const [mode, setMode] = useState(initialGeometry?.type || 'point'); // 'point' or 'polygon'
    const [center, setCenter] = useState(initialGeometry?.coordinates ? [initialGeometry.coordinates[1], initialGeometry.coordinates[0]] : [28.6139, 77.2090]); // Default New Delhi
    const [radius, setRadius] = useState(initialRadius || 50);
    const [polygonPoints, setPolygonPoints] = useState(
        initialGeometry?.type === 'Polygon' ? initialGeometry.coordinates[0].map(c => [c[1], c[0]]) : []
    );

    const handleMapClick = (latlng) => {
        if (mode === 'point') {
            setCenter([latlng.lat, latlng.lng]);
        } else {
            setPolygonPoints([...polygonPoints, [latlng.lat, latlng.lng]]);
        }
    };

    const handleSave = () => {
        let geometry;
        if (mode === 'point') {
            geometry = { type: 'Point', coordinates: [center[1], center[0]] }; // GeoJSON is [lng, lat]
        } else {
            // Close the polygon loop
            const closedLoop = [...polygonPoints, polygonPoints[0]].map(p => [p[1], p[0]]);
            geometry = { type: 'Polygon', coordinates: [closedLoop] };
        }
        onSave({ geometry, radiusMeters: radius });
    };

    return (
        <div className="space-y-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex gap-2">
                    <button onClick={() => { setMode('point'); setPolygonPoints([]); }} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${mode === 'point' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}`}>Drop Pin (Radius)</button>
                    <button onClick={() => { setMode('polygon'); }} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${mode === 'polygon' ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}`}>Draw Polygon</button>
                </div>

                {mode === 'point' && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Radius (m):</label>
                        <input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} min="10" max="5000" className="w-24 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm" />
                    </div>
                )}

                {mode === 'polygon' && polygonPoints.length > 0 && (
                    <button onClick={() => setPolygonPoints([])} className="text-sm text-red-600 hover:underline">Clear Polygon</button>
                )}

                <button onClick={handleSave} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold">Save Geo-Fence</button>
            </div>

            <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 z-0">
                <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={handleMapClick} mode={mode} />

                    {mode === 'point' && (
                        <Circle center={center} radius={radius} pathOptions={{ color: '#2563EB', fillColor: '#3b82f6', fillOpacity: 0.3 }} />
                    )}

                    {mode === 'polygon' && polygonPoints.length > 0 && (
                        <Polygon positions={polygonPoints} pathOptions={{ color: '#2563EB', fillColor: '#3b82f6', fillOpacity: 0.3 }} />
                    )}
                </MapContainer>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Click on the map to {mode === 'point' ? 'set the office center' : 'add polygon vertices'}. GPS drift tolerance is handled by the radius.</p>
        </div>
    );
}

AttendanceMap.propTypes = {
    initialGeometry: PropTypes.object,
    initialRadius: PropTypes.number,
    onSave: PropTypes.func.isRequired,
};
