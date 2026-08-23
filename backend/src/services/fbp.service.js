const FbpConfig = require('../models/fbpConfig.model');
const FbpDeclaration = require('../models/fbpDeclaration.model');
const SalaryStructure = require('../models/salaryStructure.model');
const Employee = require('../models/employee.model');
const TaxService = require('./tax.service');
const { REVISION_REASON } = require('../config/salaryComponents');

class FbpService {
  /**
   * Create or update an FBP window configuration.
   */
  static async createWindow(tenantId, adminId, configData) {
    const config = new FbpConfig({
      tenantId,
      createdBy: adminId,
      windowStartDate: configData.windowStartDate,
      windowEndDate: configData.windowEndDate,
      status: configData.status || 'CLOSED',
      componentCaps: configData.componentCaps || [],
    });
    return await config.save();
  }

  /**
   * Fetch open windows for an employee.
   */
  static async getOpenWindows(tenantId) {
    const now = new Date();
    return await FbpConfig.find({
      tenantId,
      status: 'OPEN',
      windowStartDate: { $lte: now },
      windowEndDate: { $gte: now },
    });
  }

  /**
   * Simulates tax impact for proposed components.
   * Total CTC must exactly match the current active salary structure.
   */
  static async simulateTaxImpact(employeeId, proposedComponents) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    const activeStructure = await SalaryStructure.findOne({ employeeId })
      .sort({ effectiveFrom: -1 })
      .exec();

    if (!activeStructure) throw new Error('Active salary structure not found');

    let totalProposedValue = 0;
    let nonTaxableExemptions = 0;

    for (const comp of proposedComponents) {
      totalProposedValue += comp.value;
      if (!comp.taxable) {
        nonTaxableExemptions += comp.value * 12; // annualized exemption
      }
    }

    // A simple sum-check. (In reality, basic & percentages would be calculated, but assuming flat values for the simulation)
    // If the proposed components' total doesn't match the current gross monthly, throw.
    if (Math.abs(totalProposedValue - activeStructure.grossMonthly) > 1) {
      throw new Error(
        'Proposed components total must exactly equal the current gross monthly/CTC',
      );
    }

    // Default to 'IN' or similar for region based on currency
    const region = employee.currency === 'INR' ? 'IN' : 'US';

    const taxSimulation = await TaxService.calculateTax(
      employee.tenantId,
      region,
      activeStructure.grossMonthly * 12,
      {
        regime: 'NEW',
        exemptions: nonTaxableExemptions,
      },
    );

    const monthlyTax = taxSimulation.totalTax / 12;
    const projectedNetMonthly = activeStructure.grossMonthly - monthlyTax;

    return {
      grossMonthly: activeStructure.grossMonthly,
      projectedNetMonthly,
      monthlyTax,
      nonTaxableExemptionsAnnual: nonTaxableExemptions,
    };
  }

  /**
   * Submit an FBP restructuring declaration.
   */
  static async submitDeclaration(employeeId, fbpConfigId, proposedComponents) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    const config = await FbpConfig.findById(fbpConfigId);
    if (!config || config.status !== 'OPEN') {
      throw new Error('FBP window is not open or does not exist');
    }

    // Check caps
    for (const cap of config.componentCaps) {
      const comp = proposedComponents.find((c) => c.code === cap.code);
      if (comp) {
        if (cap.maxMonetaryLimit && comp.value > cap.maxMonetaryLimit) {
          throw new Error(
            `Component ${cap.code} exceeds maximum monetary limit of ${cap.maxMonetaryLimit}`,
          );
        }
      }
    }

    const activeStructure = await SalaryStructure.findOne({ employeeId })
      .sort({ effectiveFrom: -1 })
      .exec();

    if (!activeStructure) throw new Error('Active salary structure not found');

    let totalProposedValue = 0;
    for (const comp of proposedComponents) {
      totalProposedValue += comp.value;
    }

    if (Math.abs(totalProposedValue - activeStructure.grossMonthly) > 1) {
      throw new Error(
        'Proposed components total must exactly equal the current gross monthly/CTC',
      );
    }

    const declaration = new FbpDeclaration({
      tenantId: employee.tenantId,
      employeeId,
      fbpConfigId,
      proposedComponents,
      totalCtc: activeStructure.grossMonthly,
      status: 'PENDING',
    });

    return await declaration.save();
  }

  /**
   * Approve a pending declaration and update the salary structure.
   */
  static async approveDeclaration(declarationId, adminId) {
    const declaration = await FbpDeclaration.findById(declarationId);
    if (!declaration) throw new Error('Declaration not found');
    if (declaration.status !== 'PENDING')
      throw new Error('Declaration is not pending');

    declaration.status = 'APPROVED';
    declaration.reviewedBy = adminId;
    declaration.reviewedAt = new Date();

    const currentStructure = await SalaryStructure.findOne({
      employeeId: declaration.employeeId,
    })
      .sort({ effectiveFrom: -1 })
      .exec();

    if (!currentStructure)
      throw new Error('Current salary structure not found');

    // Create a new salary structure revision based on the approved components
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);

    const newStructure = new SalaryStructure({
      tenantId: declaration.tenantId,
      employeeId: declaration.employeeId,
      createdBy: adminId,
      effectiveFrom: nextMonth,
      components: declaration.proposedComponents,
      grossMonthly: currentStructure.grossMonthly,
      ctcAnnual: currentStructure.ctcAnnual,
      reason: REVISION_REASON.FBP_REVISION,
      note: 'FBP Restructuring approved',
      revisedBy: adminId,
    });

    await newStructure.save();
    return await declaration.save();
  }

  /**
   * Reject a pending declaration.
   */
  static async rejectDeclaration(declarationId, adminId, reason) {
    const declaration = await FbpDeclaration.findById(declarationId);
    if (!declaration) throw new Error('Declaration not found');
    if (declaration.status !== 'PENDING')
      throw new Error('Declaration is not pending');

    declaration.status = 'REJECTED';
    declaration.reviewedBy = adminId;
    declaration.reviewedAt = new Date();
    declaration.note = reason;

    return await declaration.save();
  }
}

module.exports = FbpService;
