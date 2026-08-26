/**
 * InternalJobBoard.jsx - Enhanced Issue #1251
 *
 * Full-featured internal job board with:
 *   - Job cards with skills, department, posting date
 *   - Live search and department filter
 *   - Apply modal with cover letter
 *   - Manager view: application pipeline per job
 *   - Application status tracking
 *   - Tabbed interface: Browse Jobs | My Applications | Pipeline (admin)
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';

const TABS = [
  { id: 'browse', label: 'Browse Jobs' },
  { id: 'myapps', label: 'My Applications' },
  { id: 'pipeline', label: 'Pipeline' },
];

const STATUS_COLORS = {
  Applied: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  Reviewing: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  Interview: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  Hired: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  Rejected: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
  Withdrawn: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- Pipeline sub-component ---
function InternalJobPipeline({ jobs }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPipeline = useCallback(async (jobId) => {
    setSelectedJob(jobId);
    setLoading(true);
    try {
      const res = await api.get('/api/internal-jobs/' + jobId + '/pipeline');
      setApplications(res.data.applications || []);
    } catch { setApplications([]); } finally { setLoading(false); }
  }, []);

  const handleStatusUpdate = useCallback(async (appId, newStatus) => {
    try {
      await api.put('/api/internal-jobs/applications/' + appId + '/status', { status: newStatus });
      setApplications((prev) => prev.map((a) => a._id === appId ? { ...a, status: newStatus } : a));
    } catch (err) { alert(err.response?.data?.message || 'Failed to update.'); }
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Application Pipeline</h3>
      <p className="text-sm text-gray-500 dark:text-slate-400">Select a job to view its applicant pipeline.</p>
      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <button key={job._id} onClick={() => fetchPipeline(job._id)} className={'px-4 py-2 rounded-xl text-xs font-semibold transition ' + (selectedJob === job._id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800')}>
            {job.title}
          </button>
        ))}
      </div>
      {selectedJob && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500 dark:text-slate-400">Loading pipeline...</div>
          ) : applications.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-slate-400">No applications yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-400 uppercase text-xs">
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Applied</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {applications.map((app) => (
                    <tr key={app._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{app.applicantId?.fullName || 'Unknown'}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{app.applicantId?.email}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{app.applicantId?.department || '-'}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{formatDate(app.createdAt)}</td>
                      <td className="py-3 px-4">
                        <span className={'px-2.5 py-1 rounded-full text-xs font-bold ' + (STATUS_COLORS[app.status] || STATUS_COLORS.Applied)}>{app.status}</span>
                      </td>
                      <td className="py-3 px-4">
                        <select value={app.status} onChange={(e) => handleStatusUpdate(app._id, e.target.value)} className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function InternalJobBoard() {
  const [activeTab, setActiveTab] = useState('browse');
  const [jobs, setJobs] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [applyModal, setApplyModal] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const logout = useAppStore((s) => s.logout);
  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get('/api/internal-jobs/open');
      const list = res.data.jobs || [];
      setJobs(list);
      setDepartments([...new Set(list.map((j) => j.department).filter(Boolean))]);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const fetchMyApps = useCallback(async () => {
    try {
      const res = await api.get('/api/internal-jobs/my-applications');
      setMyApps(res.data.applications || []);
    } catch { /* endpoint may not exist yet */ }
  }, []);

  useEffect(() => { fetchJobs(); fetchMyApps(); }, [fetchJobs, fetchMyApps]);

  const handleApply = useCallback(async () => {
    if (!applyModal || !coverLetter.trim()) return;
    setApplying(true);
    try {
      await api.post('/api/internal-jobs/' + applyModal._id + '/apply', { coverLetter: coverLetter.trim() });
      setApplyModal(null); setCoverLetter('');
      fetchJobs(); fetchMyApps();
    } catch (err) { alert(err.response?.data?.message || 'Failed to apply.'); } finally { setApplying(false); }
  }, [applyModal, coverLetter, fetchJobs, fetchMyApps]);

  const filteredJobs = jobs.filter((job) => {
    const matchSearch = !search || job.title?.toLowerCase().includes(search.toLowerCase()) || job.description?.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || job.department === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Helmet><title>Internal Job Board | PaySphere</title></Helmet>
      <Sidebar companyName={companyName} activePage="InternalJobs" setActivePage={() => {}} isSidebarOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={() => { logout(); }} />

      <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 md:ml-56 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <span className="font-bold text-xl text-blue-600 dark:text-blue-400">PaySphere</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider">Internal Jobs</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 w-full md:w-[calc(100%-14rem)] md:ml-56 p-4 sm:p-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-2 shadow-sm">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={'px-5 py-2.5 rounded-xl text-sm font-semibold transition ' + (activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800')}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Browse Jobs */}
        {activeTab === 'browse' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs by title or description..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-56 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />)}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
                <p className="text-gray-500 dark:text-slate-400 font-medium">No jobs found</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">{search || deptFilter ? 'Try adjusting your filters' : 'Check back later for new openings'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredJobs.map((job) => (
                  <div key={job._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 flex flex-col hover:shadow-md transition group">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{job.title}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex-shrink-0 ml-2">OPEN</span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">{job.department}</p>
                      {job.managerId && <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Posted by {job.managerId.fullName || 'Manager'}</p>}
                      <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-3 mb-3">{job.description}</p>
                      {job.requiredSkills && job.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {job.requiredSkills.slice(0, 4).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-semibold">{skill}</span>
                          ))}
                          {job.requiredSkills.length > 4 && <span className="text-gray-400 dark:text-slate-500 text-[10px]">+{job.requiredSkills.length - 4} more</span>}
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">Posted {formatDate(job.createdAt)}</p>
                    </div>
                    <button onClick={() => setApplyModal(job)} className="mt-3 w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md">Apply</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Applications */}
        {activeTab === 'myapps' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {myApps.length === 0 ? (
              <div className="text-center py-12"><p className="text-gray-500 dark:text-slate-400 font-medium">You have not applied to any positions yet.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-400 uppercase text-xs">
                      <th className="py-3 px-4">Position</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Applied</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {myApps.map((app) => (
                      <tr key={app._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{app.jobId?.title || 'Unknown'}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{app.jobId?.department || '-'}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{formatDate(app.createdAt)}</td>
                        <td className="py-3 px-4">
                          <span className={'px-2.5 py-1 rounded-full text-xs font-bold ' + (STATUS_COLORS[app.status] || STATUS_COLORS.Applied)}>{app.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && <InternalJobPipeline jobs={jobs} />}
      </main>

      {/* Apply Modal */}
      {applyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Apply for {applyModal.title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{applyModal.department}</p>
            </div>
            <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Write a brief cover letter explaining why you are a good fit..." rows={5} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setApplyModal(null); setCoverLetter(''); }} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition">Cancel</button>
              <button onClick={handleApply} disabled={applying || !coverLetter.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md">{applying ? 'Submitting...' : 'Submit Application'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
