import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

export default function Flashcards() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-decks'); // 'my-decks' | 'community'
  
  // State for My Decks
  const [myDecks, setMyDecks] = useState([]);
  const [myDecksSearch, setMyDecksSearch] = useState('');
  
  // State for Community Explorer
  const [communityDecks, setCommunityDecks] = useState([]);
  const [communitySearch, setCommunitySearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [minRatingFilter, setMinRatingFilter] = useState(0);
  const [communityPage, setCommunityPage] = useState(1);
  const [communityTotalPages, setCommunityTotalPages] = useState(1);

  // General Loading & Feedback State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null); // null for new deck
  const [deckForm, setDeckForm] = useState({
    title: '',
    description: '',
    subject: '',
    exam: '',
    isPublic: false,
    cards: [{ front: '', back: '' }],
  });

  const [isStudyOpen, setIsStudyOpen] = useState(false);
  const [studyDeck, setStudyDeck] = useState(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Fetch data depending on active tab
  useEffect(() => {
    if (activeTab === 'my-decks') {
      fetchMyDecks();
    } else {
      fetchCommunityDecks();
    }
  }, [activeTab, communityPage, subjectFilter, examFilter, minRatingFilter]);

  const fetchMyDecks = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await api.get('/api/flashcards/my-decks');
      setMyDecks(response.data || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to fetch personal decks');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommunityDecks = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await api.get('/api/flashcards/community', {
        params: {
          search: communitySearch,
          subject: subjectFilter,
          exam: examFilter,
          minRating: minRatingFilter || undefined,
          page: communityPage,
          limit: 12,
        },
      });
      setCommunityDecks(response.data?.decks || []);
      setCommunityTotalPages(response.data?.totalPages || 1);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to fetch community marketplace decks');
    } finally {
      setLoading(false);
    }
  };

  // Filter My Decks locally
  const filteredMyDecks = useMemo(() => {
    if (!myDecksSearch.trim()) return myDecks;
    const query = myDecksSearch.toLowerCase();
    return myDecks.filter(
      (deck) =>
        deck.title.toLowerCase().includes(query) ||
        (deck.description && deck.description.toLowerCase().includes(query)) ||
        deck.subject.toLowerCase().includes(query) ||
        deck.exam.toLowerCase().includes(query) ||
        deck.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [myDecks, myDecksSearch]);

  // Handle My Decks CRUD
  const handleDeleteDeck = async (id) => {
    if (!window.confirm('Are you sure you want to delete this deck?')) return;
    try {
      await api.delete(`/api/flashcards/${id}`);
      setSuccessMsg('Deck deleted successfully');
      fetchMyDecks();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete deck');
    }
  };

  const handleTogglePublic = async (deck) => {
    try {
      const response = await api.put(`/api/flashcards/${deck._id}`, {
        isPublic: !deck.isPublic,
      });
      setSuccessMsg(`Deck is now ${response.data.isPublic ? 'public' : 'private'}`);
      fetchMyDecks();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update deck visibility');
    }
  };

  // Handle Editor actions
  const openCreateModal = () => {
    setEditingDeck(null);
    setDeckForm({
      title: '',
      description: '',
      subject: '',
      exam: '',
      isPublic: false,
      cards: [{ front: '', back: '' }],
    });
    setIsEditorOpen(true);
  };

  const openEditModal = (deck) => {
    setEditingDeck(deck);
    setDeckForm({
      title: deck.title,
      description: deck.description || '',
      subject: deck.subject,
      exam: deck.exam,
      isPublic: deck.isPublic,
      cards: deck.cards.map((c) => ({ front: c.front, back: c.back })),
    });
    setIsEditorOpen(true);
  };

  const handleAddCardForm = () => {
    setDeckForm((prev) => ({
      ...prev,
      cards: [...prev.cards, { front: '', back: '' }],
    }));
  };

  const handleRemoveCardForm = (index) => {
    setDeckForm((prev) => ({
      ...prev,
      cards: prev.cards.filter((_, i) => i !== index),
    }));
  };

  const handleCardFieldChange = (index, field, value) => {
    setDeckForm((prev) => {
      const updatedCards = [...prev.cards];
      updatedCards[index][field] = value;
      return { ...prev, cards: updatedCards };
    });
  };

  const handleSaveDeck = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!deckForm.title || !deckForm.subject || !deckForm.exam) {
      setErrorMsg('Please fill in all required fields (Title, Subject, Exam)');
      return;
    }

    const validCards = deckForm.cards.filter((c) => c.front.trim() && c.back.trim());
    if (validCards.length === 0) {
      setErrorMsg('Please add at least one card with front and back content');
      return;
    }

    setLoading(true);
    try {
      const payload = { ...deckForm, cards: validCards };
      if (editingDeck) {
        await api.put(`/api/flashcards/${editingDeck._id}`, payload);
        setSuccessMsg('Deck updated successfully!');
      } else {
        await api.post('/api/flashcards', payload);
        setSuccessMsg('Deck created successfully!');
      }
      setIsEditorOpen(false);
      fetchMyDecks();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save flashcard deck');
    } finally {
      setLoading(false);
    }
  };

  // Study Mode Actions
  const startStudySession = (deck) => {
    setStudyDeck(deck);
    setStudyIndex(0);
    setIsFlipped(false);
    setIsStudyOpen(true);
  };

  // Clone Deck
  const handleCloneDeck = async (deckId) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.post(`/api/flashcards/clone/${deckId}`);
      setSuccessMsg('Deck successfully cloned to your personal library!');
      setActiveTab('my-decks');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to clone deck');
    } finally {
      setLoading(false);
    }
  };

  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>AI Flashcards & Study Guides | PaySphere</title>
      </Helmet>

      {/* Sidebar */}
      <Sidebar
        companyName={companyName}
        activePage="Flashcards"
        setActivePage={(page) => {
          if (page === 'Reports') {
            navigate('/reports');
          } else if (page !== 'Flashcards') {
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
              aria-label="Back to dashboard"
              className="p-1 rounded-md text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800 transition"
            >
              <ArrowBackIcon />
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">
              AI Study Circle
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
            <div role="alert" className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
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
                Flashcard Manager
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Collaborative revision and AI-powered summary reviews.
              </p>
            </div>
            {activeTab === 'my-decks' && (
              <button
                onClick={openCreateModal}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition cursor-pointer"
              >
                + Create New Deck
              </button>
            )}
          </div>

          {/* Tab Selector */}
          <div role="tablist" aria-label="Flashcard section tabs" className="flex border-b border-gray-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('my-decks')}
              role="tab"
              aria-selected={activeTab === 'my-decks'}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                activeTab === 'my-decks'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              My Study Library ({myDecks.length})
            </button>
            <button
              onClick={() => setActiveTab('community')}
              role="tab"
              aria-selected={activeTab === 'community'}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
                activeTab === 'community'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Community Marketplace
            </button>
          </div>

          {/* Tab Content: My Decks */}
          {activeTab === 'my-decks' && (
            <div className="space-y-6">
              {/* Search */}
              <div className="max-w-md w-full">
                <input
                  type="text"
                  placeholder="Search decks by title, subject, tags..."
                  value={myDecksSearch}
                  onChange={(e) => setMyDecksSearch(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {loading && myDecks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Loading your decks...</div>
              ) : filteredMyDecks.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center">
                  <p className="text-slate-500 dark:text-slate-400">
                    No flashcard decks found in your study library.
                  </p>
                  <button
                    onClick={openCreateModal}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    Create Your First Deck
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMyDecks.map((deck) => (
                    <div
                      key={deck._id}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:shadow-lg transition duration-200"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                            {deck.subject}
                          </span>
                          <span className="text-xs text-slate-400">{deck.exam}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                          {deck.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {deck.description || 'No description provided.'}
                        </p>

                        {/* Summary Tags */}
                        {deck.tags && deck.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {deck.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-4">
                          <span>Cards: {deck.cards?.length || 0}</span>
                          <span>Rating: {deck.rating || 'N/A'}</span>
                          <span>Downloads: {deck.downloadsCount || 0}</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 dark:border-slate-800 pt-4 mt-6 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={deck.isPublic}
                              onChange={() => handleTogglePublic(deck)}
                              aria-label={`Share ${deck.title} publicly`}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Share Publicly
                            </span>
                          </label>
                          {deck.clonedFromId && (
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold italic">
                              Cloned Deck
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => startStudySession(deck)}
                            aria-label={`Study ${deck.title}`}
                            className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition cursor-pointer"
                          >
                            Study
                          </button>
                          <button
                            onClick={() => openEditModal(deck)}
                            aria-label={`Edit ${deck.title}`}
                            className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-white rounded text-xs font-bold transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDeck(deck._id)}
                            aria-label={`Delete ${deck.title}`}
                            className="px-2 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 rounded text-xs font-bold transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Community Marketplace */}
          {activeTab === 'community' && (
            <div className="space-y-6">
              {/* Search & Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    placeholder="Search by keywords..."
                    value={communitySearch}
                    onChange={(e) => {
                      setCommunitySearch(e.target.value);
                      setCommunityPage(1);
                    }}
                    onBlur={fetchCommunityDecks}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Science"
                    value={subjectFilter}
                    onChange={(e) => {
                      setSubjectFilter(e.target.value);
                      setCommunityPage(1);
                    }}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Exam
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GRE"
                    value={examFilter}
                    onChange={(e) => {
                      setExamFilter(e.target.value);
                      setCommunityPage(1);
                    }}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Min Rating
                  </label>
                  <select
                    value={minRatingFilter}
                    onChange={(e) => {
                      setMinRatingFilter(Number(e.target.value));
                      setCommunityPage(1);
                    }}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value={0}>Any Rating</option>
                    <option value={1}>1+ Stars</option>
                    <option value={2}>2+ Stars</option>
                    <option value={3}>3+ Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={5}>5 Stars</option>
                  </select>
                </div>
              </div>

              {loading && communityDecks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Loading community decks...</div>
              ) : communityDecks.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
                  No public study decks found matching your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {communityDecks.map((deck) => (
                    <div
                      key={deck._id}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:shadow-lg transition duration-200"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">
                            {deck.subject}
                          </span>
                          <span className="text-xs text-slate-400">{deck.exam}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                          {deck.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {deck.description || 'No description provided.'}
                        </p>

                        {/* Summary Tags */}
                        {deck.tags && deck.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {deck.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-4">
                          <span>Cards: {deck.cards?.length || 0}</span>
                          <span>Rating: {deck.rating || 'N/A'}</span>
                          <span>Clones: {deck.downloadsCount || 0}</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 dark:border-slate-800 pt-4 mt-6">
                        <button
                          onClick={() => handleCloneDeck(deck._id)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold transition cursor-pointer"
                        >
                          Clone to My Decks
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {communityTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-4">
                  <button
                    disabled={communityPage === 1}
                    onClick={() => setCommunityPage((p) => p - 1)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm">
                    Page {communityPage} of {communityTotalPages}
                  </span>
                  <button
                    disabled={communityPage === communityTotalPages}
                    onClick={() => setCommunityPage((p) => p + 1)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-2xl shadow-xl border border-gray-200 dark:border-slate-800 max-h-[90vh] flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingDeck ? 'Edit Flashcard Deck' : 'Create New Flashcard Deck'}
              </h2>

              <form onSubmit={handleSaveDeck} className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Deck Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={deckForm.title}
                      onChange={(e) => setDeckForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maths"
                      value={deckForm.subject}
                      onChange={(e) => setDeckForm((prev) => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Exam *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UPSC"
                      value={deckForm.exam}
                      onChange={(e) => setDeckForm((prev) => ({ ...prev, exam: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
                      <input
                        type="checkbox"
                        checked={deckForm.isPublic}
                        onChange={(e) => setDeckForm((prev) => ({ ...prev, isPublic: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Publish to Marketplace
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={deckForm.description}
                    onChange={(e) => setDeckForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Cards Builder */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Flashcards ({deckForm.cards.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCardForm}
                      className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded"
                    >
                      + Add Card
                    </button>
                  </div>

                  {deckForm.cards.map((card, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-900">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          required
                          placeholder="Front content..."
                          value={card.front}
                          onChange={(e) => handleCardFieldChange(idx, 'front', e.target.value)}
                          className="w-full px-3 py-1 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Back content..."
                          value={card.back}
                          onChange={(e) => handleCardFieldChange(idx, 'back', e.target.value)}
                          className="w-full px-3 py-1 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      {deckForm.cards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCardForm(idx)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeck}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save Deck'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Study Session Modal */}
      {isStudyOpen && studyDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-xl shadow-xl border border-gray-200 dark:border-slate-800 text-center flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold text-slate-400">
                  Card {studyIndex + 1} of {studyDeck.cards.length}
                </span>
                <button
                  onClick={() => setIsStudyOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-8 truncate">
                Reviewing: {studyDeck.title}
              </h2>

              {/* Flashcard Component */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full h-52 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center p-6 cursor-pointer hover:shadow-md transition-all select-none"
              >
                <div className="text-xl font-medium max-w-md break-words">
                  {isFlipped ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {studyDeck.cards[studyIndex]?.back}
                    </span>
                  ) : (
                    <span className="text-slate-800 dark:text-slate-100">
                      {studyDeck.cards[studyIndex]?.front}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Click card to Flip</p>
            </div>

            <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                disabled={studyIndex === 0}
                onClick={() => {
                  setStudyIndex((i) => i - 1);
                  setIsFlipped(false);
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm disabled:opacity-30 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold rounded text-sm cursor-pointer"
              >
                Flip
              </button>
              <button
                disabled={studyIndex === studyDeck.cards.length - 1}
                onClick={() => {
                  setStudyIndex((i) => i + 1);
                  setIsFlipped(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold disabled:opacity-30 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
