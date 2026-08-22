import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

const TOUR_STEPS = [
  {
    target: '[data-tour="dashboard-overview"]',
    title: 'Welcome to PaySphere! 👋',
    content: 'This is your primary dashboard. Get an instant summary of payroll status, team metrics, and key updates.',
    position: 'bottom',
    path: '/dashboard',
  },
  {
    target: '[data-tour="employee-portal"]',
    title: 'My Employee Portal 👤',
    content: 'Access your personal profile, tax declarations, pay slips, and self-service requests.',
    position: 'right',
    path: '/dashboard',
  },
  {
    target: '[data-tour="monthly-updates"]',
    title: 'Monthly Updates & Payroll 📅',
    content: 'Log employee leaves, overtime hours, bonuses, and deductions with natural language processing.',
    position: 'right',
    path: '/dashboard',
  },
  {
    target: '[data-tour="expense-reports"]',
    title: 'Custom Expense Reports 💸',
    content: 'Submit expense claims, bundle claims into custom reports, and track reimbursement statuses in real-time.',
    position: 'right',
    path: '/dashboard',
  },
  {
    target: '[data-tour="command-palette"]',
    title: 'Global Command Palette (Ctrl+K) ⚡',
    content: 'Press Ctrl+K (or Cmd+K) anywhere to instantly jump to employees, reports, actions, or settings.',
    position: 'bottom',
    path: '/dashboard',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings & Preferences ⚙️',
    content: 'Customize your theme, payroll configuration, notice period defaults, and company branding.',
    position: 'top',
    path: '/dashboard',
  },
];

export const OnboardingTour = () => {
  const token = useAppStore((state) => state.token) || localStorage.getItem('token');
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;

    const completed = localStorage.getItem('paysphere_tour_completed');
    if (!completed) {
      setIsOpen(true);
    }

    const handleRestartTour = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener('paysphere:restart-tour', handleRestartTour);
    return () => {
      window.removeEventListener('paysphere:restart-tour', handleRestartTour);
    };
  }, [token]);

  if (!isOpen || !token) return null;

  const step = TOUR_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = TOUR_STEPS[currentStep + 1];
      if (nextStep.path && location.pathname !== nextStep.path) {
        navigate(nextStep.path);
      }
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    localStorage.setItem('paysphere_tour_completed', 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] pointer-events-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            Tour Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            Skip Tour
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{step.title}</h3>
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{step.content}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            disabled={currentStep === 0}
            onClick={handlePrev}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-40 transition"
          >
            Back
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Finish Tour 🎉' : 'Next Step ➔'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
