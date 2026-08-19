// Enterprise Asset Management & IT Inventory — Service Layer
import { Router, Request, Response } from 'express';
import { createMockAssets, createMockSoftwareLicenses, createMockAssetRequests } from '../models/EnterpriseAssetModel';

const router = Router();
const assets = createMockAssets();
const licenses = createMockSoftwareLicenses();
const requests = createMockAssetRequests();

router.get('/assets', (req: Request, res: Response) => {
  let filtered = [...assets];
  const { status, category, department, search } = req.query;
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (category) filtered = filtered.filter((a) => a.category === category);
  if (department) filtered = filtered.filter((a) => a.department === department);
  if (search) { const q = String(search).toLowerCase(); filtered = filtered.filter((a) => a.name.toLowerCase().includes(q) || a.serialNumber.toLowerCase().includes(q)); }
  res.json({ assets: filtered, total: filtered.length });
});

router.get('/assets/:id', (req: Request, res: Response) => {
  const asset = assets.find((a) => a.id === req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  res.json({ asset });
});

router.get('/licenses', (_req: Request, res: Response) => {
  res.json({ licenses, total: licenses.length });
});

router.get('/requests', (req: Request, res: Response) => {
  let filtered = [...requests];
  const { status } = req.query;
  if (status) filtered = filtered.filter((r) => r.status === status);
  res.json({ requests: filtered, total: filtered.length });
});

router.get('/analytics', (_req: Request, res: Response) => {
  const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
  const activeAssets = assets.filter((a) => a.status === 'active').length;
  const availableAssets = assets.filter((a) => a.status === 'available').length;
  const totalLicenseCost = licenses.reduce((s, l) => s + l.cost, 0);
  const licenseUtilization = licenses.length > 0 ? Math.round(licenses.reduce((s, l) => s + (l.usedSeats / l.totalSeats) * 100, 0) / licenses.length) : 0;
  const expiringLicenses = licenses.filter((l) => l.status === 'expiring').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  res.json({ totalValue, activeAssets, availableAssets, totalAssets: assets.length, totalLicenseCost, licenseUtilization, expiringLicenses, pendingRequests });
});

router.post('/assets/:id/assign', (req: Request, res: Response) => {
  const asset = assets.find((a) => a.id === req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  asset.assignedTo = req.body.assignedTo || null;
  asset.status = asset.assignedTo ? 'active' : 'available';
  asset.department = req.body.department || asset.department;
  res.json({ asset, message: 'Asset assignment updated' });
});

router.post('/requests/:id/approve', (req: Request, res: Response) => {
  const request = requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });
  request.status = 'approved';
  res.json({ request, message: 'Request approved' });
});

export default router;
