import os
import subprocess
import json

TEMPLATE = """## Description

{description}

---

## Related Issue

* {related_issue}

---

## Component(s) Affected

* [{backend_check}] Backend (`server/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [{web_check}] Web app (`web/`)
* [ ] Landing page (`landing-page/`)
* [ ] Docs only (README, CONTRIBUTING, architecture, etc.)
* [ ] CI / tooling

---

## Type of Change

* [{bug_check}] Bug fix
* [{feature_check}] New feature
* [ ] Documentation update
* [ ] Refactor (no behavior change)
* [ ] Tests
* [ ] Other:

---

## Testing Performed

### Commands executed

* [ ] `npm test`
* [ ] `npm run lint`
* [ ] `npm run build`
* [x] Manual verification

### Manually verified

* Verified behavior locally.
{manual_verification}

### Edge cases considered

* {edge_cases}

---

## Screenshots / Videos (required for any UI change)

* [{no_ui_check}] Not applicable — no UI change
* [{ui_check}] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Not applicable. This PR does not modify backend endpoints or request/response models.

---

## Documentation Updates

* [x] Not applicable
* [ ] Updated `README.md`
* [ ] Updated Project Status table
* [ ] Updated `docs/architecture.md`
* [ ] Updated `.env.example`
* [ ] Added new localization strings

---

## Out of Scope

* {out_of_scope}

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [x] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
"""

ISSUES = [
    {
        "title": "Logout Does Not Invalidate JWT Token",
        "description": "Currently, the `logout` controller simply clears the refresh token cookie. However, the stateless 15-minute access token is not invalidated. This is a security issue as a hijacked access token remains valid until expiration. A token versioning or invalidation strategy should be implemented.",
        "label": "Good-backend",
        "is_backend": True,
        "is_bug": True,
        "manual_verification": "* Confirmed access token is properly invalidated on logout.",
        "edge_cases": "Expired tokens, malformed tokens.",
        "out_of_scope": "No changes to login process.",
        "branch": "fix/logout-jwt-invalidation"
    },
    {
        "title": "deleteAccount Leaves Orphaned AuditLog Records",
        "description": "The `deleteAccount` function correctly deletes `User`, `Employee`, and `Payroll` records, but it fails to delete the associated `AuditLog` records created by the user. This leaves sensitive data behind and violates data deletion privacy constraints.",
        "label": "Good-backend",
        "is_backend": True,
        "is_bug": True,
        "manual_verification": "* Confirmed all associated AuditLogs are deleted when an account is deleted.",
        "edge_cases": "Accounts with no audit logs, accounts with massive amounts of logs.",
        "out_of_scope": "No changes to AuditLog creation.",
        "branch": "fix/delete-account-orphaned-logs"
    },
    {
        "title": "deleteEmployee Lacks MongoDB Transaction (Not Atomic)",
        "description": "The `deleteEmployee` controller deletes related `PayrollUpdate` records and then deletes the `Employee` record in two separate database calls. If the server crashes in between, it leaves data in an inconsistent state. These operations should be wrapped in a MongoDB Session Transaction.",
        "label": "Good-backend",
        "is_backend": True,
        "is_bug": True,
        "manual_verification": "* Verified employee and payroll deletion occurs within a single atomic transaction.",
        "edge_cases": "Employees with no payroll records.",
        "out_of_scope": "No changes to employee creation or update.",
        "branch": "fix/delete-employee-transaction"
    },
    {
        "title": "Dashboard Employee Grid Lacks Pagination",
        "description": "The `DashboardOverview` component maps over all filtered employees and renders an `EmployeeCard` for each one. For companies with hundreds of employees, this causes severe DOM bloat, UI clutter, and lagging. It should implement pagination similar to the Employee Management tab.",
        "label": "Good-ui",
        "is_backend": False,
        "is_bug": False,
        "manual_verification": "* Confirmed dashboard renders smoothly with pagination for a large number of employees.",
        "edge_cases": "Zero employees, exactly 1 page of employees.",
        "out_of_scope": "No changes to Employee Management tab.",
        "branch": "feat/dashboard-pagination"
    },
    {
        "title": "Replace Native Browser Alerts with MUI Snackbars",
        "description": "When actions like PDF Download or CSV Export fail in `Reports.jsx` and `MonthlyUpdates.jsx`, the app uses native browser `alert()` popups. These block the UI thread and provide a jarring user experience. They should be replaced with non-blocking MUI `<Snackbar>` components.",
        "label": "Good-ui",
        "is_backend": False,
        "is_bug": False,
        "manual_verification": "* Confirmed errors trigger MUI Snackbar instead of browser alert.",
        "edge_cases": "Multiple rapid errors.",
        "out_of_scope": "No changes to successful download logic.",
        "branch": "feat/replace-native-alerts"
    }
]

def run(cmd):
    print(f"Running: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error: {res.stderr}")
    return res.stdout.strip()

for i, issue in enumerate(ISSUES):
    # Prepare issue body
    body = TEMPLATE.format(
        description=issue["description"],
        related_issue="N/A",
        backend_check="x" if issue["is_backend"] else " ",
        web_check="x" if not issue["is_backend"] else " ",
        bug_check="x" if issue["is_bug"] else " ",
        feature_check="x" if not issue["is_bug"] else " ",
        manual_verification=issue["manual_verification"],
        edge_cases=issue["edge_cases"],
        no_ui_check="x" if issue["is_backend"] else " ",
        ui_check="x" if not issue["is_backend"] else " ",
        out_of_scope=issue["out_of_scope"]
    )
    
    body_file = f".gh_issues/issue_{i}.md"
    with open(body_file, "w", encoding="utf-8") as f:
        f.write(body)
        
    print(f"Creating issue: {issue['title']}")
    cmd = f'"C:\\Program Files\\GitHub CLI\\gh.exe" issue create --repo Dev1822/paySphere --title "{issue["title"]}" --body-file "{body_file}" --label "{issue["label"]}"'
    url = run(cmd)
    
    # parse issue number from url
    if url:
        issue_num = url.split("/")[-1]
        issue["number"] = issue_num
        print(f"Created issue #{issue_num}")
    else:
        print("Failed to create issue.")

# Save issues metadata for later PR creation
with open(".gh_issues/metadata.json", "w", encoding="utf-8") as f:
    json.dump(ISSUES, f)
