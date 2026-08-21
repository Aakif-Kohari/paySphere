const {
  normalizeLanguage,
  translate,
  resolveEmployeeLanguage,
  SUPPORTED_LANGUAGES,
} = require('../i18n');

describe('backend i18n', () => {
  test('supports the employee-facing languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es', 'hi']);
  });

  test.each([
    ['en', 'en'],
    ['English', 'en'],
    ['English (US)', 'en'],
    ['es', 'es'],
    ['Spanish', 'es'],
    ['hi', 'hi'],
    ['Hindi', 'hi'],
    ['unknown', 'en'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });

  test('translates payslip subject and labels', () => {
    expect(translate('es', 'payslipSubject', { month: 8, year: 2026 })).toBe(
      'Recibo de nómina de 8/2026',
    );
    expect(translate('hi', 'netSalary')).toBe('शुद्ध वेतन');
  });

  test('falls back to English for unsupported languages', () => {
    expect(translate('fr', 'netSalary')).toBe('Net Salary');
  });

  test('prefers employee language over creator profile language', () => {
    expect(
      resolveEmployeeLanguage(
        { language: 'es' },
        { settings: { preferences: { language: 'Hindi' } } },
      ),
    ).toBe('es');
  });

  test('falls back to creator profile language when employee language is absent', () => {
    expect(
      resolveEmployeeLanguage(
        {},
        { settings: { preferences: { language: 'Spanish' } } },
      ),
    ).toBe('es');
  });
});
