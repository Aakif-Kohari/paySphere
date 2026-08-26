// @ts-nocheck
// Enterprise Vendor Management & Procurement Suite — Service Layer
// Express router exposing vendor, PO, invoice, and contract endpoints

import { Router, Request, Response } from 'express';
import {
  createMockVendors,
  createMockPurchaseOrders,
  createMockInvoices,
  createMockContracts,
  computeVendorSpendByCategory,
  computeRiskSummary,
  IVendor,
  IPurchaseOrder,
  IInvoice,
  IProcurementContract,
} from '../models/EnterpriseVendorModel';

const router = Router();

const vendors = createMockVendors();
const purchaseOrders = createMockPurchaseOrders();
const invoices = createMockInvoices();
const contracts = createMockContracts();

// GET /api/vendor-management/vendors — list all vendors with optional filters
router.get('/vendors', (req: Request, res: Response) => {
  let filtered = [...vendors];
  const { status, tier, category, search } = req.query;
  if (status) filtered = filtered.filter((v) => v.status === status);
  if (tier) filtered = filtered.filter((v) => v.tier === tier);
  if (category) filtered = filtered.filter((v) => v.category === category);
  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter((v) => v.name.toLowerCase().includes(q) || v.legalEntity.toLowerCase().includes(q));
  }
  res.json({ vendors: filtered, total: filtered.length });
});

// GET /api/vendor-management/vendors/:id — single vendor detail
router.get('/vendors/:id', (req: Request, res: Response) => {
  const vendor = vendors.find((v) => v.id === req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  const vendorPOs = purchaseOrders.filter((p) => p.vendorId === vendor.id);
  const vendorInvoices = invoices.filter((i) => i.vendorId === vendor.id);
  const vendorContract = contracts.find((c) => c.vendorId === vendor.id);
  res.json({ vendor, purchaseOrders: vendorPOs, invoices: vendorInvoices, contract: vendorContract });
});

// GET /api/vendor-management/purchase-orders — list POs with optional status filter
router.get('/purchase-orders', (req: Request, res: Response) => {
  let filtered = [...purchaseOrders];
  const { status } = req.query;
  if (status) filtered = filtered.filter((p) => p.status === status);
  res.json({ purchaseOrders: filtered, total: filtered.length });
});

// GET /api/vendor-management/invoices — list invoices with optional status filter
router.get('/invoices', (req: Request, res: Response) => {
  let filtered = [...invoices];
  const { status } = req.query;
  if (status) filtered = filtered.filter((i) => i.status === status);
  res.json({ invoices: filtered, total: filtered.length });
});

// GET /api/vendor-management/contracts — list contracts with optional status filter
router.get('/contracts', (req: Request, res: Response) => {
  let filtered = [...contracts];
  const { status } = req.query;
  if (status) filtered = filtered.filter((c) => c.status === status);
  res.json({ contracts: filtered, total: filtered.length });
});

// GET /api/vendor-management/analytics — aggregated procurement intelligence
router.get('/analytics', (_req: Request, res: Response) => {
  const totalVendorSpend = vendors.reduce((sum, v) => sum + v.totalSpendYTD, 0);
  const spendByCategory = computeVendorSpendByCategory(vendors);
  const riskSummary = computeRiskSummary(vendors);

  const openPOAmount = purchaseOrders
    .filter((p) => ['draft', 'pending_approval', 'approved', 'sent'].includes(p.status))
    .reduce((sum, p) => sum + p.total, 0);

  const overdueInvoiceAmount = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const pendingInvoiceAmount = invoices
    .filter((i) => ['received', 'matched', 'discrepancy'].includes(i.status))
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const expiringContracts = contracts.filter((c) => c.status === 'expiring_30d' || c.status === 'expiring_90d');

  res.json({
    totalVendorSpend,
    activeVendorCount: vendors.filter((v) => v.status === 'active').length,
    totalVendors: vendors.length,
    spendByCategory,
    riskSummary,
    openPOAmount,
    overdueInvoiceAmount,
    pendingInvoiceAmount,
    expiringContracts: expiringContracts.length,
    contracts: expiringContracts,
    threeWayMatchRate: invoices.length > 0 ? (invoices.filter((i) => i.threeWayMatch).length / invoices.length * 100).toFixed(1) : '0',
  });
});

// POST /api/vendor-management/vendors/:id/risk-assessment — update vendor risk score
router.post('/vendors/:id/risk-assessment', (req: Request, res: Response) => {
  const vendor = vendors.find((v) => v.id === req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  const { riskScore, flags } = req.body;
  if (typeof riskScore === 'number') vendor.riskScore = riskScore;
  if (Array.isArray(flags)) vendor.complianceFlags = flags;
  res.json({ vendor, message: 'Risk assessment updated' });
});

// POST /api/vendor-management/invoices/:id/approve — approve an invoice for payment
router.post('/invoices/:id/approve', (req: Request, res: Response) => {
  const invoice = invoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });
  invoice.status = 'approved';
  invoice.matchedAt = new Date().toISOString();
  res.json({ invoice, message: 'Invoice approved for payment' });
});

export default router;
