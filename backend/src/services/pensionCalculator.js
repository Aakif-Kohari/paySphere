const { PensionPolicy, EmployeePensionSetting } = require('../models/pensionPolicy.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

/**
 * Service to calculate employee and employer retirement pension contributions.
 */
class PensionCalculatorService {
  /**
   * Calculates monthly pension contributions based on regional policy caps and overrides.
   * 
   * @param {string} employeeId - Employee ID
   * @param {string} tenantId - Tenant ID
   * @param {number} baseSalary - Monthly base salary
   * @returns {Promise<{employeeContribution: number, employerContribution: number, planName: string}>}
   */
  async calculatePensionContribution(employeeId, tenantId, baseSalary) {
    try {
      // 1. Fetch employee's pension settings
      let setting = await EmployeePensionSetting.findOne({ employeeId, tenantId }).populate('pensionPolicyId');
      
      // Auto-enrolment fallback: if no setting exists, auto-enrol based on region/country
      if (!setting) {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          return { employeeContribution: 0, employerContribution: 0, planName: 'None' };
        }

        // Map country/address to regional plan
        const country = (employee.address && employee.address.country) || 'US';
        const regionKey = country.toUpperCase() === 'IN' || country.toUpperCase() === 'INDIA' ? 'IN' : 'US';

        const defaultPolicy = await PensionPolicy.findOne({ tenantId, region: regionKey, isActive: true });
        if (!defaultPolicy) {
          // If no default policy found, skip contribution
          return { employeeContribution: 0, employerContribution: 0, planName: 'None' };
        }

        // Auto-enrol employee
        setting = await EmployeePensionSetting.create({
          tenantId,
          employeeId,
          pensionPolicyId: defaultPolicy._id,
          isEnrolled: true
        });
        setting.pensionPolicyId = defaultPolicy;
        logger.info(`Auto-enrolled employee ${employeeId} in ${defaultPolicy.planName} policy.`);
      }

      if (!setting.isEnrolled || !setting.pensionPolicyId) {
        return { employeeContribution: 0, employerContribution: 0, planName: 'None' };
      }

      const policy = setting.pensionPolicyId;

      // 2. Resolve rates
      const employeeRate = setting.customEmployeeContributionRate !== null && setting.customEmployeeContributionRate !== undefined
        ? setting.customEmployeeContributionRate
        : policy.employeeContributionRate;

      const employerRate = setting.customEmployerContributionRate !== null && setting.customEmployerContributionRate !== undefined
        ? setting.customEmployerContributionRate
        : policy.employerContributionRate;

      // 3. Apply salary caps
      const eligibleSalary = policy.monthlySalaryCap && baseSalary > policy.monthlySalaryCap
        ? policy.monthlySalaryCap
        : baseSalary;

      // 4. Calculate portions
      const employeeContribution = Math.round((eligibleSalary * employeeRate) / 100);
      const employerContribution = Math.round((eligibleSalary * employerRate) / 100);

      return {
        employeeContribution,
        employerContribution,
        planName: policy.planName
      };

    } catch (error) {
      logger.error('Error during pension contribution calculation', { error: error.message });
      return { employeeContribution: 0, employerContribution: 0, planName: 'Error' };
    }
  }
}

module.exports = new PensionCalculatorService();
