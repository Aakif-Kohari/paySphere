'use strict';
const mongoose      = require('mongoose');
const PayrollUpdate = require('../models/payroll.model');
const Budget        = require('../models/budget.model');
const logger        = require('./logger');

async function aggregateByMonth(tenantId, year, month) {
  return PayrollUpdate.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), month: Number(month), year: Number(year), status: { $in: ['completed','approved'] } } },
    { $group: { _id: '$department', totalGross: { $sum: '$grossPay' }, totalNet: { $sum: '$netPay' }, headcount: { $sum: 1 }, avgSalary: { $avg: '$monthlySalary' } } },
    { $project: { department: '$_id', totalGross: 1, totalNet: 1, headcount: 1, avgSalary: 1, _id: 0 } },
    { $sort: { department: 1 } },
  ]);
}

async function getMonthlyVariance(tenantId, year, month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const [current, previous, budgets] = await Promise.all([
    aggregateByMonth(tenantId, year, month),
    aggregateByMonth(tenantId, prevYear, prevMonth),
    Budget.find({ tenantId, year: Number(year), month: Number(month) }).lean(),
  ]);
  const prevMap   = {}; previous.forEach(d => { prevMap[d.department]   = d; });
  const budgetMap = {}; budgets.forEach(b  => { budgetMap[b.department] = b; });
  const departments = current.map(curr => {
    const prev   = prevMap[curr.department]   || { totalGross: 0, headcount: 0 };
    const budget = budgetMap[curr.department] || {};
    const delta  = curr.totalGross - prev.totalGross;
    const dpc    = prev.totalGross > 0 ? (delta / prev.totalGross) * 100 : null;
    return {
      department:     curr.department,
      current:        { gross: curr.totalGross, net: curr.totalNet, headcount: curr.headcount, avgSalary: curr.avgSalary },
      previous:       { gross: prev.totalGross, headcount: prev.headcount },
      delta,
      deltaPercent:   dpc !== null ? Number(dpc.toFixed(2)) : null,
      budgetedGross:  budget.budgetedGross || null,
      budgetVariance: budget.budgetedGross != null ? curr.totalGross - budget.budgetedGross : null,
    };
  });
  const totals = departments.reduce((a, d) => ({ gross: a.gross + d.current.gross, headcount: a.headcount + d.current.headcount }), { gross: 0, headcount: 0 });
  return { year, month, departments, totals };
}

async function getAnnualForecast(tenantId, year) {
  const results = []; let rolling = [];
  for (let m = 1; m <= 12; m++) {
    let data = [];
    try { data = await aggregateByMonth(tenantId, year, m); } catch (err) { logger.error('forecast agg failed', { m, error: err.message }); }
    const g = data.reduce((s, d) => s + d.totalGross, 0);
    if (g > 0) {
      rolling.push(g); if (rolling.length > 3) rolling.shift();
      results.push({ month: m, actual: g, projected: null });
    } else {
      const p = rolling.length ? rolling.reduce((s,v) => s+v,0)/rolling.length : null;
      results.push({ month: m, actual: null, projected: p ? Number(p.toFixed(2)) : null });
    }
  }
  return results;
}

module.exports = { getMonthlyVariance, getAnnualForecast };