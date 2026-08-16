/**
 * Recruitment endpoints (#1074).
 *
 * The engine's arithmetic is covered in
 * `utils/__tests__/recruitmentPipeline.test.js`. What is checked here is the
 * four decisions the controller owns:
 *
 *   - an illegal stage transition is refused with the legal alternatives,
 *   - hiring against a full requisition is refused,
 *   - an offer above the approved band is refused outright, not overridden,
 *   - stage history is appended, never rewritten.
 */

jest.mock('../../models/recruitment.model', () => ({
  JobRequisition: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  Candidate: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  InterviewFeedback: { find: jest.fn(), create: jest.fn() },
}));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));

const {
  JobRequisition,
  Candidate,
  InterviewFeedback,
} = require('../../models/recruitment.model');
const {
  createRequisition,
  getRequisitions,
  updateRequisitionStatus,
  createCandidate,
  updateCandidateStage,
  submitFeedback,
  getScorecard,
  getFunnelAnalytics,
} = require('../recruitment.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const REQ = '607f1f77bcf86cd7994390a1';
const CAND = '607f1f77bcf86cd7994390b2';

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
const openRequisition = (overrides = {}) => ({
  _id: REQ,
  tenantId: TENANT,
  requisitionCode: 'ENG-001',
  title: 'Backend Engineer',
  openings: 2,
  ctcBandMin: 1000000,
  ctcBandMax: 1500000,
  status: 'Open',
  ...overrides,
});

const candidateDoc = (overrides = {}) => ({
  _id: CAND,
  tenantId: TENANT,
  requisitionId: REQ,
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  currentStage: 'Interviewing',
  stageHistory: [
    { stage: 'Applied', previousStage: null, at: new Date('2026-01-01') },
    {
      stage: 'Screening',
      previousStage: 'Applied',
      at: new Date('2026-01-08'),
    },
    {
      stage: 'Interviewing',
      previousStage: 'Screening',
      at: new Date('2026-01-15'),
    },
  ],
  offeredCtc: null,
  offerBandCheck: null,
  rejectionReason: '',
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createRequisition', () => {
  it('creates a requisition and returns 201', async () => {
    JobRequisition.create.mockResolvedValue({ _id: REQ });

    const res = makeRes();
    await createRequisition(
      makeReq({
        body: {
          requisitionCode: 'ENG-001',
          title: 'Backend Engineer',
          openings: 2,
          ctcBandMin: 1000000,
          ctcBandMax: 1500000,
        },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('refuses a band whose maximum is below its minimum', async () => {
    // Neither field is wrong on its own; the relationship is.
    const res = makeRes();
    await createRequisition(
      makeReq({
        body: {
          requisitionCode: 'ENG-001',
          title: 'X',
          openings: 1,
          ctcBandMin: 1500000,
          ctcBandMax: 1000000,
        },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(JobRequisition.create).not.toHaveBeenCalled();
  });

  it('turns a duplicate code into a 409', async () => {
    JobRequisition.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    const next = jest.fn();
    await createRequisition(
      makeReq({
        body: {
          requisitionCode: 'ENG-001',
          title: 'X',
          openings: 1,
          ctcBandMin: 1,
          ctcBandMax: 2,
        },
      }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('getRequisitions', () => {
  it('attaches the fill state to each requisition', async () => {
    JobRequisition.find.mockReturnValue(leanResolving([openRequisition()]));
    Candidate.find.mockReturnValue(
      selectLeanResolving([{ requisitionId: REQ, currentStage: 'Hired' }]),
    );

    const res = makeRes();
    await getRequisitions(makeReq(), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.requisitions[0].fill.hired).toBe(1);
    expect(body.requisitions[0].fill.remainingOpenings).toBe(1);
  });

  it('scopes to the caller tenant', async () => {
    JobRequisition.find.mockReturnValue(leanResolving([]));
    Candidate.find.mockReturnValue(selectLeanResolving([]));

    await getRequisitions(makeReq(), makeRes(), jest.fn());

    expect(JobRequisition.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });
});

describe('updateRequisitionStatus', () => {
  it('closes a requisition and reports how many candidates were in flight', async () => {
    // Refusing would leave no way to close a cancelled role; silently
    // abandoning live candidates is worse than saying how many there were.
    const requisition = { ...openRequisition(), save: jest.fn() };
    JobRequisition.findOne.mockResolvedValue(requisition);
    Candidate.find.mockReturnValue(
      selectLeanResolving([
        { currentStage: 'Interviewing' },
        { currentStage: 'Hired' },
      ]),
    );

    const res = makeRes();
    await updateRequisitionStatus(
      makeReq({ params: { id: REQ }, body: { status: 'Closed' } }),
      res,
      jest.fn(),
    );

    expect(requisition.status).toBe('Closed');
    expect(requisition.closedAt).toBeInstanceOf(Date);
    expect(res.json.mock.calls[0][0].candidatesInFlight).toBe(1);
  });

  it('rejects an unknown status', async () => {
    const res = makeRes();
    await updateRequisitionStatus(
      makeReq({ params: { id: REQ }, body: { status: 'Paused' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(JobRequisition.findOne).not.toHaveBeenCalled();
  });

  it('refuses a no-op status change', async () => {
    JobRequisition.findOne.mockResolvedValue({
      ...openRequisition(),
      save: jest.fn(),
    });

    const res = makeRes();
    await updateRequisitionStatus(
      makeReq({ params: { id: REQ }, body: { status: 'Open' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('createCandidate', () => {
  it('seeds the stage history with the application', async () => {
    // The history is the only source the funnel and time-to-hire have, so an
    // application that never writes one is invisible to both.
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));
    Candidate.create.mockResolvedValue({ _id: CAND });

    await createCandidate(
      makeReq({
        body: {
          requisitionId: REQ,
          fullName: 'Asha Rao',
          email: 'asha@example.com',
        },
      }),
      makeRes(),
      jest.fn(),
    );

    const created = Candidate.create.mock.calls[0][0];
    expect(created.currentStage).toBe('Applied');
    expect(created.stageHistory).toHaveLength(1);
    expect(created.stageHistory[0].stage).toBe('Applied');
  });

  it('refuses an application against a requisition that is not open', async () => {
    JobRequisition.findOne.mockReturnValue(
      leanResolving(openRequisition({ status: 'OnHold' })),
    );

    const res = makeRes();
    await createCandidate(
      makeReq({
        body: {
          requisitionId: REQ,
          fullName: 'Asha Rao',
          email: 'asha@example.com',
        },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('turns a repeat application to the same requisition into a 409', async () => {
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));
    Candidate.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    await createCandidate(
      makeReq({
        body: {
          requisitionId: REQ,
          fullName: 'Asha Rao',
          email: 'asha@example.com',
        },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/already applied/);
  });
});

describe('updateCandidateStage', () => {
  it('advances a candidate and appends to the history', async () => {
    const candidate = candidateDoc();
    Candidate.findOne.mockResolvedValue(candidate);
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));

    const res = makeRes();
    await updateCandidateStage(
      makeReq({
        params: { id: CAND },
        body: { stage: 'Offered', offeredCtc: 1200000 },
      }),
      res,
      jest.fn(),
    );

    expect(candidate.currentStage).toBe('Offered');
    expect(candidate.stageHistory).toHaveLength(4);
    expect(candidate.stageHistory[3].previousStage).toBe('Interviewing');
    // Append-only: the earlier entries are untouched.
    expect(candidate.stageHistory[0].stage).toBe('Applied');
  });

  it('refuses an illegal transition and names the legal ones', async () => {
    Candidate.findOne.mockResolvedValue(
      candidateDoc({ currentStage: 'Applied' }),
    );

    const res = makeRes();
    await updateCandidateStage(
      makeReq({ params: { id: CAND }, body: { stage: 'Hired' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].allowedNext).toEqual([
      'Screening',
      'Rejected',
      'Withdrawn',
    ]);
  });

  it('refuses any move out of a terminal stage', async () => {
    Candidate.findOne.mockResolvedValue(
      candidateDoc({ currentStage: 'Rejected' }),
    );

    const res = makeRes();
    await updateCandidateStage(
      makeReq({ params: { id: CAND }, body: { stage: 'Screening' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/terminal/);
  });

  it('refuses an offer above the approved band outright', async () => {
    // Deliberately not an override flag. The band is what finance signed off;
    // exceeding it should mean amending the requisition, which is an audited
    // act by whoever holds MANAGE_REQUISITION.
    Candidate.findOne.mockResolvedValue(candidateDoc());
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));

    const res = makeRes();
    await updateCandidateStage(
      makeReq({
        params: { id: CAND },
        body: { stage: 'Offered', offeredCtc: 1650000, override: true },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].bandCheck.overage).toBe(150000);
    expect(res.json.mock.calls[0][0].hint).toMatch(
      /Amend the requisition band/,
    );
  });

  it('allows a below-band offer and records the check', async () => {
    const candidate = candidateDoc();
    Candidate.findOne.mockResolvedValue(candidate);
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));

    const res = makeRes();
    await updateCandidateStage(
      makeReq({
        params: { id: CAND },
        body: { stage: 'Offered', offeredCtc: 800000 },
      }),
      res,
      jest.fn(),
    );

    expect(candidate.currentStage).toBe('Offered');
    expect(candidate.offerBandCheck.status).toBe('below');
  });

  it('snapshots the band check onto the candidate', async () => {
    // So a later band amendment cannot retroactively make a breach look
    // compliant.
    const candidate = candidateDoc();
    Candidate.findOne.mockResolvedValue(candidate);
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));

    await updateCandidateStage(
      makeReq({
        params: { id: CAND },
        body: { stage: 'Offered', offeredCtc: 1200000 },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(candidate.offerBandCheck).toMatchObject({
      status: 'within',
      ctcBandMax: 1500000,
    });
  });

  it('refuses an offer with no CTC', async () => {
    Candidate.findOne.mockResolvedValue(candidateDoc());
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));

    const res = makeRes();
    await updateCandidateStage(
      makeReq({ params: { id: CAND }, body: { stage: 'Offered' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('refuses a hire against a requisition with no openings left', async () => {
    Candidate.findOne.mockResolvedValue(
      candidateDoc({ currentStage: 'Offered' }),
    );
    JobRequisition.findOne.mockReturnValue(
      leanResolving(openRequisition({ openings: 1 })),
    );
    Candidate.find.mockReturnValue(
      selectLeanResolving([{ currentStage: 'Hired' }]),
    );

    const res = makeRes();
    await updateCandidateStage(
      makeReq({ params: { id: CAND }, body: { stage: 'Hired' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/already filled/);
  });

  it('allows a hire while an opening remains', async () => {
    const candidate = candidateDoc({ currentStage: 'Offered' });
    Candidate.findOne.mockResolvedValue(candidate);
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));
    Candidate.find.mockReturnValue(
      selectLeanResolving([{ currentStage: 'Hired' }]),
    );

    await updateCandidateStage(
      makeReq({ params: { id: CAND }, body: { stage: 'Hired' } }),
      makeRes(),
      jest.fn(),
    );

    expect(candidate.currentStage).toBe('Hired');
  });

  it('records a rejection reason', async () => {
    const candidate = candidateDoc();
    Candidate.findOne.mockResolvedValue(candidate);
    JobRequisition.findOne.mockReturnValue(leanResolving(openRequisition()));

    await updateCandidateStage(
      makeReq({
        params: { id: CAND },
        body: {
          stage: 'Rejected',
          rejectionReason: 'Not enough systems depth',
        },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(candidate.rejectionReason).toBe('Not enough systems depth');
  });

  it('404s on a candidate in another tenant', async () => {
    Candidate.findOne.mockResolvedValue(null);

    const res = makeRes();
    await updateCandidateStage(
      makeReq({ params: { id: CAND }, body: { stage: 'Offered' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Candidate.findOne).toHaveBeenCalledWith({
      _id: CAND,
      tenantId: TENANT,
    });
  });
});

describe('submitFeedback', () => {
  it('files feedback under the caller, not under a body field', async () => {
    Candidate.findOne.mockReturnValue(selectLeanResolving({ _id: CAND }));
    InterviewFeedback.create.mockResolvedValue({ _id: 'f1' });

    await submitFeedback(
      makeReq({
        params: { id: CAND },
        body: {
          round: 'Technical',
          recommendation: 'Hire',
          ratings: [{ competency: 'Coding', score: 4 }],
          interviewerId: 'someone-else',
        },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(InterviewFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({ interviewerId: USER }),
    );
  });

  it('refuses feedback with no ratings', async () => {
    const res = makeRes();
    await submitFeedback(
      makeReq({
        params: { id: CAND },
        body: { round: 'Technical', recommendation: 'Hire', ratings: [] },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('turns a second submission for the same round into a 409', async () => {
    // A second submission is an edit. Letting it become a second row would
    // double-count that interviewer in the average and in the dissent check.
    Candidate.findOne.mockReturnValue(selectLeanResolving({ _id: CAND }));
    InterviewFeedback.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    await submitFeedback(
      makeReq({
        params: { id: CAND },
        body: {
          round: 'Technical',
          recommendation: 'Hire',
          ratings: [{ competency: 'Coding', score: 4 }],
        },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('getScorecard', () => {
  it('applies weights from the query string', async () => {
    Candidate.findOne.mockReturnValue(
      selectLeanResolving({ _id: CAND, fullName: 'Asha' }),
    );
    InterviewFeedback.find.mockReturnValue(
      leanResolving([
        {
          interviewerId: 'a',
          recommendation: 'Hire',
          ratings: [
            { competency: 'Coding', score: 5 },
            { competency: 'Communication', score: 1 },
          ],
        },
      ]),
    );

    const res = makeRes();
    await getScorecard(
      makeReq({
        params: { id: CAND },
        query: { weights: 'Coding:3,Communication:1' },
      }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].scorecard.overallScore).toBe(4);
  });

  it('ignores a malformed weight rather than dropping the feedback', async () => {
    // Losing real interview feedback over a bad query string is worse than
    // weighting it evenly.
    Candidate.findOne.mockReturnValue(selectLeanResolving({ _id: CAND }));
    InterviewFeedback.find.mockReturnValue(
      leanResolving([
        {
          interviewerId: 'a',
          recommendation: 'Hire',
          ratings: [{ competency: 'Coding', score: 4 }],
        },
      ]),
    );

    const res = makeRes();
    await getScorecard(
      makeReq({ params: { id: CAND }, query: { weights: 'Coding:abc,,:' } }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].scorecard.overallScore).toBe(4);
  });
});

describe('getFunnelAnalytics', () => {
  it('returns the funnel, time-to-hire and source breakdown together', async () => {
    Candidate.find.mockReturnValue(
      selectLeanResolving([
        {
          currentStage: 'Hired',
          source: 'Referral',
          appliedAt: new Date('2026-01-01'),
          stageHistory: [
            { stage: 'Applied', at: new Date('2026-01-01') },
            { stage: 'Screening', at: new Date('2026-01-05') },
            { stage: 'Interviewing', at: new Date('2026-01-10') },
            { stage: 'Offered', at: new Date('2026-01-20') },
            { stage: 'Hired', at: new Date('2026-01-31') },
          ],
        },
      ]),
    );

    const res = makeRes();
    await getFunnelAnalytics(makeReq(), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.funnel.reached.Hired).toBe(1);
    expect(body.timeToHire.medianDays).toBe(30);
    expect(body.sources[0].source).toBe('Referral');
  });

  it('ignores a requisitionId filter that is not a valid id', async () => {
    Candidate.find.mockReturnValue(selectLeanResolving([]));

    await getFunnelAnalytics(
      makeReq({ query: { requisitionId: 'nope' } }),
      makeRes(),
      jest.fn(),
    );

    expect(Candidate.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });
});
