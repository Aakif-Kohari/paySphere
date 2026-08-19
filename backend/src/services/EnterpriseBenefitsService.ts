// Enterprise Benefits & Compensation Management Suite — Service Layer
// Express router exposing benefits plans, enrollments, and compensation band endpoints

import { Router, Request, Response } from 'express';
import {
  createMockBenefitsPlans,
  createMockEnrollments,
  createMockCompensationBands,
  computeBenefitsSpend,
  computeEnrollmentByType,
} from '../models/EnterpriseBenefitsModel';

const router = Router();

const plans = createMockBenefitsPlans();
const enrollments = createMockEnrollments();
const compensationBands = createMockCompensationBands();

// GET /api/benefits/plans — list all benefits plans with optional type filter
router.get('/plans', (req: Request, res: Response) => {
  let filtered = [...plans];
  const { type, active } = req.query;
  if (type) filtered = filtered.filter((p) => p.type === type);
  if (active !== undefined) filtered = filtered.filter((p) => p.isActive === (active === 'true'));
  res.json({ plans: filtered, total: filtered.length });
});

// GET /api/benefits/plans/:id — single plan detail
router.get('/plans/:id', (req: Request, res: Response) => {
  const plan = plans.find((p) => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const planEnrollments = enrollments.filter((e) => e.planId === plan.id);
  res.json({ plan, enrollments: planEnrollments });
});

// GET /api/benefits/enrollments — list enrollments with optional filters
router.get('/enrollments', (req: Request, res: Response) => {
  let filtered = [...enrollments];
  const { status, planType, department, search } = req.query;
  if (status) filtered = filtered.filter((e) => e.status === status);
  if (planType) filtered = filtered.filter((e) => e.planType === planType);
  if (department) filtered = filtered.filter((e) => e.department === department);
  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter((e) => e.employeeName.toLowerCase().includes(q) || e.planName.toLowerCase().includes(q));
  }
  res.json({ enrollments: filtered, total: filtered.length });
});

// GET /api/benefits/enrollments/:id — single enrollment detail
router.get('/enrollments/:id', (req: Request, res: Response) => {
  const enrollment = enrollments.find((e) => e.id === req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
  const plan = plans.find((p) => p.id === enrollment.planId);
  res.json({ enrollment, plan });
});

// GET /api/benefits/compensation-bands — list compensation bands
router.get('/compensation-bands', (req: Request, res: Response) => {
  let filtered = [...compensationBands];
  const { grade, location } = req.query;
  if (grade) filtered = filtered.filter((cb) => cb.grade === grade);
  if (location) filtered = filtered.filter((cb) => cb.location.toLowerCase().includes(String(location).toLowerCase()));
  res.json({ compensationBands: filtered, total: filtered.length });
});

// GET /api/benefits/analytics — aggregated benefits intelligence
router.get('/analytics', (_req: Request, res: Response) => {
  const spend = computeBenefitsSpend(enrollments);
  const byType = computeEnrollmentByType(enrollments);
  const totalWorkforce = 621;
  const enrollmentRate = ((spend.activeEnrollments / totalWorkforce) * 100).toFixed(1);
  const totalCompBudget = compensationBands.reduce((s, cb) => s + cb.totalCompRange.max * cb.headcount, 0);

  res.json({
    ...spend,
    enrollmentRate,
    totalWorkforce,
    byType,
    compensationBands,
    totalCompBudget,
    avgCompPerEmployee: Math.round(totalCompBudget / totalWorkforce),
  });
});

// POST /api/benefits/enrollments/:id/update-tier — update enrollment tier
router.post('/enrollments/:id/update-tier', (req: Request, res: Response) => {
  const enrollment = enrollments.find((e) => e.id === req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
  const { tier } = req.body;
  if (!['individual', 'couple', 'family'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  enrollment.selectedTier = tier;
  const plan = plans.find((p) => p.id === enrollment.planId);
  const tierData = plan?.tiers.find((t) => t.tier === tier);
  if (tierData) {
    enrollment.monthlyPremium = tierData.monthlyPremium;
    enrollment.employerContribution = Math.round(tierData.monthlyPremium * 0.8);
    enrollment.employeeContribution = tierData.monthlyPremium - enrollment.employerContribution;
  }
  res.json({ enrollment, message: 'Tier updated successfully' });
});

// POST /api/benefits/enrollments/:id/terminate — terminate enrollment
router.post('/enrollments/:id/terminate', (req: Request, res: Response) => {
  const enrollment = enrollments.find((e) => e.id === req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
  if (enrollment.status === 'terminated') return res.status(400).json({ error: 'Already terminated' });
  enrollment.status = 'terminated';
  enrollment.terminationDate = new Date().toISOString();
  res.json({ enrollment, message: 'Enrollment terminated' });
});

export default router;
