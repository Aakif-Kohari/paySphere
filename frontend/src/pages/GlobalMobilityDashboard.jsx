import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import AddIcon from '@mui/icons-material/Add';
import BalanceIcon from '@mui/icons-material/Balance';

export default function GlobalMobilityDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [auditData, setAuditData] = useState({ shadowRuns: [], taxEqs: [] });
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '', homeCountry: 'USA', homeCurrency: 'USD', 
    hostCountry: 'UK', hostCurrency: 'GBP', startDate: '', endDate: '',
    hypotheticalTaxRate: 0.30, baseSalaryHome: 120000, colaIndex: 1.25
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAssignments(); }, []);

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/api/shadow-payroll/assignments');
      setAssignments(res.data.assignments || []);
    } catch (err) { console.error(err); }
  };

  const fetchAudit = async (assignmentId) => {
    try {
      const res = await api.get(`/api/shadow-payroll/audit?assignmentId=${assignmentId}`);
      setAuditData(res.data);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/shadow-payroll/assignments', formData);
      alert('Assignment created!');
      setShowForm(false);
      fetchAssignments();
    } catch (err) { alert('Failed to create assignment.'); } finally { setLoading(false); }
  };

  const handleProcessShadow = async (assignmentId) => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    try {
      await api.post('/api/shadow-payroll/process', {
        assignmentId, month, year, hostGrossPay: 10000, hostTaxRate: 0.40, 
        hostSocialSecurityRate: 0.05, exchangeRate: 1.25
      });
      alert('Shadow payroll processed!');
      fetchAudit(assignmentId);
    } catch (err) { alert('Processing failed.'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="GlobalMobility" setActivePage={() => {}} isSidebarOpen={false} onClose={() => {}} />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FlightTakeoffIcon className="text-blue-500" /> Global Mobility & Shadow Payroll
          </h1>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Assignments</h2>
              <button onClick={() => setShowForm(true)} className="text-brand-600 hover:text-brand-800">
                <AddIcon fontSize="small" />
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
              {assignments.map(a => (
                <button key={a._id} onClick={() => { setSelectedAssignment(a); fetchAudit(a._id); }} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{a.employeeId?.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{a.homeCountry} ✈️ {a.hostCountry}</p>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-brand-600 dark:text-brand-400 font-bold">COLA: {((a.colaIndex - 1) * 100).toFixed(0)}%</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${a.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800'}`}>{a.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 min-h-[400px]">
            {!selectedAssignment ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                <BalanceIcon fontSize="large" />
                <p className="mt-2 text-sm">Select an assignment to view shadow payroll and tax equalization audits.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedAssignment.employeeId?.fullName}</h2>
                  <button onClick={() => handleProcessShadow(selectedAssignment._id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                    Run Shadow Payroll (Current Month)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-200 font-bold uppercase">Hypothetical Tax Rate</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{(selectedAssignment.hypotheticalTaxRate * 100).toFixed(0)}%</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-800 dark:text-green-200 font-bold uppercase">Monthly COLA</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">₹{(selectedAssignment.colaAllowance / 12).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-bold uppercase">Company Tax Cost</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      ₹{auditData.taxEqs.reduce((sum, t) => sum + t.companyTaxCost, 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Tax Equalization Ledger</h3>
                  <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                      <thead className="bg-gray-50 dark:bg-slate-900/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Month</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Hypothetical Tax</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Actual Host Tax</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Company Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {auditData.taxEqs.map(t => (
                          <tr key={t._id}>
                            <td className="px-4 py-2 text-xs text-gray-700 dark:text-slate-300">{t.month}/{t.year}</td>
                            <td className="px-4 py-2 text-xs text-right font-mono text-gray-900 dark:text-white">₹{t.hypotheticalTaxAmount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-xs text-right font-mono text-gray-900 dark:text-white">₹{t.actualHostTaxPaid.toLocaleString()}</td>
                            <td className={`px-4 py-2 text-xs text-right font-mono font-bold ${t.companyTaxCost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ₹{t.companyTaxCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create International Assignment</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Employee ID</label>
                  <input type="text" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Base Salary (Home)</label>
                  <input type="number" value={formData.baseSalaryHome} onChange={e => setFormData({...formData, baseSalaryHome: Number(e.target.value)})} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Hypothetical Tax Rate (%)</label>
                  <input type="number" step="0.01" value={formData.hypotheticalTaxRate} onChange={e => setFormData({...formData, hypotheticalTaxRate: Number(e.target.value)})} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">COLA Index (e.g. 1.25)</label>
                  <input type="number" step="0.01" value={formData.colaIndex} onChange={e => setFormData({...formData, colaIndex: Number(e.target.value)})} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
