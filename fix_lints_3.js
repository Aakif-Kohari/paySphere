const fs = require('fs');
const { execSync } = require('child_process');

function exec(cmd) {
  console.log(`Executing: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues', { recursive: true });

// 609: payroll.socket.js
let payrollSocketContent = fs.readFileSync('backend/src/sockets/payroll.socket.js', 'utf8');
payrollSocketContent = payrollSocketContent.replace(/catch \((err|error)\) \{\s*\}/g, "catch (error) { logger.error(error); }");
payrollSocketContent = payrollSocketContent.replace(/catch \(err\)/g, "catch (error)");
fs.writeFileSync('backend/src/sockets/payroll.socket.js', payrollSocketContent);
exec('git checkout main');
exec('git pull upstream main || true');
const branch609 = `fix/issue-609`;
try { exec(`git branch -D ${branch609}`); } catch(e) {}
exec(`git checkout -b ${branch609}`);
if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues', { recursive: true });
fs.writeFileSync('.gh_issues/pr_609.md', `## Description\n\nFix unused err variable.\n\nCloses #609\n`);
exec(`git add backend/src/sockets/payroll.socket.js .gh_issues/pr_609.md`);
exec(`git commit -m "fix: Unused error variable in socket (Closes #609)"`);
exec(`git push origin ${branch609} -f`);
exec(`gh pr create --repo Dev1822/paySphere --title "Fix: Unused Error Variable in payroll.socket.js" --body-file .gh_issues/pr_609.md --head Prathvikmehra:${branch609} --base main`);

// 610: pdf.worker.js
let pdfContent = fs.readFileSync('backend/src/workers/pdf.worker.js', 'utf8');
pdfContent = pdfContent.replace("const { type, payload } = data;", "const { type, payload } = workerData;");
pdfContent = pdfContent.replace(/catch \(err\) \{\}/g, "catch (error) { console.error(error); }");
pdfContent = pdfContent.replace(/catch \(err\) \{\s*\}/g, "catch (error) { console.error(error); }");
fs.writeFileSync('backend/src/workers/pdf.worker.js', pdfContent);
exec('git checkout main');
exec('git pull upstream main || true');
const branch610 = `fix/issue-610`;
try { exec(`git branch -D ${branch610}`); } catch(e) {}
exec(`git checkout -b ${branch610}`);
if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues', { recursive: true });
fs.writeFileSync('.gh_issues/pr_610.md', `## Description\n\nFix lint errors in pdf worker.\n\nCloses #610\n`);
exec(`git add backend/src/workers/pdf.worker.js .gh_issues/pr_610.md`);
exec(`git commit -m "fix: Lint errors in pdf.worker.js (Closes #610)"`);
exec(`git push origin ${branch610} -f`);
exec(`gh pr create --repo Dev1822/paySphere --title "Fix: Multiple Lint Errors in pdf.worker.js" --body-file .gh_issues/pr_610.md --head Prathvikmehra:${branch610} --base main`);
