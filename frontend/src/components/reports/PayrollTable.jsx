

import React, { useState, useMemo } from 'react';

export default function PayrollTable({ data }) {
  const [sortDirection, setSortDirection] = useState(null); // null | 'asc' | 'desc'

  const handleSortNetSalary = () => {
    if (sortDirection === null) {
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortDirection(null);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortDirection) return data;

    return [...data].sort((a, b) => {
      const valA =
        typeof a.netSalary === 'number'
          ? a.netSalary
          : parseFloat(String(a.net || '').replace(/[^0-9.-]+/g, '')) || 0;
      const valB =
        typeof b.netSalary === 'number'
          ? b.netSalary
          : parseFloat(String(b.net || '').replace(/[^0-9.-]+/g, '')) || 0;

      if (sortDirection === 'asc') {
        return valA - valB;
      } else {
        return valB - valA;
      }
    });
  }, [data, sortDirection]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Employee Payroll Details
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-slate-800">
            <tr>
              <th className="px-5 py-3 text-left">Employee</th>
              <th className="px-5 py-3 text-left">Department</th>
              <th className="px-5 py-3 text-left">Salary</th>
              <th className="px-5 py-3 text-left">Bonus</th>
              <th className="px-5 py-3 text-left">Overtime</th>
              <th className="px-5 py-3 text-left">Deduction</th>
              <th
                className="px-5 py-3 text-left cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={handleSortNetSalary}
                title="Click to sort by Net Salary"
              >
                <div className="flex items-center gap-1">
                  <span>Net Salary</span>
                  <span className="text-xs font-mono">
                    {sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '↕'}
                  </span>
                </div>
              </th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {sortedData.map((employee) => (
              <tr
                key={employee.id}
                className="border-t border-gray-200 dark:border-slate-800"
              >
                <td className="px-5 py-4">{employee.name}</td>
                <td className="px-5 py-4">{employee.department}</td>
                <td className="px-5 py-4">{employee.salary}</td>
                <td className="px-5 py-4">{employee.bonus}</td>
                <td className="px-5 py-4">{employee.overtime}</td>
                <td className="px-5 py-4">{employee.deduction}</td>
                <td className="px-5 py-4 font-semibold">
                  {employee.net}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      employee.status === "Paid"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                    }`}
                  >
                    {employee.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}