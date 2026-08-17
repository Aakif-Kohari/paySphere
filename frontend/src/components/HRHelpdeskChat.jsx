import { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import EscalateIcon from '@mui/icons-material/PriorityHigh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

export default function HRHelpdeskChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, sender: 'ai', text: "Hi! I'm your AI HR Assistant. Ask me anything about company policies, leaves, or benefits." }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [lastQuery, setLastQuery] = useState('');
    const [lastResponse, setLastResponse] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { id: Date.now(), sender: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setLastQuery(input);
        setInput('');
        setLoading(true);

        try {
            const res = await api.post('/api/helpdesk/ask', { question: input });
            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: res.data.answer,
                citations: res.data.citations,
                needsEscalation: res.data.needsEscalation
            };
            setMessages(prev => [...prev, aiMsg]);
            setLastResponse(res.data.answer);
        } catch (err) {
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'Sorry, I encountered an error processing your request.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleEscalate = async () => {
        try {
            await api.post('/api/helpdesk/tickets/escalate', {
                originalQuery: lastQuery,
                aiResponse: lastResponse
            });
            setMessages(prev => [...prev, {
                id: Date.now(),
                sender: 'system',
                text: 'Your query has been escalated to the HR team. They will reach out to you shortly.'
            }]);
        } catch (err) {
            alert('Failed to escalate ticket.');
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                    aria-label="Open HR Helpdesk"
                >
                    <HelpOutlineIcon fontSize="large" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-brand-600 text-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SmartToyIcon />
                            <h3 className="font-bold">HR AI Assistant</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-brand-700 p-1 rounded-full transition">
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-900/50">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                                        <SmartToyIcon className="text-brand-600 dark:text-brand-400" fontSize="small" />
                                    </div>
                                )}

                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'user'
                                        ? 'bg-brand-600 text-white rounded-br-none'
                                        : msg.sender === 'system'
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                                            : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-bl-none shadow-sm'
                                    }`}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>

                                    {msg.citations && msg.citations.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                            <p className="text-xs text-gray-500 dark:text-slate-400 italic">
                                                Sources: {msg.citations.join(', ')}
                                            </p>
                                        </div>
                                    )}

                                    {msg.needsEscalation && (
                                        <button
                                            onClick={handleEscalate}
                                            className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition"
                                        >
                                            <EscalateIcon fontSize="small" /> Escalate to HR
                                        </button>
                                    )}
                                </div>

                                {msg.sender === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                        <PersonIcon className="text-gray-600 dark:text-slate-300" fontSize="small" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-2">
                                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                    <SmartToyIcon className="text-brand-600" fontSize="small" />
                                </div>
                                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-2xl rounded-bl-none">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Ask about leaves, policies..."
                                className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="w-10 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center disabled:opacity-50 transition"
                            >
                                <SendIcon fontSize="small" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
