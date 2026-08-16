import React from 'react';
import PropTypes from 'prop-types';
import DataGrid from '../common/DataGrid';

export default function PayrollTable({ data, currency }) {
  const columns = [
    { key: 'name', label: 'Employee', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'salary', label: 'Salary', sortable: true, sortType: 'numeric' },
    { key: 'bonus', label: 'Bonus', sortable: true, sortType: 'numeric' },
    { key: 'overtime', label: 'Overtime', sortable: true, sortType: 'numeric' },
    { key: 'deduction', label: 'Deduction', sortable: true, sortType: 'numeric' },
    { key: 'net', label: 'Net Salary', sortable: true, sortType: 'numeric', render: (val, row) => <span className="font-semibold">{val}</span> },
    { 
      key: 'status', 
      label: 'Status', 
      sortable: true,
      render: (val) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            val === "Paid"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
          }`}
        >
          {val}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Employee Payroll Details
        </h2>
      </div>
      <DataGrid columns={columns} data={data} />
    </div>
  );
}

PayrollTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string.isRequired,
      department: PropTypes.string,
      salary: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      overtime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      deduction: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      net: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      status: PropTypes.string,
      date: PropTypes.string,
    }),
  ),
  currency: PropTypes.string,
};