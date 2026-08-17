const fs = require('fs');
const path = require('path');

const {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} = require('../../models/auditLog.model');

const CONTROLLERS_DIR = path.resolve(__dirname, '../../controllers');

/**
 * Every `eventBus.emit('AUDIT_LOG', { ... })` in the controllers, with the
 * `action` and `resourceType` it passes.
 *
 * A source scan rather than a runtime check because there is no way to exercise
 * thirty-three emit sites in a unit test, and the failure this guards against
 * is entirely static: someone adds a feature, emits a new action, and never
 * touches the enum. `createAuditLog` swallows its own errors, so the write is
 * dropped with a log line and the feature looks audited when it is not — which
 * is how eight actions and three resource types drifted out of the schema
 * before #664.
 */
function collectEmits() {
  const emits = [];

  for (const file of fs.readdirSync(CONTROLLERS_DIR)) {
    if (!file.endsWith('.controller.js')) continue;

    const source = fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8');
    const pattern = /eventBus\.emit\(\s*['"]AUDIT_LOG['"]\s*,\s*\{([\s\S]*?)\n\s*\}\);/g;

    let match;
    while ((match = pattern.exec(source)) !== null) {
      const body = match[1];
      const action = body.match(/action:\s*['"]([A-Z_]+)['"]/);
      const resourceType = body.match(/resourceType:\s*['"](\w+)['"]/);

      emits.push({
        file,
        action: action?.[1] || null,
        resourceType: resourceType?.[1] || null,
        line: source.slice(0, match.index).split('\n').length,
      });
    }
  }

  return emits;
}

const EMITS = collectEmits();

describe('audit vocabulary — emitted values must be values the schema accepts (#664)', () => {
  test('the scan finds the emit sites it is supposed to guard', () => {
    // A regex that silently matches nothing would make every test below pass.
    expect(EMITS.length).toBeGreaterThanOrEqual(30);
  });

  test('every emit names an action and a resource type', () => {
    const incomplete = EMITS.filter((e) => !e.action || !e.resourceType);

    expect(incomplete).toEqual([]);
  });

  test.each(
    [...new Set(EMITS.map((e) => e.action))].sort().map((action) => [action]),
  )('AUDIT_ACTIONS accepts %s', (action) => {
    expect(AUDIT_ACTIONS).toContain(action);
  });

  test.each(
    [...new Set(EMITS.map((e) => e.resourceType))]
      .sort()
      .map((resourceType) => [resourceType]),
  )('AUDIT_RESOURCE_TYPES accepts %s', (resourceType) => {
    expect(AUDIT_RESOURCE_TYPES).toContain(resourceType);
  });

  test('the eight actions missing when #664 was filed are all present', () => {
    for (const action of [
      'EMPLOYEE_STATUS_TOGGLE',
      'EMPLOYEE_RESTORE',
      'SALARY_HISTORY_CREATE',
      'SALARY_HISTORY_EXPORT',
      'SALARY_HISTORY_DELETE',
      'WORKFLOW_CREATE',
      'WORKFLOW_INSTANCE_START',
      'WORKFLOW_TRANSITION',
    ]) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });

  test('the three resource types missing when #664 was filed are all present', () => {
    for (const type of ['SalaryHistory', 'Workflow', 'WorkflowInstance']) {
      expect(AUDIT_RESOURCE_TYPES).toContain(type);
    }
  });

  test('the vocabulary has no duplicates', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
    expect(new Set(AUDIT_RESOURCE_TYPES).size).toBe(AUDIT_RESOURCE_TYPES.length);
  });
});
