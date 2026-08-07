const fs = require('fs');
const { execSync } = require('child_process');

function exec(cmd) {
  console.log(`Executing: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function replace(file, search, replacement) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replacement);
  fs.writeFileSync(file, content);
}

function processPR(issueNo, file, search, replacement, msg, title) {
  exec('git checkout main');
  exec('git pull upstream main || true');
  const branch = `fix/issue-${issueNo}`;
  try { exec(`git branch -D ${branch}`); } catch(e) {}
  exec(`git checkout -b ${branch}`);
  
  if (Array.isArray(search)) {
    for (let i = 0; i < search.length; i++) {
      replace(file, search[i], replacement[i]);
    }
  } else {
    replace(file, search, replacement);
  }
  
  // Write PR body
  if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues');
  const bodyFile = `.gh_issues/pr_${issueNo}.md`;
  fs.writeFileSync(bodyFile, `## Description\n\nThis PR resolves lint errors as reported in Issue #${issueNo}.\n\n### Fixes Applied\n- Fixed unused variables/imports and logic block scoping to pass CI linting.\n\nCloses #${issueNo}\n`);
  
  exec(`git add ${file} ${bodyFile}`);
  exec(`git commit -m "fix: ${msg} (Closes #${issueNo})"`);
  exec(`git push origin ${branch} -f`);
  exec(`gh pr create --repo Dev1822/paySphere --title "${title}" --body-file ${bodyFile} --head Prathvikmehra:${branch} --base main`);
}

// 606: payroll.controller.js
processPR(
  606,
  'backend/src/controllers/payroll.controller.js',
  "const TaxService = require('../services/tax.service');\n",
  "",
  "Remove unused TaxService import",
  "Fix: Unused Service Import in payroll.controller.js"
);

// 607: user.controller.js
processPR(
  607,
  'backend/src/controllers/user.controller.js',
  [
    "const Tenant = require('../models/tenant.model');\n", 
    "  } catch (error) {\n    next(error);\n  }\n  if (user.isTwoFactorEnabled) {\n    return res.status(200).json({\n      requires2FA: true,\n      userId: user._id,\n      message: \"Two-Factor Authentication code required\",\n    });\n  }", 
    "const token = generateTokens(user, res);"
  ],
  [
    "",
    "    if (user.isTwoFactorEnabled) {\n      return res.status(200).json({\n        requires2FA: true,\n        userId: user._id,\n        message: \"Two-Factor Authentication code required\",\n      });\n    }\n  } catch (error) {\n    next(error);\n  }",
    "const { generateTokens } = require('../utils/generateToken');\n    const token = generateTokens(user, res);"
  ],
  "Fix undefined vars in user.controller.js",
  "Fix: Undefined Variables and Unused Model in user.controller.js"
);
