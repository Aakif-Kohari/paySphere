/**
 * The attendance month document (#459), after #930's clock-in fields were moved
 * off it (#953).
 *
 * The regression this exists for: #930 added `clockIn: { required: true }` to
 * the *month* schema, which made every attendance document the rest of the
 * codebase constructs invalid against its own schema. Both writers go through
 * `findOneAndUpdate(..., { upsert: true })`, and Mongoose's update validators
 * do not enforce `required` on an upsert, so instead of failing loudly the
 * product inserted month rows that violated it.
 */

const mongoose = require('mongoose');
const Attendance = require('../attendance.model');

const oid = () => new mongoose.Types.ObjectId();

/** A month as the grid writers build it: no punches, just statuses. */
const month = (overrides = {}) =>
  new Attendance({
    employeeId: oid(),
    employeeName: 'Alice Smith',
    createdBy: oid(),
    tenantId: oid(),
    year: 2026,
    month: 8,
    days: [{ day: 1, status: 'present' }],
    ...overrides,
  });

describe('a month with no punches (#953)', () => {
  it('is valid', () => {
    // Before this, `validateSync()` reported `clockIn: Path 'clockIn' is
    // required` for every document the admin grid writes.
    expect(month().validateSync()).toBeUndefined();
  });

  it('has no month-level clock fields left to require', () => {
    const paths = Object.keys(Attendance.schema.paths);

    expect(paths).not.toContain('clockIn');
    expect(paths).not.toContain('clockOut');
    expect(paths).not.toContain('clockInCoordinates');
    expect(paths).not.toContain('isFieldDuty');
  });
});

describe('punches live on the day (#953)', () => {
  it('accepts several sessions in one day', () => {
    // The shape the month document could not hold: a month row has one
    // `clockIn` field, and a month has around twenty-two working days.
    const doc = month({
      days: [
        {
          day: 1,
          status: 'present',
          sessions: [
            {
              clockIn: new Date('2026-08-01T09:00:00Z'),
              clockOut: new Date('2026-08-01T13:00:00Z'),
            },
            { clockIn: new Date('2026-08-01T14:00:00Z') },
          ],
        },
      ],
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.days[0].sessions).toHaveLength(2);
  });

  it('defaults an open session’s clock-out to null', () => {
    const doc = month({
      days: [
        {
          day: 1,
          status: 'present',
          sessions: [{ clockIn: new Date('2026-08-01T09:00:00Z') }],
        },
      ],
    });

    // What makes "is this person clocked in right now?" answerable without a
    // second collection.
    expect(doc.days[0].sessions[0].clockOut).toBeNull();
  });

  it('requires a session to say when it started', () => {
    const doc = month({
      days: [
        { day: 1, status: 'present', sessions: [{ clockOut: new Date() }] },
      ],
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(Object.keys(error.errors).join(' ')).toMatch(/clockIn/);
  });

  it('stores coordinates in GeoJSON order', () => {
    const doc = month({
      days: [
        {
          day: 1,
          status: 'present',
          sessions: [
            {
              clockIn: new Date(),
              coordinates: { type: 'Point', coordinates: [77.2295, 28.6129] },
            },
          ],
        },
      ],
    });

    expect(doc.validateSync()).toBeUndefined();
    // Longitude first — the single easiest thing here to get backwards.
    expect(doc.days[0].sessions[0].coordinates.coordinates[0]).toBe(77.2295);
  });

  it('leaves coordinates unset rather than defaulting them to [0, 0]', () => {
    // [0, 0] is a real place in the Gulf of Guinea. As a default it made
    // "no location" and "the null island" indistinguishable, and the spoofing
    // check now flags the latter.
    const doc = month({
      days: [
        { day: 1, status: 'present', sessions: [{ clockIn: new Date() }] },
      ],
    });

    expect(doc.days[0].sessions[0].coordinates?.coordinates).toBeUndefined();
  });
});
