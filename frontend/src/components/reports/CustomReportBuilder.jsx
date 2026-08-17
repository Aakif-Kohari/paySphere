import React, { useState } from 'react';
import api from '../../services/api';

const DATASETS = {
  employees: {
    label: 'Employees',
    columns: [
      { value: 'fullName', label: 'Full Name' },
      { value: 'email', label: 'Email' },
      { value: 'department', label: 'Department' },
      { value: 'role', label: 'Role' },
      { value: 'baseSalary', label: 'Base Salary' },
      { value: 'status', label: 'Status' }
    ]
  },
  payroll: {
    label: 'Payroll Records',
    columns: [
      { value: 'employeeName', label: 'Employee Name' },
      { value: 'month', label: 'Month' },
      { value: 'year', label: 'Year' },
      { value: 'baseSalary', label: 'Base Salary' },
      { value: 'netSalary', label: 'Net Salary' },
      { value: 'status', label: 'Status' }
    ]
  }
};

const CustomReportBuilder = () => {
  const [dataset, setDataset] = useState('payroll');
  const [selectedColumns, setSelectedColumns] = useState(['employeeName', 'month', 'year', 'netSalary']);
  const [filters, setFilters] = useState([]);
  const [results, setResults] = useState(null);
  const [resultColumns, setResultColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleColumnToggle = (colValue) => {
    setSelectedColumns(prev => 
      prev.includes(colValue) ? prev.filter(c => c !== colValue) : [...prev, colValue]
    );
  };

  const addFilter = () => {
    setFilters([...filters, { field: DATASETS[dataset].columns[0].value, operator: 'equals', value: '' }]);
  };

  const updateFilter = (index, key, val) => {
    const newFilters = [...filters];
    newFilters[index][key] = val;
    setFilters(newFilters);
  };

  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const generateReport = async () => {
    if (selectedColumns.length === 0) {
      setError('Please select at least one column.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/reports/custom', {
        dataset,
        columns: selectedColumns,
        filters: filters.filter(f => f.value !== '')
      });
      setResults(res.data.results);
      setResultColumns(res.data.columns);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!results || results.length === 0) return;
    const header = resultColumns.join(',');
    const rows = results.map(row => 
      resultColumns.map(col => `"${row[col] !== undefined ? row[col] : ''}"`).join(',')
    );
    const csvContent = [header, ...rows].join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_${dataset}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Custom Report Builder</h2>
      
      {error && <div role="alert" className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Dataset</label>
        <select 
          value={dataset} 
          onChange={(e) => {
            setDataset(e.target.value);
            setSelectedColumns(DATASETS[e.target.value].columns.slice(0, 4).map(c => c.value));
            setFilters([]);
          }}
          aria-label="Select dataset"
          className="w-full sm:w-1/3 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {Object.entries(DATASETS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Columns</label>
        <div className="flex flex-wrap gap-3">
          {DATASETS[dataset].columns.map(col => (
            <label key={col.value} className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800">
              <input 
                type="checkbox" 
                checked={selectedColumns.includes(col.value)}
                onChange={() => handleColumnToggle(col.value)}
                aria-label={`Select column ${col.label}`}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">{col.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Filters</label>
          <button type="button" onClick={addFilter} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Filter</button>
        </div>
        {filters.length === 0 && <p className="text-sm text-gray-500 dark:text-slate-400">No filters applied.</p>}
        {filters.map((f, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
            <select aria-label="Filter field" value={f.field} onChange={e => updateFilter(i, 'field', e.target.value)} className="p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
              {DATASETS[dataset].columns.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select aria-label="Filter operator" value={f.operator} onChange={e => updateFilter(i, 'operator', e.target.value)} className="p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="contains">Contains</option>
              <option value="gt">Greater Than</option>
              <option value="lt">Less Than</option>
            </select>
            <input aria-label="Filter value" type="text" value={f.value} onChange={e => updateFilter(i, 'value', e.target.value)} placeholder="Value" className="p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none flex-1 min-w-[150px]" />
            <button aria-label="Remove filter" type="button" onClick={() => removeFilter(i)} className="p-2 text-red-500 hover:text-red-700 font-bold focus:outline-none">&times;</button>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-8">
        <button type="button" onClick={generateReport} disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {loading ? 'Generating...' : 'Preview Report'}
        </button>
        {results && results.length > 0 && (
          <button type="button" onClick={exportCSV} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            Export CSV
          </button>
        )}
      </div>

      {results && (
        <div>
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Preview ({results.length} records)</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table aria-label="Custom report preview results" className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-800 dark:text-gray-400">
                <tr>
                  {resultColumns.map(col => (
                    <th key={col} className="px-6 py-3">{DATASETS[dataset].columns.find(c => c.value === col)?.label || col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className="bg-white border-b dark:bg-slate-900 dark:border-slate-800">
                    {resultColumns.map(col => (
                      <td key={col} className="px-6 py-4">{row[col]}</td>
                    ))}
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={resultColumns.length} className="px-6 py-4 text-center">No records found matching the criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReportBuilder;
