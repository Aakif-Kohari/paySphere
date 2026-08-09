import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

// Pre-packaged seed data for UPSC Physics / JEE Maths to make testing instant
const SAMPLE_PYQS = [
  { subject: 'Physics', exam: 'JEE', year: 2018, chapter: 'Mechanics', difficulty: 'easy', question: 'Calculate projectile range on an inclined plane.' },
  { subject: 'Physics', exam: 'JEE', year: 2019, chapter: 'Mechanics', difficulty: 'medium', question: 'Find center of mass of a hemisphere.' },
  { subject: 'Physics', exam: 'JEE', year: 2020, chapter: 'Mechanics', difficulty: 'hard', question: 'Derive escape velocity under variable gravity.' },
  { subject: 'Physics', exam: 'JEE', year: 2021, chapter: 'Mechanics', difficulty: 'medium', question: 'Moment of inertia of a solid cylinder.' },
  { subject: 'Physics', exam: 'JEE', year: 2022, chapter: 'Thermodynamics', difficulty: 'easy', question: 'Carnot engine efficiency limit.' },
  { subject: 'Physics', exam: 'JEE', year: 2023, chapter: 'Thermodynamics', difficulty: 'medium', question: 'Calculate entropy change in free expansion.' },
  { subject: 'Physics', exam: 'JEE', year: 2024, chapter: 'Electromagnetism', difficulty: 'hard', question: 'Calculate magnetic field inside a toroid.' },
  { subject: 'Physics', exam: 'JEE', year: 2024, chapter: 'Electromagnetism', difficulty: 'medium', question: 'Derive induction formula for moving rod.' },
  { subject: 'Physics', exam: 'JEE', year: 2023, chapter: 'Electromagnetism', difficulty: 'hard', question: 'Maxwell equations in dielectric medium.' },
  { subject: 'Physics', exam: 'JEE', year: 2022, chapter: 'Optics', difficulty: 'easy', question: 'Single slit diffraction pattern width.' },
  { subject: 'Physics', exam: 'JEE', year: 2024, chapter: 'Optics', difficulty: 'medium', question: 'Fermat principle derivation of refraction.' },
  { subject: 'Physics', exam: 'JEE', year: 2021, chapter: 'Modern Physics', difficulty: 'easy', question: 'Photoelectric work function calculations.' },
];

export default function PyqDashboard() {
  const navigate = useNavigate();
  
  // Filtering & Selection state
  const [subject, setSubject] = useState('Physics');
  const [exam, setExam] = useState('JEE');
  const [forecastYear, setForecastYear] = useState(2026);
  
  // Data state
  const [pyqs, setPyqs] = useState([]);
  const [forecast, setForecast] = useState(null);
  
  // Form state for creating single PYQ
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    subject: 'Physics',
    exam: 'JEE',
    year: 2024,
    chapter: '',
    difficulty: 'medium',
    question: '',
    tags: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchPYQs();
    fetchForecast();
  }, [subject, exam]);

  const fetchPYQs = async () => {
    try {
      const response = await api.get(`/api/pyqs?subject=${subject}&exam=${exam}`);
      setPyqs(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchForecast = async () => {
    try {
      const response = await api.get(`/api/pyqs/forecast?subject=${subject}&exam=${exam}`);
      setForecast(response.data);
    } catch (err) {
      setForecast(null); // Reset if none exists
    }
  };

  const handleCreatePyq = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!form.chapter || !form.question) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
      };
      await api.post('/api/pyqs', payload);
      setSuccessMsg('Past Year Question added successfully!');
      setIsFormOpen(false);
      fetchPYQs();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to add PYQ');
    }
  };

  const handleSeedSampleData = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.post('/api/pyqs/bulk', { pyqs: SAMPLE_PYQS });
      setSuccessMsg('Sample historical PYQ data seeded successfully! (12 questions added)');
      fetchPYQs();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to seed sample data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunForecast = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await api.post('/api/pyqs/forecast', {
        subject,
        exam,
        forecastYear,
      });
      setForecast(response.data);
      setSuccessMsg(`AI Trend Forecast for ${forecastYear} generated successfully!`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate trend forecast');
    } finally {
      setLoading(false);
    }
  };

  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>PYQ Analytics & AI Trend Forecasting | PaySphere</title>
      </Helmet>

      {/* Sidebar */}
      <Sidebar
        companyName={companyName}
        activePage="PYQs"
        setActivePage={(page) => {
          if (page === 'Reports') {
            navigate('/reports');
          } else if (page !== 'PYQs') {
            navigate('/dashboard?tab=' + page);
          }
        }}
        isSidebarOpen={false}
        onClose={() => {}}
      />

      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none"
            >
              <ArrowBackIcon />
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">
              PYQ Trend intelligence
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Notifications */}
          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg text-sm">
              {successMsg}
            </div>
          )}

          {/* Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                PYQ AI Trend Forecaster
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Analyze past exam weightages and predict chapter distribution probabilities.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSeedSampleData}
                disabled={loading}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg text-sm font-semibold hover:bg-slate-300 transition"
              >
                Seed Mock PYQs
              </button>
              <button
                onClick={() => setIsFormOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition"
              >
                + Add PYQ
              </button>
            </div>
          </div>

          {/* Filtering Workspace */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Physics">Physics</option>
                <option value="Maths">Maths</option>
                <option value="Chemistry">Chemistry</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Target Exam
              </label>
              <select
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="JEE">JEE Mains</option>
                <option value="NEET">NEET</option>
                <option value="UPSC">UPSC Civil Services</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Forecast Year
              </label>
              <input
                type="number"
                value={forecastYear}
                onChange={(e) => setForecastYear(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleRunForecast}
              disabled={loading || pyqs.length === 0}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Run AI Prediction'}
            </button>
          </div>

          {/* Forecasting Dashboard Panels */}
          {forecast ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Difficulty Metrics Card */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                    Predicted Difficulty
                  </h2>
                  <div className="flex items-center gap-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">
                      🎯
                    </div>
                    <div>
                      <span className="text-2xl font-black capitalize text-indigo-600 dark:text-indigo-400">
                        {forecast.predictedDifficulty}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">Predicted exam level</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-slate-500">AI Confidence Rating:</span>
                    <span className="text-emerald-500">{forecast.difficultyConfidence}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${forecast.difficultyConfidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Topic Distribution Forecast Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  Chapter Probability Distribution
                </h2>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecast.topics}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="chapter" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="probability" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Forecast Tags & Trend Lists */}
              <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  Topic weightage & Trend Indicators
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {forecast.topics.map((topic, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900 flex justify-between items-start"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {topic.chapter}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                            {topic.weightageClass} weightage
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            P: {Math.round(topic.probability * 100)}%
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded">
                        {topic.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
              {pyqs.length === 0
                ? 'No past questions found. Click "Seed Mock PYQs" above to populate sample historical questions.'
                : 'Click "Run AI Prediction" above to generate topic forecasting curves and difficulty ratings.'}
            </div>
          )}

          {/* Past Questions List */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Historical Questions Database ({pyqs.length})
            </h2>
            {pyqs.length === 0 ? (
              <p className="text-slate-500 text-sm">No questions in database yet.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {pyqs.map((q) => (
                  <div key={q._id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500">{q.year}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                          {q.chapter}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded capitalize">
                          {q.difficulty}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {q.question}
                      </p>
                    </div>

                    {q.tags && q.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap md:self-center">
                        {q.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-slate-400 px-2 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add single PYQ Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Past Year Question</h2>
            <form onSubmit={handleCreatePyq} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Maths">Maths</option>
                    <option value="Chemistry">Chemistry</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Exam</label>
                  <select
                    value={form.exam}
                    onChange={(e) => setForm((prev) => ({ ...prev, exam: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none"
                  >
                    <option value="JEE">JEE</option>
                    <option value="NEET">NEET</option>
                    <option value="UPSC">UPSC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Year</label>
                  <input
                    type="number"
                    required
                    value={form.year}
                    onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Chapter Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mechanics"
                  value={form.chapter}
                  onChange={(e) => setForm((prev) => ({ ...prev, chapter: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. gravity, velocity"
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Question Text *</label>
                <textarea
                  rows={3}
                  required
                  value={form.question}
                  onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:bg-slate-900 rounded-lg text-sm outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold"
                >
                  Save PYQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
