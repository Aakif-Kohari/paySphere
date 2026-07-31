const fs = require('fs');

const dashPath = 'frontend/src/pages/Dashboard.jsx';
let dashCode = fs.readFileSync(dashPath, 'utf8');

if (!dashCode.includes('EmployeeManagement = ({ search, setSearch')) {
  // Update EmployeeManagement signature
  dashCode = dashCode.replace(
    /const EmployeeManagement = \(\{[\s\S]*?employees,/,
    `const EmployeeManagement = ({\n  search,\n  setSearch,\n  employees,`
  );

  // Add search UI inside EmployeeManagement Summary header
  const searchInputHtml = `
        <div className="w-full sm:w-auto mt-4 md:mt-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full sm:w-auto px-4 py-3 border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:border-blue-500 outline-none transition-colors"
          />
        </div>
`;

  dashCode = dashCode.replace(
    /<div className="flex gap-3 w-full sm:w-auto">/,
    searchInputHtml + '\n        <div className="flex gap-3 w-full sm:w-auto">'
  );

  // Pass search props in PaySphereDashboard
  dashCode = dashCode.replace(
    /<EmployeeManagement\s+employees=\{employees\}/,
    `<EmployeeManagement\n            search={search}\n            setSearch={setSearch}\n            employees={employees}`
  );

  fs.writeFileSync(dashPath, dashCode);
  console.log("Updated Dashboard.jsx");
}
