const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../notification.controller');

jest.mock('../../models/notification.model');

const oid = () => new mongoose.Types.ObjectId().toString();

const USER = oid();
const TENANT = oid();
const OTHER_TENANT = oid();
const NOTIFICATION_ID = oid();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  query: {},
  params: {},
  userId: USER,
  tenantId: TENANT,
  ...overrides,
});

/** `Notification.find(...).sort(...).skip(...).limit(...)` */
const listChain = (rows) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(rows),
});

beforeEach(() => {
  jest.clearAllMocks();
  Notification.find.mockReturnValue(listChain([]));
  Notification.countDocuments.mockResolvedValue(0);
});

/**
 * The notification handlers (#440, #898).
 *
 * These were correct as far as they went, and they went nowhere: nothing in the
 * product ever wrote a Notification, so every one of them operated on an empty
 * collection for every account. What is asserted here is what they got wrong
 * once there are rows for them to get wrong.
 */

describe('tenancy (#898)', () => {
  test('the list is scoped to the tenant as well as the user', async () => {
    // The collection had no `tenantId` at all, so the only thing separating one
    // company's rows from another's was that user ids happen to be unique.
    // True, but not a scope.
    await getNotifications(makeReq(), makeRes());

    expect(Notification.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, tenantId: TENANT }),
    );
  });

  test('an unscoped request is refused rather than querying on userId alone', async () => {
    const res = makeRes();
    await getNotifications(makeReq({ tenantId: undefined }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Notification.find).not.toHaveBeenCalled();
  });

  test('marking one read is scoped', async () => {
    Notification.findOneAndUpdate.mockResolvedValue({ _id: NOTIFICATION_ID });

    await markAsRead(makeReq({ params: { id: NOTIFICATION_ID } }), makeRes());

    expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: NOTIFICATION_ID, userId: USER, tenantId: TENANT },
      { isRead: true },
      { new: true },
    );
  });

  test('marking all read is scoped', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });

    await markAllAsRead(makeReq(), makeRes());

    expect(Notification.updateMany).toHaveBeenCalledWith(
      { userId: USER, tenantId: TENANT, isRead: false },
      { isRead: true },
    );
  });

  test('deleting is scoped', async () => {
    Notification.findOneAndDelete.mockResolvedValue({ _id: NOTIFICATION_ID });

    await deleteNotification(
      makeReq({ params: { id: NOTIFICATION_ID } }),
      makeRes(),
    );

    expect(Notification.findOneAndDelete).toHaveBeenCalledWith({
      _id: NOTIFICATION_ID,
      userId: USER,
      tenantId: TENANT,
    });
  });

  test('a tenant in the query string cannot widen the scope', async () => {
    await getNotifications(
      makeReq({ query: { tenantId: OTHER_TENANT } }),
      makeRes(),
    );

    expect(Notification.find.mock.calls[0][0].tenantId).toBe(TENANT);
  });
});

describe('pagination (#898)', () => {
  test('defaults to a bounded first page', async () => {
    const chain = listChain([]);
    Notification.find.mockReturnValue(chain);

    await getNotifications(makeReq(), makeRes());

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('a later page is reachable', async () => {
    // The hardcoded `.limit(50)` this replaces had no page after it, so the
    // fifty-first notification was simply unreachable, with nothing to say so.
    const chain = listChain([]);
    Notification.find.mockReturnValue(chain);

    await getNotifications(makeReq({ query: { page: '3' } }), makeRes());

    expect(chain.skip).toHaveBeenCalledWith(40);
  });

  test('an oversized limit is capped', async () => {
    const chain = listChain([]);
    Notification.find.mockReturnValue(chain);

    await getNotifications(makeReq({ query: { limit: '5000' } }), makeRes());

    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('newest first', async () => {
    const chain = listChain([]);
    Notification.find.mockReturnValue(chain);

    await getNotifications(makeReq(), makeRes());

    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  test('the response carries a total and page count', async () => {
    Notification.countDocuments.mockResolvedValue(45);
    const res = makeRes();

    await getNotifications(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 45, page: 1, totalPages: 3 }),
    );
  });
});

describe('the unread badge', () => {
  test('counts unread across the whole scope, not just this page', async () => {
    // The badge answers "how many unread do I have", not "how many unread are
    // on the page you happen to be looking at".
    await getNotifications(makeReq({ query: { page: '2' } }), makeRes());

    expect(Notification.countDocuments).toHaveBeenCalledWith({
      userId: USER,
      tenantId: TENANT,
      isRead: false,
    });
  });

  test('unreadOnly filters the list without changing the badge', async () => {
    await getNotifications(
      makeReq({ query: { unreadOnly: 'true' } }),
      makeRes(),
    );

    expect(Notification.find).toHaveBeenCalledWith(
      expect.objectContaining({ isRead: false }),
    );
  });

  test('the list is unfiltered by default', async () => {
    await getNotifications(makeReq(), makeRes());

    expect(Notification.find.mock.calls[0][0]).not.toHaveProperty('isRead');
  });
});

describe('markAllAsRead reports what it did (#898)', () => {
  test('returns modifiedCount so the client can reconcile', async () => {
    // It returned a static message, so the navbar flipped every row in local
    // state and hoped. With a count it can tell "nothing was unread" from "the
    // write did not land".
    Notification.updateMany.mockResolvedValue({ modifiedCount: 7 });
    const res = makeRes();

    await markAllAsRead(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, modifiedCount: 7 }),
    );
  });

  test('a driver that reports nothing yields zero, not undefined', async () => {
    Notification.updateMany.mockResolvedValue({});
    const res = makeRes();

    await markAllAsRead(makeReq(), res);

    expect(res.json.mock.calls[0][0].modifiedCount).toBe(0);
  });
});

describe('id validation', () => {
  test('a malformed id is a 400 before any query', async () => {
    const res = makeRes();

    await markAsRead(makeReq({ params: { id: 'nope' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Notification.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('a malformed id on delete is a 400', async () => {
    const res = makeRes();

    await deleteNotification(makeReq({ params: { id: 'nope' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Notification.findOneAndDelete).not.toHaveBeenCalled();
  });

  test("someone else's notification is a 404", async () => {
    Notification.findOneAndUpdate.mockResolvedValue(null);
    const res = makeRes();

    await markAsRead(makeReq({ params: { id: NOTIFICATION_ID } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deleting a notification that is not yours is a 404', async () => {
    Notification.findOneAndDelete.mockResolvedValue(null);
    const res = makeRes();

    await deleteNotification(makeReq({ params: { id: NOTIFICATION_ID } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('failures reach the error handler', () => {
  test('a database error is passed on', async () => {
    Notification.find.mockImplementation(() => {
      throw new Error('connection reset');
    });
    const next = jest.fn();

    await getNotifications(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
