import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import RichTextEditor from '../components/common/RichTextEditor';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';

const CATEGORIES = ['general', 'payroll', 'policy', 'event', 'urgent'];

export default function CompanyAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const { showNotification } = useAppStore();

  // Composer Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, [selectedCategory]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const url = selectedCategory ? `/api/announcements?category=${selectedCategory}` : '/api/announcements';
      const res = await api.get(url);
      setAnnouncements(res.data.announcements || []);
    } catch (err) {
      showNotification({ message: 'Failed to fetch announcements', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showNotification({ message: 'Title is required', severity: 'error' });
      return;
    }
    if (!content.trim()) {
      showNotification({ message: 'Announcement content is required', severity: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/api/announcements', {
        title,
        content,
        category,
        priority,
        isPinned,
      });
      showNotification({ message: 'Announcement published!', severity: 'success' });
      setTitle('');
      setContent('');
      setShowComposer(false);
      fetchAnnouncements();
    } catch (err) {
      showNotification({ message: err.response?.data?.message || 'Publishing failed', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      showNotification({ message: 'Announcement deleted', severity: 'success' });
      fetchAnnouncements();
    } catch (err) {
      showNotification({ message: 'Failed to delete announcement', severity: 'error' });
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <Helmet>
        <title>Company Announcements - PaySphere</title>
      </Helmet>

      <Sidebar activePage="Monthly updates" isSidebarOpen={false} onClose={() => {}} />

      <div className="lg:ml-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Company Announcements</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Broadband company communications, policy updates, and news formatted with rich text.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowComposer(!showComposer)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition"
            >
              {showComposer ? 'Close Composer' : '＋ Compose Announcement'}
            </button>
          </div>

          {/* WYSIWYG Composer Card */}
          {showComposer && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-xl space-y-4 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Announcement</h2>
              <form onSubmit={handlePublish} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Announcement Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Q3 Town Hall & Annual Company Outing"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="pinCheckbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="pinCheckbox" className="text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
                      📌 Pin to top of feed
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Announcement Body (Rich Text WYSIWYG) *
                  </label>
                  <RichTextEditor content={content} onChange={setContent} />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-white font-semibold text-xs rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition disabled:opacity-50"
                  >
                    {submitting ? 'Publishing...' : 'Publish Announcement'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Announcement Feed */}
          <div className="space-y-4">
            {loading ? (
              <p className="text-center py-8 text-gray-500 dark:text-slate-400">Loading announcements...</p>
            ) : announcements.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-xl text-center">
                <p className="text-gray-500 dark:text-slate-400">No announcements found.</p>
              </div>
            ) : (
              announcements.map((item) => (
                <div
                  key={item._id}
                  className={`bg-white dark:bg-slate-900 border ${
                    item.isPinned
                      ? 'border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/30'
                      : 'border-gray-200 dark:border-slate-800'
                  } rounded-xl p-6 shadow-sm space-y-4`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.isPinned && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">📌 Pinned</span>}
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                          {item.category}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${getPriorityBadge(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{item.title}</h2>
                    </div>

                    <button
                      onClick={() => handleDelete(item._id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      title="Delete Announcement"
                    >
                      Delete
                    </button>
                  </div>

                  {/* HTML Content Render */}
                  <div
                    className="prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-slate-200 border-t border-gray-100 dark:border-slate-800 pt-4"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  />

                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-800/50">
                    <span>Published by {item.createdBy?.fullName || 'HR Team'}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
