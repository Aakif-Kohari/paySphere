const SUPPORTED_LANGUAGES = Object.freeze(['en', 'es', 'hi']);
const DEFAULT_LANGUAGE = 'en';

const messages = Object.freeze({
  en: {
    payslipSubject: ({ month, year }) => `Payslip for ${month}/${year}`,
    payslipGreeting: ({ name }) => `Hello ${name},`,
    payslipBody: ({ month, year }) =>
      `Please find attached your payslip for ${month}/${year}.`,
    regards: 'Best Regards,',
    team: 'PaySphere Team',
    payslipTitle: ({ month, year }) => `Payslip for ${month}/${year}`,
    employeeName: 'Employee Name',
    role: 'Role',
    company: 'Company',
    baseSalary: 'Base Salary',
    leaveDays: 'Leave Days',
    overtimeHours: 'Overtime Hours',
    bonus: 'Bonus',
    deductions: 'Deductions',
    reimbursements: 'Reimbursements (Tax-Free)',
    expenseReimbursements: 'Expense Reimbursements',
    netSalary: 'Net Salary',
    notAvailable: 'N/A',
  },
  es: {
    payslipSubject: ({ month, year }) => `Recibo de nómina de ${month}/${year}`,
    payslipGreeting: ({ name }) => `Hola ${name},`,
    payslipBody: ({ month, year }) =>
      `Adjuntamos su recibo de nómina de ${month}/${year}.`,
    regards: 'Saludos cordiales,',
    team: 'Equipo de PaySphere',
    payslipTitle: ({ month, year }) => `Recibo de nómina de ${month}/${year}`,
    employeeName: 'Nombre del empleado',
    role: 'Puesto',
    company: 'Empresa',
    baseSalary: 'Salario base',
    leaveDays: 'Días de ausencia',
    overtimeHours: 'Horas extra',
    bonus: 'Bono',
    deductions: 'Deducciones',
    reimbursements: 'Reembolsos (libres de impuestos)',
    expenseReimbursements: 'Reembolsos de gastos',
    netSalary: 'Salario neto',
    notAvailable: 'N/D',
  },
  hi: {
    payslipSubject: ({ month, year }) => `${month}/${year} की वेतन पर्ची`,
    payslipGreeting: ({ name }) => `नमस्ते ${name},`,
    payslipBody: ({ month, year }) =>
      `कृपया ${month}/${year} की अपनी वेतन पर्ची संलग्न देखें।`,
    regards: 'सादर,',
    team: 'PaySphere टीम',
    payslipTitle: ({ month, year }) => `${month}/${year} की वेतन पर्ची`,
    employeeName: 'कर्मचारी का नाम',
    role: 'पद',
    company: 'कंपनी',
    baseSalary: 'मूल वेतन',
    leaveDays: 'छुट्टी के दिन',
    overtimeHours: 'ओवरटाइम घंटे',
    bonus: 'बोनस',
    deductions: 'कटौतियां',
    reimbursements: 'प्रतिपूर्ति (कर-मुक्त)',
    expenseReimbursements: 'खर्च प्रतिपूर्ति',
    netSalary: 'शुद्ध वेतन',
    notAvailable: 'उपलब्ध नहीं',
  },
});

function normalizeLanguage(value) {
  if (!value) return DEFAULT_LANGUAGE;
  const normalized = String(value).trim().toLowerCase().replace('_', '-');
  const alias = {
    english: 'en',
    'english (us)': 'en',
    en: 'en',
    spanish: 'es',
    español: 'es',
    es: 'es',
    hindi: 'hi',
    हिन्दी: 'hi',
    hi: 'hi',
  }[normalized];
  return SUPPORTED_LANGUAGES.includes(alias) ? alias : DEFAULT_LANGUAGE;
}

function getMessages(language) {
  return messages[normalizeLanguage(language)];
}

function translate(language, key, variables = {}) {
  const dictionary = getMessages(language);
  const value = dictionary[key] || messages[DEFAULT_LANGUAGE][key];
  return typeof value === 'function' ? value(variables) : value;
}

function resolveEmployeeLanguage(employee, user) {
  return normalizeLanguage(
    employee?.language ||
      employee?.locale ||
      user?.settings?.preferences?.language ||
      DEFAULT_LANGUAGE,
  );
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  getMessages,
  translate,
  resolveEmployeeLanguage,
};
