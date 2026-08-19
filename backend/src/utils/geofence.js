/**
 * Is this punch inside one of the company's offices? (#930, made real in #953.)
 *
 * `models/officeLocation.model.js` has described a fence since #930 — a Point
 * with a tolerance radius, or a Polygon — and nothing in the tree referred to
 * it, so there was no way to create an office and nothing to test a coordinate
 * against.
 *
 * Everything here is pure arithmetic on plain objects. It is deliberately not a
 * `$geoWithin` query: the number of offices a company has is small, the caller
 * already has to load them to report the distance to the nearest one, and a
 * function that can be run against a fixture is a function whose edge cases can
 * be tested. `$geoWithin` is the right tool for "which of ten thousand
 * documents fall in this shape", which is not this question.
 */

/** Mean radius of the Earth, in metres. */
const EARTH_RADIUS_M = 6371008.8;

/** Above this, a person did not travel between two punches — a device did. */
const IMPOSSIBLE_SPEED_MPS = 90; // ~325 km/h

/** How far from [0,0] still counts as the null island. */
const NULL_ISLAND_TOLERANCE_DEG = 0.0001;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Is this a usable `[longitude, latitude]` pair?
 *
 * Longitude first. It is the GeoJSON order and the order the model stores, and
 * it is the single easiest thing to get backwards — a swapped pair is a
 * coordinate that is still valid and points somewhere else entirely.
 *
 * @param {*} coordinates
 * @returns {boolean}
 */
function isValidCoordinate(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;

  const [lng, lat] = coordinates.map(Number);

  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Great-circle distance between two `[longitude, latitude]` points, in metres.
 *
 * Haversine rather than a planar approximation: a fence is tens of metres
 * across and the error from treating degrees as flat is not uniform — it varies
 * with latitude, so a tolerance tuned in one office is wrong in another.
 *
 * @param {number[]} from
 * @param {number[]} to
 * @returns {number} metres, or NaN if either point is unusable
 */
function haversineMetres(from, to) {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) return NaN;

  const [lng1, lat1] = from.map(Number);
  const [lng2, lat2] = to.map(Number);

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Is a point inside a polygon ring?
 *
 * Ray casting on the outer ring. Adequate for an office boundary, which is a
 * building footprint measured in tens of metres, where treating longitude and
 * latitude as planar introduces error far below the tolerance anyone sets.
 *
 * @param {number[]} point `[lng, lat]`
 * @param {number[][]} ring `[[lng, lat], …]`
 * @returns {boolean}
 */
function isPointInRing(point, ring) {
  if (!isValidCoordinate(point) || !Array.isArray(ring) || ring.length < 3) {
    return false;
  }

  const [x, y] = point.map(Number);
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = (ring[i] || []).map(Number);
    const [xj, yj] = (ring[j] || []).map(Number);

    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;

    const straddles = yi > y !== yj > y;
    if (!straddles) continue;

    const intersectX = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (x < intersectX) inside = !inside;
  }

  return inside;
}

/**
 * How this punch stands against one office.
 *
 * A polygon reports `inside` with a null distance: "how far outside an arbitrary
 * boundary" is not a number this can honestly produce, and a fabricated one
 * would end up on a report.
 *
 * @param {number[]} coordinates `[lng, lat]`
 * @param {object} office an OfficeLocation document
 * @returns {{inside: boolean, distance: number|null}}
 */
function evaluateAgainstOffice(coordinates, office) {
  const geometry = office?.geometry;

  if (!geometry || !isValidCoordinate(coordinates)) {
    return { inside: false, distance: null };
  }

  if (geometry.type === 'Polygon') {
    const ring = Array.isArray(geometry.coordinates)
      ? geometry.coordinates[0]
      : null;

    return { inside: isPointInRing(coordinates, ring), distance: null };
  }

  if (geometry.type === 'Point') {
    const distance = haversineMetres(coordinates, geometry.coordinates);

    if (!Number.isFinite(distance)) return { inside: false, distance: null };

    const radius = Number(office.radiusMeters) || 0;

    return { inside: distance <= radius, distance: Math.round(distance) };
  }

  return { inside: false, distance: null };
}

/**
 * Test a punch against every office a company has.
 *
 * @param {number[]} coordinates `[lng, lat]`
 * @param {object[]} offices active OfficeLocation documents
 * @returns {{inside: boolean, office: object|null, distance: number|null}}
 */
function locateWithinOffices(coordinates, offices = []) {
  const candidates = Array.isArray(offices) ? offices : [];

  let nearest = { inside: false, office: null, distance: null };

  for (const office of candidates) {
    const { inside, distance } = evaluateAgainstOffice(coordinates, office);

    // An inside match wins immediately: being within one fence is being at
    // work, whatever the distance to a second office happens to be.
    if (inside) return { inside: true, office, distance };

    const closerThanBest =
      Number.isFinite(distance) &&
      (nearest.distance === null || distance < nearest.distance);

    if (closerThanBest) nearest = { inside: false, office, distance };
  }

  return nearest;
}

/**
 * The spoofing signals that can be derived server-side.
 *
 * Only signals the server can establish on its own. A client-reported
 * "mock location" flag is a claim by the thing being checked, which is not
 * evidence — it is left to the client to send as a note if it wants to, and it
 * is not treated as a finding here.
 *
 * @param {object} punch
 * @param {number[]} punch.coordinates
 * @param {Date} punch.at
 * @param {{coordinates: number[], at: Date}|null} [punch.previous] the last punch
 * @returns {string[]}
 */
function detectSpoofingFlags({ coordinates, at, previous } = {}) {
  const flags = [];

  if (!isValidCoordinate(coordinates)) {
    flags.push('invalid_coordinates');
    return flags;
  }

  const [lng, lat] = coordinates.map(Number);

  // [0, 0] is in the Gulf of Guinea. A device that reports it is a device whose
  // location permission was denied, not an employee at work — and it was the
  // schema *default* before #953, so it is also what an unset field looked
  // like.
  if (
    Math.abs(lng) < NULL_ISLAND_TOLERANCE_DEG &&
    Math.abs(lat) < NULL_ISLAND_TOLERANCE_DEG
  ) {
    flags.push('null_island');
  }

  if (previous && isValidCoordinate(previous.coordinates)) {
    const metres = haversineMetres(previous.coordinates, coordinates);
    const seconds = (new Date(at) - new Date(previous.at)) / 1000;

    if (Number.isFinite(metres) && seconds > 0) {
      if (metres / seconds > IMPOSSIBLE_SPEED_MPS)
        flags.push('impossible_speed');
    } else if (Number.isFinite(metres) && seconds <= 0 && metres > 1000) {
      // Same instant, a kilometre apart. Two devices, or a clock that was set
      // by hand.
      flags.push('impossible_speed');
    }
  }

  return flags;
}

module.exports = {
  EARTH_RADIUS_M,
  IMPOSSIBLE_SPEED_MPS,
  isValidCoordinate,
  haversineMetres,
  isPointInRing,
  evaluateAgainstOffice,
  locateWithinOffices,
  detectSpoofingFlags,
};
