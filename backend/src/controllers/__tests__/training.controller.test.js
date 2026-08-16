/**
 * Training endpoints (#1076).
 *
 * The engine is covered in `utils/__tests__/trainingCompliance.test.js`. What is
 * checked here is what the controller decides:
 *
 *   - a failing score records Failed and sets no validity,
 *   - a retake past the course limit is refused,
 *   - editing a course does not rewrite the validity already issued,
 *   - assigning twice does not reset somebody's in-progress attempt,
 *   - a waiver requires a written reason,
 *   - the self-service route resolves the employee from the session.
 */

jest.mock('../../models/training.model', () => ({
  TrainingCourse: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  TrainingEnrollment: {
    findOne: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
  },
}));
jest.mock('../../models/employee.model', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));

const {
  TrainingCourse,
  TrainingEnrollment,
} = require('../../models/training.model');
const Employee = require('../../models/employee.model');
const {
  createCourse,
  getCourses,
  updateCourse,
  assignCourse,
  completeEnrollment,
  waiveEnrollment,
  getMyTraining,
  getComplianceGaps,
  getComplianceSummary,
  getRenewalsDue,
} = require('../training.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const COURSE = '607f1f77bcf86cd7994390a1';
const ENROLLMENT = '607f1f77bcf86cd7994390b2';
const EMPLOYEE = '607f1f77bcf86cd7994390c3';

const NOW = '2026-08-16T00:00:00.000Z';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  tenantId: TENANT,
  userId: USER,
  body: {},
  params: {},
  query: {},
  ...overrides,
});

const leanResolving = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const selectLeanResolving = (value) => ({
  select: jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const sortLeanResolving = (value) => ({
  sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

const courseDoc = (overrides = {}) => ({
  _id: COURSE,
  tenantId: TENANT,
  code: 'POSH-01',
  title: 'POSH awareness',
  isMandatory: true,
  isActive: true,
  appliesTo: 'All',
  appliesToValues: [],
  passMark: 70,
  maxAttempts: 3,
  validityMonths: 12,
  reminderLeadDays: 30,
  ...overrides,
});

const enrollmentDoc = (overrides = {}) => ({
  _id: ENROLLMENT,
  tenantId: TENANT,
  courseId: COURSE,
  employeeId: EMPLOYEE,
  status: 'Assigned',
  attemptCount: 0,
  score: null,
  completedAt: null,
  validUntil: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  TrainingEnrollment.insertMany.mockResolvedValue([]);
});

describe('createCourse', () => {
  it('creates a course and returns 201', async () => {
    TrainingCourse.create.mockResolvedValue({ _id: COURSE });

    const res = makeRes();
    await createCourse(
      makeReq({ body: { code: 'POSH-01', title: 'POSH awareness' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('requires a code and a title', async () => {
    const res = makeRes();
    await createCourse(makeReq({ body: { title: 'X' } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TrainingCourse.create).not.toHaveBeenCalled();
  });

  it('turns a duplicate code into a 409', async () => {
    TrainingCourse.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    const next = jest.fn();
    await createCourse(
      makeReq({ body: { code: 'POSH-01', title: 'X' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  it('reports a schema validation failure as a 400, not a 500', async () => {
    // A targeted course with no targets applies to nobody, which is a client
    // mistake rather than a server fault.
    const error = new Error('appliesToValues is required');
    error.name = 'ValidationError';
    TrainingCourse.create.mockRejectedValue(error);

    const res = makeRes();
    await createCourse(
      makeReq({ body: { code: 'X', title: 'Y', appliesTo: 'Departments' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getCourses', () => {
  it('scopes to the caller tenant', async () => {
    TrainingCourse.find.mockReturnValue(sortLeanResolving([]));

    await getCourses(makeReq(), makeRes(), jest.fn());

    expect(TrainingCourse.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  it('filters to mandatory courses on request', async () => {
    TrainingCourse.find.mockReturnValue(sortLeanResolving([]));

    await getCourses(
      makeReq({ query: { mandatory: 'true' } }),
      makeRes(),
      jest.fn(),
    );

    expect(TrainingCourse.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      isMandatory: true,
    });
  });
});

describe('updateCourse', () => {
  it('applies only the editable fields', async () => {
    // An allow-list rather than a spread: `code` is referenced by certificates
    // and `tenantId` decides who can see the row.
    const course = { ...courseDoc(), save: jest.fn() };
    TrainingCourse.findOne.mockResolvedValue(course);

    await updateCourse(
      makeReq({
        params: { id: COURSE },
        body: { title: 'POSH refresher', code: 'HACKED', tenantId: 'other' },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(course.title).toBe('POSH refresher');
    expect(course.code).toBe('POSH-01');
    expect(course.tenantId).toBe(TENANT);
  });

  it('says that existing certifications keep their issued validity', async () => {
    // Shortening a renewal cycle must not retroactively invalidate
    // certifications that were current when they were issued.
    const course = { ...courseDoc(), save: jest.fn() };
    TrainingCourse.findOne.mockResolvedValue(course);

    const res = makeRes();
    await updateCourse(
      makeReq({ params: { id: COURSE }, body: { validityMonths: 6 } }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].note).toMatch(/keep the validity/);
  });

  it('404s on a course in another tenant', async () => {
    TrainingCourse.findOne.mockResolvedValue(null);

    const res = makeRes();
    await updateCourse(
      makeReq({ params: { id: COURSE }, body: { title: 'X' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('assignCourse', () => {
  it('assigns to everyone the course applies to when no list is given', async () => {
    TrainingCourse.findOne.mockReturnValue(
      leanResolving(
        courseDoc({
          appliesTo: 'Departments',
          appliesToValues: ['Engineering'],
        }),
      ),
    );
    Employee.find.mockReturnValue(
      selectLeanResolving([
        { _id: 'e1', fullName: 'Asha', department: 'Engineering' },
        { _id: 'e2', fullName: 'Meera', department: 'Finance' },
      ]),
    );
    TrainingEnrollment.find.mockReturnValue(selectLeanResolving([]));

    const res = makeRes();
    await assignCourse(
      makeReq({ params: { id: COURSE }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].assigned).toBe(1);
    expect(TrainingEnrollment.insertMany.mock.calls[0][0]).toHaveLength(1);
  });

  it('does not reassign somebody who is already enrolled', async () => {
    // Reassigning would reset an in-progress attempt to Assigned and lose the
    // score.
    TrainingCourse.findOne.mockReturnValue(leanResolving(courseDoc()));
    Employee.find.mockReturnValue(
      selectLeanResolving([
        { _id: 'e1', fullName: 'Asha', department: 'Engineering' },
      ]),
    );
    TrainingEnrollment.find.mockReturnValue(
      selectLeanResolving([{ employeeId: 'e1' }]),
    );

    const res = makeRes();
    await assignCourse(
      makeReq({ params: { id: COURSE }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].assigned).toBe(0);
    expect(res.json.mock.calls[0][0].alreadyEnrolled).toBe(1);
    expect(TrainingEnrollment.insertMany).not.toHaveBeenCalled();
  });

  it('refuses to assign an inactive course', async () => {
    TrainingCourse.findOne.mockReturnValue(
      leanResolving(courseDoc({ isActive: false })),
    );

    const res = makeRes();
    await assignCourse(
      makeReq({ params: { id: COURSE }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('reports that a course matches nobody rather than silently doing nothing', async () => {
    TrainingCourse.findOne.mockReturnValue(
      leanResolving(
        courseDoc({ appliesTo: 'Departments', appliesToValues: ['Legal'] }),
      ),
    );
    Employee.find.mockReturnValue(
      selectLeanResolving([{ _id: 'e1', department: 'Engineering' }]),
    );

    const res = makeRes();
    await assignCourse(
      makeReq({ params: { id: COURSE }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].appliesToValues).toEqual(['Legal']);
  });

  it('rejects a list containing no valid ids', async () => {
    TrainingCourse.findOne.mockReturnValue(leanResolving(courseDoc()));

    const res = makeRes();
    await assignCourse(
      makeReq({ params: { id: COURSE }, body: { employeeIds: ['nope'] } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('completeEnrollment', () => {
  it('records a pass with the validity the course grants', async () => {
    const enrollment = enrollmentDoc();
    TrainingEnrollment.findOne.mockResolvedValue(enrollment);
    TrainingCourse.findOne.mockReturnValue(leanResolving(courseDoc()));

    const res = makeRes();
    await completeEnrollment(
      makeReq({
        params: { id: ENROLLMENT },
        body: { score: 85, completedAt: NOW },
      }),
      res,
      jest.fn(),
    );

    expect(enrollment.status).toBe('Completed');
    expect(enrollment.validUntil.toISOString()).toContain('2027-08-16');
    expect(res.json.mock.calls[0][0].passed).toBe(true);
  });

  it('records a fail with no validity', async () => {
    // Recording it as complete would let a failing score satisfy a mandatory
    // course.
    const enrollment = enrollmentDoc();
    TrainingEnrollment.findOne.mockResolvedValue(enrollment);
    TrainingCourse.findOne.mockReturnValue(leanResolving(courseDoc()));

    const res = makeRes();
    await completeEnrollment(
      makeReq({
        params: { id: ENROLLMENT },
        body: { score: 40, completedAt: NOW },
      }),
      res,
      jest.fn(),
    );

    expect(enrollment.status).toBe('Failed');
    expect(enrollment.validUntil).toBeNull();
    expect(enrollment.completedAt).toBeNull();
    expect(res.json.mock.calls[0][0].passed).toBe(false);
  });

  it('clears a previous completion when a retake fails', async () => {
    // Otherwise the old completion date and validity stay attached to a failing
    // attempt, and the person reads as certified.
    const enrollment = enrollmentDoc({
      status: 'Completed',
      attemptCount: 1,
      completedAt: new Date('2025-01-01'),
      validUntil: new Date('2026-01-01'),
    });
    TrainingEnrollment.findOne.mockResolvedValue(enrollment);
    TrainingCourse.findOne.mockReturnValue(leanResolving(courseDoc()));

    await completeEnrollment(
      makeReq({
        params: { id: ENROLLMENT },
        body: { score: 10, completedAt: NOW },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(enrollment.validUntil).toBeNull();
    expect(enrollment.completedAt).toBeNull();
  });

  it('refuses a retake past the course limit', async () => {
    const enrollment = enrollmentDoc({ attemptCount: 3 });
    TrainingEnrollment.findOne.mockResolvedValue(enrollment);
    TrainingCourse.findOne.mockReturnValue(
      leanResolving(courseDoc({ maxAttempts: 3 })),
    );

    const res = makeRes();
    await completeEnrollment(
      makeReq({ params: { id: ENROLLMENT }, body: { score: 100 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(enrollment.save).not.toHaveBeenCalled();
  });

  it('records no expiry for a course that never expires', async () => {
    const enrollment = enrollmentDoc();
    TrainingEnrollment.findOne.mockResolvedValue(enrollment);
    TrainingCourse.findOne.mockReturnValue(
      leanResolving(courseDoc({ validityMonths: 0 })),
    );

    const res = makeRes();
    await completeEnrollment(
      makeReq({
        params: { id: ENROLLMENT },
        body: { score: 85, completedAt: NOW },
      }),
      res,
      jest.fn(),
    );

    expect(enrollment.validUntil).toBeNull();
    expect(res.json.mock.calls[0][0].neverExpires).toBe(true);
  });

  it('refuses to complete a waived enrolment', async () => {
    TrainingEnrollment.findOne.mockResolvedValue(
      enrollmentDoc({ status: 'Waived' }),
    );

    const res = makeRes();
    await completeEnrollment(
      makeReq({ params: { id: ENROLLMENT }, body: { score: 90 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects a score outside 0-100', async () => {
    TrainingEnrollment.findOne.mockResolvedValue(enrollmentDoc());
    TrainingCourse.findOne.mockReturnValue(leanResolving(courseDoc()));

    const res = makeRes();
    await completeEnrollment(
      makeReq({ params: { id: ENROLLMENT }, body: { score: 150 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('waiveEnrollment', () => {
  it('records the waiver with its reason and who made it', async () => {
    const enrollment = enrollmentDoc();
    TrainingEnrollment.findOne.mockResolvedValue(enrollment);

    await waiveEnrollment(
      makeReq({
        params: { id: ENROLLMENT },
        body: { reason: 'Holds an equivalent external certification' },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(enrollment.status).toBe('Waived');
    expect(enrollment.waivedBy).toBe(USER);
  });

  it('refuses a waiver with no reason', async () => {
    // "Why is this person exempt from mandatory fire safety training" is the
    // first thing an auditor asks, and a blank field is not an answer.
    const res = makeRes();
    await waiveEnrollment(
      makeReq({ params: { id: ENROLLMENT }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TrainingEnrollment.findOne).not.toHaveBeenCalled();
  });

  it('refuses a token reason', async () => {
    const res = makeRes();
    await waiveEnrollment(
      makeReq({ params: { id: ENROLLMENT }, body: { reason: 'n/a' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getMyTraining', () => {
  it('resolves the employee from the session, never from a parameter', async () => {
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, fullName: 'Asha Rao' }),
    );
    TrainingEnrollment.find.mockReturnValue(
      leanResolving([
        {
          _id: ENROLLMENT,
          courseId: COURSE,
          status: 'Completed',
          completedAt: new Date('2026-06-01'),
        },
      ]),
    );
    TrainingCourse.find.mockReturnValue(leanResolving([courseDoc()]));

    const res = makeRes();
    await getMyTraining(
      makeReq({ query: { asOf: NOW, employeeId: 'someone-else' } }),
      res,
      jest.fn(),
    );

    expect(Employee.findOne).toHaveBeenCalledWith({
      userId: USER,
      tenantId: TENANT,
    });
    expect(TrainingEnrollment.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      employeeId: EMPLOYEE,
    });
  });

  it('counts outstanding mandatory training', async () => {
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, fullName: 'Asha Rao' }),
    );
    TrainingEnrollment.find.mockReturnValue(
      leanResolving([
        { _id: ENROLLMENT, courseId: COURSE, status: 'Assigned' },
      ]),
    );
    TrainingCourse.find.mockReturnValue(leanResolving([courseDoc()]));

    const res = makeRes();
    await getMyTraining(makeReq({ query: { asOf: NOW } }), res, jest.fn());

    expect(res.json.mock.calls[0][0].outstanding).toBe(1);
  });

  it('404s when the account is not linked to an employee record', async () => {
    Employee.findOne.mockReturnValue(selectLeanResolving(null));

    const res = makeRes();
    await getMyTraining(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('compliance reporting', () => {
  const wireInputs = ({ courses = [], employees = [], enrollments = [] }) => {
    TrainingCourse.find.mockReturnValue(leanResolving(courses));
    Employee.find.mockReturnValue(selectLeanResolving(employees));
    TrainingEnrollment.find.mockReturnValue(leanResolving(enrollments));
  };

  it('reports gaps split into never-trained and lapsed', async () => {
    wireInputs({
      courses: [courseDoc()],
      employees: [
        { _id: 'e1', fullName: 'Asha', department: 'Engineering' },
        { _id: 'e2', fullName: 'Ravi', department: 'Engineering' },
      ],
      enrollments: [
        {
          employeeId: 'e1',
          courseId: COURSE,
          status: 'Completed',
          completedAt: new Date('2024-01-01'),
        },
      ],
    });

    const res = makeRes();
    await getComplianceGaps(makeReq({ query: { asOf: NOW } }), res, jest.fn());

    const gap = res.json.mock.calls[0][0].gaps[0];
    expect(gap.lapsed).toHaveLength(1);
    expect(gap.neverTrained).toHaveLength(1);
  });

  it('returns a summary and a per-department breakdown together', async () => {
    wireInputs({
      courses: [courseDoc()],
      employees: [{ _id: 'e1', fullName: 'Asha', department: 'Engineering' }],
      enrollments: [],
    });

    const res = makeRes();
    await getComplianceSummary(
      makeReq({ query: { asOf: NOW } }),
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.summary.obligations).toBe(1);
    expect(body.byDepartment[0].department).toBe('Engineering');
  });

  it('lists renewals due inside the horizon', async () => {
    TrainingCourse.find.mockReturnValue(leanResolving([courseDoc()]));
    TrainingEnrollment.find.mockReturnValue(
      leanResolving([
        {
          _id: ENROLLMENT,
          employeeId: 'e1',
          courseId: COURSE,
          status: 'Completed',
          completedAt: new Date('2025-09-01'),
        },
      ]),
    );

    const res = makeRes();
    await getRenewalsDue(
      makeReq({ query: { asOf: NOW, horizonDays: '30' } }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].renewals).toHaveLength(1);
  });

  it('falls back to now when asOf is unparseable', async () => {
    // An Invalid Date compares false against every expiry and would report
    // every certification as valid.
    wireInputs({ courses: [], employees: [], enrollments: [] });

    const res = makeRes();
    await getComplianceGaps(
      makeReq({ query: { asOf: 'last-tuesday' } }),
      res,
      jest.fn(),
    );

    expect(Number.isNaN(res.json.mock.calls[0][0].asOf.getTime())).toBe(false);
  });
});
