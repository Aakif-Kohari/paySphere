/**
 * Geo-fencing arithmetic (#930, made real in #953).
 *
 * `models/officeLocation.model.js` described a fence and nothing in the tree
 * referred to it, so there was no way to create an office and nothing to test a
 * coordinate against. This is the arithmetic that decides whether somebody was
 * at work, which is a question that ends up on a payslip.
 */

const {
  isValidCoordinate,
  haversineMetres,
  isPointInRing,
  evaluateAgainstOffice,
  locateWithinOffices,
  detectSpoofingFlags,
  IMPOSSIBLE_SPEED_MPS,
} = require('../geofence');

// India Gate, New Delhi, as [longitude, latitude].
const OFFICE = [77.2295, 28.6129];

/** A point `metres` due north of `from`. One degree of latitude ≈ 111,320 m. */
const northOf = ([lng, lat], metres) => [lng, lat + metres / 111320];

const pointOffice = (overrides = {}) => ({
  _id: 'office-point',
  name: 'Head office',
  geometry: { type: 'Point', coordinates: OFFICE },
  radiusMeters: 50,
  isActive: true,
  ...overrides,
});

/** A closed square of roughly 400 m a side, centred on the office. */
const polygonOffice = (overrides = {}) => ({
  _id: 'office-polygon',
  name: 'Campus',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [77.227, 28.611],
        [77.232, 28.611],
        [77.232, 28.615],
        [77.227, 28.615],
        [77.227, 28.611],
      ],
    ],
  },
  isActive: true,
  ...overrides,
});

describe('reading a coordinate', () => {
  it('accepts a longitude-latitude pair in range', () => {
    expect(isValidCoordinate(OFFICE)).toBe(true);
    expect(isValidCoordinate([0, 0])).toBe(true);
    expect(isValidCoordinate([-180, -90])).toBe(true);
  });

  it('rejects a pair that is out of range, short, or not numbers', () => {
    // A latitude of 100 is usually a swapped pair, which is a valid-looking
    // coordinate pointing somewhere else entirely.
    [
      [77, 100],
      [200, 28],
      [77],
      [],
      null,
      undefined,
      ['a', 'b'],
      [NaN, 28],
    ].forEach((value) => {
      expect(isValidCoordinate(value)).toBe(false);
    });
  });
});

describe('distance', () => {
  it('is zero for the same point', () => {
    expect(haversineMetres(OFFICE, OFFICE)).toBe(0);
  });

  it('matches a known displacement to within a metre', () => {
    expect(haversineMetres(OFFICE, northOf(OFFICE, 300))).toBeCloseTo(300, 0);
  });

  it('is NaN rather than 0 for an unusable point', () => {
    // 0 would read as "at the office", which is the wrong answer to give when
    // the truth is "we do not know where this was".
    expect(Number.isNaN(haversineMetres(OFFICE, [999, 999]))).toBe(true);
    expect(Number.isNaN(haversineMetres(OFFICE, null))).toBe(true);
  });
});

describe('a Point office with a radius', () => {
  it('admits a punch inside the radius', () => {
    const result = evaluateAgainstOffice(northOf(OFFICE, 30), pointOffice());

    expect(result.inside).toBe(true);
    expect(result.distance).toBe(30);
  });

  it('refuses one outside it, and says how far', () => {
    const result = evaluateAgainstOffice(northOf(OFFICE, 300), pointOffice());

    expect(result.inside).toBe(false);
    expect(result.distance).toBe(300);
  });

  it('treats the radius as inclusive', () => {
    const result = evaluateAgainstOffice(northOf(OFFICE, 50), pointOffice());

    expect(result.inside).toBe(true);
  });
});

describe('a Polygon office', () => {
  it('admits a point inside the ring', () => {
    expect(isPointInRing(OFFICE, polygonOffice().geometry.coordinates[0])).toBe(
      true,
    );
  });

  it('refuses a point outside it', () => {
    expect(
      isPointInRing([77.24, 28.62], polygonOffice().geometry.coordinates[0]),
    ).toBe(false);
  });

  it('reports no distance', () => {
    // "How far outside an arbitrary boundary" is not a number this can
    // honestly produce, and a fabricated one would end up on a report.
    const result = evaluateAgainstOffice(OFFICE, polygonOffice());

    expect(result).toEqual({ inside: true, distance: null });
  });

  it('refuses a ring with too few positions to be a shape', () => {
    expect(
      isPointInRing(OFFICE, [
        [77, 28],
        [78, 28],
      ]),
    ).toBe(false);
  });
});

describe('locating a punch across several offices', () => {
  it('stops at the first fence the punch is inside', () => {
    const inside = pointOffice({ _id: 'near' });
    const far = pointOffice({
      _id: 'far',
      geometry: { type: 'Point', coordinates: northOf(OFFICE, 5000) },
    });

    const result = locateWithinOffices(northOf(OFFICE, 10), [far, inside]);

    expect(result.inside).toBe(true);
    expect(result.office._id).toBe('near');
  });

  it('reports the nearest office when the punch is outside all of them', () => {
    const near = pointOffice({
      _id: 'near',
      geometry: { type: 'Point', coordinates: northOf(OFFICE, 400) },
    });
    const far = pointOffice({
      _id: 'far',
      geometry: { type: 'Point', coordinates: northOf(OFFICE, 5000) },
    });

    const result = locateWithinOffices(OFFICE, [far, near]);

    expect(result.inside).toBe(false);
    expect(result.office._id).toBe('near');
    expect(result.distance).toBeCloseTo(400, -1);
  });

  it('reports nothing when the company has no offices', () => {
    expect(locateWithinOffices(OFFICE, [])).toEqual({
      inside: false,
      office: null,
      distance: null,
    });
  });
});

describe('spoofing signals', () => {
  const now = new Date('2026-08-12T09:00:00Z');

  it('flags the null island', () => {
    // [0, 0] is in the Gulf of Guinea. It is what a denied location permission
    // reports — and it was the schema default before #953, so it is also what
    // an unset field looked like.
    expect(detectSpoofingFlags({ coordinates: [0, 0], at: now })).toContain(
      'null_island',
    );
  });

  it('flags travel nobody could have made', () => {
    const flags = detectSpoofingFlags({
      coordinates: northOf(OFFICE, 100000), // 100 km away
      at: now,
      previous: {
        coordinates: OFFICE,
        at: new Date(now.getTime() - 60 * 1000), // one minute earlier
      },
    });

    expect(flags).toContain('impossible_speed');
  });

  it('does not flag an ordinary commute', () => {
    const flags = detectSpoofingFlags({
      coordinates: northOf(OFFICE, 20000), // 20 km
      at: now,
      previous: {
        coordinates: OFFICE,
        at: new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes earlier
      },
    });

    expect(flags).toEqual([]);
  });

  it('flags a coordinate it cannot use, and stops there', () => {
    expect(detectSpoofingFlags({ coordinates: [999, 999], at: now })).toEqual([
      'invalid_coordinates',
    ]);
  });

  it('has a speed threshold above a car and below a plane', () => {
    // Roughly 325 km/h: a train can be quick, a phone cannot be in two cities.
    expect(IMPOSSIBLE_SPEED_MPS).toBeGreaterThan(50);
    expect(IMPOSSIBLE_SPEED_MPS).toBeLessThan(200);
  });
});
