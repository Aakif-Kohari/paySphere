import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import Dashboard from "../components/Dashboard"
import Steps from "../components/Steps"
import FAQS from "../components/FAQS"
import Contributors from "../components/Contributors"
import Footer from "../components/Footer"
import { Helmet } from "react-helmet-async";

// Helper component for floating background shapes
const FloatingShape = ({ children, className, delay = "0s", duration = "6s" }) => (
  <div 
    className={`absolute hidden md:flex items-center justify-center rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl pointer-events-none ${className}`}
    style={{
      animation: `float ${duration} ease-in-out infinite`,
      animationDelay: delay,
    }}
  >
    {children}
  </div>
);

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 font-['Outfit'] text-[#1A1A1A] dark:text-slate-100 selection:bg-blue-200 selection:text-blue-800 transition-colors duration-200 overflow-hidden">
      <Helmet>
        <title>Digital Ledger for Modern Bharat | PaySphere</title>
        <meta name="description" content="Automate your payroll, manage employees, and generate reports in minutes. Experience the simplest payroll tool for small businesses." />
      </Helmet>

      {/* --- INLINE CSS FOR SMOOTH FLOATING ANIMATIONS --- */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>

      {/* --- BACKGROUND EFFECTS & SHAPES --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        
        {/* 1. Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>

        {/* 2. Glowing Gradient Orbs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-emerald-400/20 dark:bg-emerald-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-indigo-400/10 dark:bg-indigo-600/10 rounded-full blur-[120px]"></div>
        
        {/* Top Left: Rupee Sign */}
        <FloatingShape 
          className="top-32 left-[10%] w-16 h-16 bg-white/60 dark:bg-slate-800/60 text-emerald-500 dark:text-emerald-400" 
          duration="7s"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-6 4h6m-6-8h6a3 3 0 010 6H9m0 0v8" />
          </svg>
        </FloatingShape>

        {/* Top Right: Dollar Sign */}
        <FloatingShape 
          className="top-40 right-[15%] w-20 h-20 bg-white/60 dark:bg-slate-800/60 text-blue-500 dark:text-blue-400" 
          delay="1s" duration="6s"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </FloatingShape>

        {/* Bottom Left: Analytics Chart */}
        <FloatingShape 
          className="bottom-[48%] left-[15%] w-14 h-14 bg-white/60 dark:bg-slate-800/60 text-indigo-500 dark:text-indigo-400" 
          delay="2.5s" duration="8s"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </FloatingShape>

        {/* Bottom Right: Sparkles */}
        <FloatingShape 
          className="bottom-[38%] right-[20%] w-16 h-16 bg-white/60 dark:bg-slate-800/60 text-amber-500 dark:text-amber-400" 
          delay="1.5s" duration="6.5s"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </FloatingShape>

      </div>

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Dashboard />
        <Steps />
        <FAQS />
        <Contributors />
        <Footer />
      </div>
    </div>
  )
}