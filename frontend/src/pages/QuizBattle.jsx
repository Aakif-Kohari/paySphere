import { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';

// Custom Canvas Confetti Component
function ConfettiCanvas({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#ff7849'];
    const particles = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        r: Math.random() * 5 + 4,
        d: Math.random() * height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

        if (p.y > height) {
          p.x = Math.random() * width;
          p.y = -20;
          p.tilt = Math.random() * 10 - 5;
        }

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
}

// Simulated Battle Questions
const QUIZ_QUESTIONS = [
  { id: 1, question: 'Which Newton law explains the principle of rocket propulsion?', options: ['First Law', 'Second Law', 'Third Law', 'Universal Gravitation'], answer: 'Third Law' },
  { id: 2, question: 'What is the SI unit of electric potential difference?', options: ['Ampere', 'Ohm', 'Volt', 'Tesla'], answer: 'Volt' },
  { id: 3, question: 'Which particles are responsible for electrical conduction in metals?', options: ['Protons', 'Neutrons', 'Positrons', 'Free Electrons'], answer: 'Free Electrons' },
  { id: 4, question: 'The escape velocity of a projectile from the Earth depends on:', options: ['Mass of projectile', 'Radius of Earth', 'Angle of projection', 'None of the above'], answer: 'Radius of Earth' },
  { id: 5, question: 'Which phenomenon proves the transverse wave nature of light?', options: ['Interference', 'Diffraction', 'Polarization', 'Refraction'], answer: 'Polarization' },
];

export default function QuizBattle() {
  const navigate = useNavigate();

  // Arena states: 'lobby' | 'battle' | 'results'
  const [gameState, setGameState] = useState('lobby');
  const [username, setUsername] = useState('Player 1');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  
  // Leaderboard data
  const [participants, setParticipants] = useState([]);
  
  // Confetti celebration state
  const [triggerConfetti, setTriggerConfetti] = useState(false);
  const [streak, setStreak] = useState(0);

  // Start the battle arena session
  const handleJoinBattle = () => {
    if (!username.trim()) return;
    
    // Seed initial leaderboard ranks
    setParticipants([
      { id: 'user', name: `${username} (You)`, score: 0, avatar: '👤', streak: 0 },
      { id: 'bot1', name: 'Aarav', score: 0, avatar: '🤖', streak: 0 },
      { id: 'bot2', name: 'Priya', score: 0, avatar: '🎓', streak: 0 },
      { id: 'bot3', name: 'Neha', score: 0, avatar: '✨', streak: 0 },
      { id: 'bot4', name: 'Rahul', score: 0, avatar: '⚡', streak: 0 },
    ]);
    
    setCurrentQIndex(0);
    setSelectedOption(null);
    setStreak(0);
    setTriggerConfetti(false);
    setGameState('battle');
  };

  // Simulate opponent scores asynchronously to mimic real-time WebSockets
  useEffect(() => {
    if (gameState !== 'battle') return;

    const interval = setInterval(() => {
      setParticipants((prev) => {
        return prev.map((player) => {
          if (player.id === 'user') return player;
          // Random chance for opponent to get points
          const addsPoints = Math.random() > 0.4;
          if (addsPoints) {
            const nextScore = player.score + (Math.random() > 0.5 ? 20 : 10);
            return { ...player, score: nextScore };
          }
          return player;
        });
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [gameState]);

  // Sort participants by score for rendering positions
  const rankedParticipants = [...participants].sort((a, b) => b.score - a.score);

  // Map participant ID to its index in sorted list for position calculation
  const positionMap = {};
  rankedParticipants.forEach((p, index) => {
    positionMap[p.id] = index;
  });

  const handleSelectOption = (option) => {
    if (selectedOption) return; // Answered already
    setSelectedOption(option);

    const currentQuestion = QUIZ_QUESTIONS[currentQIndex];
    const isCorrect = option === currentQuestion.answer;

    if (isCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      
      // Award 20 points for correct answer + streak bonus
      const pointsEarned = 20 + nextStreak * 5;
      
      setParticipants((prev) =>
        prev.map((p) => (p.id === 'user' ? { ...p, score: p.score + pointsEarned } : p))
      );

      // Trigger micro-confetti on 5 answer streak!
      if (nextStreak === 5) {
        setTriggerConfetti(true);
        setTimeout(() => setTriggerConfetti(false), 3000);
      }
    } else {
      setStreak(0); // Break streak
    }

    // Go to next question after 2 seconds
    setTimeout(() => {
      if (currentQIndex < QUIZ_QUESTIONS.length - 1) {
        setCurrentQIndex((i) => i + 1);
        setSelectedOption(null);
      } else {
        // Match Complete
        setGameState('results');
        setTriggerConfetti(true);
      }
    }, 2000);
  };

  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>Multiplayer Quiz Battle Arena | PaySphere</title>
      </Helmet>

      {/* Confetti canvas */}
      <ConfettiCanvas active={triggerConfetti} />

      {/* Sidebar */}
      <Sidebar
        companyName={companyName}
        activePage="PYQs" // Keep in the context of study circle
        setActivePage={(page) => {
          if (page === 'Reports') {
            navigate('/reports');
          } else {
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
              Live Battle Arena
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-5xl w-full mx-auto">
          {/* Lobby Screen */}
          {gameState === 'lobby' && (
            <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
              <div className="text-5xl">⚔️</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  Real-time Battle Arena
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enter your alias and start a live revision battle with other online learners.
                </p>
              </div>

              <div className="space-y-4">
                <div className="text-left">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Your Name / Alias
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <button
                  onClick={handleJoinBattle}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/10 transition cursor-pointer"
                >
                  Join Battle Lobby
                </button>
              </div>
            </div>
          )}

          {/* Active Battle Screen */}
          {gameState === 'battle' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Question Screen */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[420px]">
                <div>
                  <div className="flex justify-between items-center text-xs text-slate-400 font-bold mb-6">
                    <span>QUESTION {currentQIndex + 1} OF {QUIZ_QUESTIONS.length}</span>
                    <span className="text-emerald-500">Streak: {streak} 🔥</span>
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8">
                    {QUIZ_QUESTIONS[currentQIndex].question}
                  </h2>

                  <div className="grid grid-cols-1 gap-3">
                    {QUIZ_QUESTIONS[currentQIndex].options.map((option, idx) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option === QUIZ_QUESTIONS[currentQIndex].answer;
                      let btnStyle = 'border-gray-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800';
                      
                      if (selectedOption) {
                        if (isSelected) {
                          btnStyle = isCorrect
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-red-500 text-white border-red-500';
                        } else if (isCorrect) {
                          btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={!!selectedOption}
                          onClick={() => handleSelectOption(option)}
                          className={`w-full py-3 px-4 border rounded-xl text-left text-sm font-semibold transition ${btnStyle} cursor-pointer`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedOption && (
                  <p className="text-center text-xs text-slate-400 font-bold mt-4 animate-pulse">
                    Next question loading...
                  </p>
                )}
              </div>

              {/* Real-time Animating Leaderboard */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6">
                  Live Standings
                </h3>

                {/* Animated card container */}
                <div className="relative w-full h-[360px]">
                  {participants.map((player) => {
                    const rankIndex = positionMap[player.id];
                    const isSelf = player.id === 'user';
                    
                    return (
                      <div
                        key={player.id}
                        style={{
                          transform: `translateY(${rankIndex * 70}px)`,
                        }}
                        className={`absolute w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ease-out ${
                          isSelf
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                            : 'border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{player.avatar}</span>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[120px]">
                              {player.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Rank #{rankIndex + 1}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-black text-sm text-slate-900 dark:text-white">
                            {player.score} pts
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Results Screen */}
          {gameState === 'results' && (
            <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
              <div className="text-6xl">🏆</div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                  Match Complete!
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Here are the final standings of the live quiz battle.
                </p>
              </div>

              {/* Final Leaderboard list */}
              <div className="space-y-2.5">
                {rankedParticipants.map((player, idx) => {
                  const isSelf = player.id === 'user';
                  const isWinner = idx === 0;
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isSelf
                          ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                          : 'border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black text-slate-400 w-5">
                          {idx + 1}.
                        </span>
                        <span className="text-lg">{player.avatar}</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {player.name}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        {player.score} pts
                        {isWinner && <span>👑</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleJoinBattle}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition cursor-pointer"
                >
                  Battle Again
                </button>
                <button
                  onClick={() => setGameState('lobby')}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-slate-200 rounded-lg font-bold transition cursor-pointer"
                >
                  Exit Arena
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
