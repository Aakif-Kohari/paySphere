import { useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/85 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-20 flex justify-between items-center">

        {/* Logo */}
        <div className="flex items-center gap-6">
          <div className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900 dark:text-white">
            <img
              src="/logo.png"
              alt="PaySphere Logo"
              className="w-14 h-14 sm:w-20 sm:h-20 object-contain"
            />
            PaySphere
          </div>

          {/* Desktop Menu */}
          <ul className="hidden md:flex gap-6 lg:gap-8 text-[14px] lg:text-[15px] font-medium text-gray-600 dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">Features</a>
            <a href="#process" className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">Process</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">FAQ</a>
          </ul>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-3 lg:gap-4">
          <ThemeToggle />
          <Link
            to="/auth?mode=login"
            className="text-[15px] font-semibold px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200 rounded-lg transition-colors"
          >
            Login
          </Link>
          <Link
            to="/auth?mode=signup"
            className="bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            className="flex flex-col gap-1 p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <span className="w-6 h-0.5 bg-black dark:bg-white transition-colors"></span>
            <span className="w-6 h-0.5 bg-black dark:bg-white transition-colors"></span>
            <span className="w-6 h-0.5 bg-black dark:bg-white transition-colors"></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-6 pb-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 transition-colors duration-200">
          <ul className="flex flex-col gap-4 text-[15px] font-medium text-gray-700 dark:text-slate-200 mt-4 mb-6">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => setIsOpen(false)}>Features</a>
            <a href="#process" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => setIsOpen(false)}>Process</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => setIsOpen(false)}>Pricing</a>
            <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => setIsOpen(false)}>FAQ</a>
          </ul>

          <div className="flex items-center gap-4">
            <Link
              to="/auth?mode=login"
              className="flex-1 text-center text-[15px] font-semibold px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Login
            </Link>
            <Link
              to="/auth?mode=signup"
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              onClick={() => setIsOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}