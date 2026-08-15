const mongoose = require('mongoose');
const {
  isValidPeriod,
  roomIdFor,
  PresenceRegistry,
  normalizeAdjustment,
} = require('../payrollSession');

const oid = () => new mongoose.Types.ObjectId().toString();

const TENANT_A = oid();
const TENANT_B = oid();

/**
 * The defect this module exists to fix, stated as a test.
 *
 * `#589` built the room key as `${month}-${year}`, so the key was a pure
 * function of the period and carried no notion of who was asking.
 */
describe('room keys are per company, not per month (#615)', () => {
  test('two companies running the same month get different rooms', () => {
    const a = roomIdFor(TENANT_A, 8, 2026);
    const b = roomIdFor(TENANT_B, 8, 2026);

    // Under #589 both of these were the string "8-2026", and `socket.to(room)`
    // re-broadcast one company's salary edits to the other.
    expect(a).not.toBe(b);
  });

  test('the same company running the same month gets the same room', () => {
    expect(roomIdFor(TENANT_A, 8, 2026)).toBe(roomIdFor(TENANT_A, 8, 2026));
  });

  test('one company gets different rooms for different months', () => {
    expect(roomIdFor(TENANT_A, 8, 2026)).not.toBe(roomIdFor(TENANT_A, 9, 2026));
    expect(roomIdFor(TENANT_A, 8, 2026)).not.toBe(roomIdFor(TENANT_A, 8, 2027));
  });

  test('the tenant is part of the key, not appended as decoration', () => {
    expect(roomIdFor(TENANT_A, 8, 2026)).toContain(TENANT_A);
  });

  test('numeric and string periods produce the same room', () => {
    // The client sends whatever the select element gives it.
    expect(roomIdFor(TENANT_A, '8', '2026')).toBe(roomIdFor(TENANT_A, 8, 2026));
  });
});

describe('roomIdFor — refuses rather than improvises (#615)', () => {
  test('returns null without a tenant', () => {
    // No tenant means no room this socket can safely be put in. #589 would
    // have dropped it into the shared one.
    expect(roomIdFor(null, 8, 2026)).toBeNull();
    expect(roomIdFor(undefined, 8, 2026)).toBeNull();
    expect(roomIdFor('', 8, 2026)).toBeNull();
  });

  test('returns null for a tenant that is not an id', () => {
    expect(roomIdFor('not-an-id', 8, 2026)).toBeNull();
    expect(roomIdFor('undefined', 8, 2026)).toBeNull();
  });

  test('returns null for a period it cannot make sense of', () => {
    expect(roomIdFor(TENANT_A, '*', '*')).toBeNull();
    expect(roomIdFor(TENANT_A, 13, 2026)).toBeNull();
    expect(roomIdFor(TENANT_A, 0, 2026)).toBeNull();
    expect(roomIdFor(TENANT_A, 8, 1999)).toBeNull();
  });

  test('a wildcard payload cannot open a room others would join', () => {
    // `#589` interpolated whatever arrived, so `{ month: '*', year: '*' }`
    // produced a room named "*-*" shared by everyone who sent the same thing.
    expect(roomIdFor(TENANT_A, '*', '*')).toBeNull();
  });
});

describe('isValidPeriod (#615)', () => {
  test('accepts every real month', () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(isValidPeriod(m, 2026)).toBe(true);
    }
  });

  test.each([
    ['month 0', 0, 2026],
    ['month 13', 13, 2026],
    ['a fractional month', 7.5, 2026],
    ['a non-numeric month', 'August', 2026],
    ['year 1999', 8, 1999],
    ['year 2101', 8, 2101],
    ['undefined', undefined, undefined],
    ['null', null, null],
  ])('rejects %s', (_label, month, year) => {
    expect(isValidPeriod(month, year)).toBe(false);
  });
});

describe('PresenceRegistry — multiple tabs (#615)', () => {
  let presence;

  beforeEach(() => {
    presence = new PresenceRegistry();
  });

  const room = () => roomIdFor(TENANT_A, 8, 2026);

  test('a joining user appears in the roster', () => {
    const roster = presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's1' });

    expect(roster).toEqual([{ id: 'u1', name: 'Ada' }]);
  });

  test('a second tab does not duplicate the user', () => {
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's1' });
    const roster = presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's2' });

    expect(roster).toHaveLength(1);
  });

  test('closing one tab leaves the user in the roster', () => {
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's1' });
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's2' });

    const roster = presence.leave(room(), { id: 'u1', socketId: 's2' });

    // `#589` keyed by user id alone, so closing either tab announced that the
    // user had left while they were still connected on the other.
    expect(roster).toEqual([{ id: 'u1', name: 'Ada' }]);
  });

  test('closing the last tab removes the user', () => {
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's1' });
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's2' });
    presence.leave(room(), { id: 'u1', socketId: 's2' });

    expect(presence.leave(room(), { id: 'u1', socketId: 's1' })).toEqual([]);
  });

  test('the room is dropped once it is empty', () => {
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's1' });
    presence.leave(room(), { id: 'u1', socketId: 's1' });

    expect(presence.size()).toBe(0);
  });

  test('two companies keep separate rosters for the same month', () => {
    presence.join(roomIdFor(TENANT_A, 8, 2026), { id: 'u1', name: 'Ada', socketId: 's1' });
    presence.join(roomIdFor(TENANT_B, 8, 2026), { id: 'u2', name: 'Grace', socketId: 's2' });

    expect(presence.roster(roomIdFor(TENANT_A, 8, 2026))).toEqual([
      { id: 'u1', name: 'Ada' },
    ]);
    // Company A must not learn that Grace exists.
    expect(presence.roster(roomIdFor(TENANT_A, 8, 2026))).not.toContainEqual(
      expect.objectContaining({ name: 'Grace' }),
    );
  });

  test('the roster does not leak the internal socket bookkeeping', () => {
    presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's1' });

    expect(presence.roster(room())[0]).toEqual({ id: 'u1', name: 'Ada' });
    expect(presence.roster(room())[0].sockets).toBeUndefined();
  });

  test('leaving a room nobody is in is not an error', () => {
    expect(presence.leave('nonexistent', { id: 'u1', socketId: 's1' })).toEqual([]);
  });

  test('a later connection can supply a name an earlier one lacked', () => {
    presence.join(room(), { id: 'u1', name: '', socketId: 's1' });
    const roster = presence.join(room(), { id: 'u1', name: 'Ada', socketId: 's2' });

    expect(roster[0].name).toBe('Ada');
  });
});

describe('normalizeAdjustment (#615)', () => {
  const empId = oid();

  test('passes a well-formed adjustment through', () => {
    expect(normalizeAdjustment({ empId, field: 'bonus', value: 5000 })).toEqual({
      ok: true,
      payload: { empId, field: 'bonus', value: 5000 },
    });
  });

  test('drops keys the client had no business sending', () => {
    const result = normalizeAdjustment({
      empId,
      field: 'bonus',
      value: 1,
      userId: 'someone-else',
      userName: 'Impersonated',
    });

    // `#589` spread the payload into the outgoing event, so a client could
    // overwrite the fields the server sets — including who the edit came from.
    expect(Object.keys(result.payload).sort()).toEqual(['empId', 'field', 'value']);
  });

  test.each([
    ['a missing payload', undefined],
    ['null', null],
    ['a string', 'bonus=5000'],
    ['a malformed employee id', { empId: 'nope', field: 'bonus', value: 1 }],
    ['a missing field name', { empId, value: 1 }],
    ['a blank field name', { empId, field: '   ', value: 1 }],
    ['a non-string field name', { empId, field: 42, value: 1 }],
  ])('rejects %s', (_label, data) => {
    expect(normalizeAdjustment(data).ok).toBe(false);
  });

  test('a falsy value is still a legitimate edit', () => {
    // Clearing a bonus sets it to 0, which must not be mistaken for "no value".
    expect(normalizeAdjustment({ empId, field: 'bonus', value: 0 }).ok).toBe(true);
    expect(normalizeAdjustment({ empId, field: 'bonus', value: '' }).ok).toBe(true);
  });
});
