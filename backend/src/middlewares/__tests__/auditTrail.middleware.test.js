const auditTrailPlugin = require('../auditTrail.middleware');
const { getAuditContext } = require('../../utils/auditContext');
const { createAuditLog } = require('../../services/audit.service');

jest.mock('../../utils/auditContext', () => ({
  getAuditContext: jest.fn(),
}));

jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));

describe('auditTrailPlugin', () => {
  let mockSchema;
  let hooks;

  beforeEach(() => {
    jest.clearAllMocks();
    hooks = {};
    mockSchema = {
      pre: jest.fn((event, fn) => {
        if (!hooks[event]) hooks[event] = { pre: [], post: [] };
        hooks[event].pre.push(fn);
      }),
      post: jest.fn((event, fn) => {
        if (!hooks[event]) hooks[event] = { pre: [], post: [] };
        hooks[event].post.push(fn);
      }),
    };
  });

  test('should register hooks on schema', () => {
    auditTrailPlugin(mockSchema);

    expect(mockSchema.pre).toHaveBeenCalledWith('save', expect.any(Function));
    expect(mockSchema.post).toHaveBeenCalledWith('save', expect.any(Function));

    expect(mockSchema.pre).toHaveBeenCalledWith('updateOne', expect.any(Function));
    expect(mockSchema.post).toHaveBeenCalledWith('updateOne', expect.any(Function));
  });

  test('pre save hook should set $wasNew based on isNew', () => {
    auditTrailPlugin(mockSchema);
    const preSaveHook = hooks['save'].pre[0];

    const mockDoc = { isNew: true };
    preSaveHook.call(mockDoc);
    expect(mockDoc.$wasNew).toBe(true);
  });

  test('post save hook should call createAuditLog if req and userId are present', async () => {
    auditTrailPlugin(mockSchema);
    const postSaveHook = hooks['save'].post[0];

    const mockReq = { userId: 'user123' };
    getAuditContext.mockReturnValue({ req: mockReq });

    const mockDoc = {
      _id: 'docId',
      $wasNew: true,
      constructor: { modelName: 'Employee' },
    };

    await postSaveHook.call(mockDoc, mockDoc);

    expect(createAuditLog).toHaveBeenCalledWith({
      userId: 'user123',
      action: 'EMPLOYEE_CREATE',
      resourceType: 'Employee',
      resourceIds: ['docId'],
      req: mockReq,
    });
  });
});
