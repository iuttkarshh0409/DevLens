import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, animate } from 'framer-motion';
import { Github, Link, Clipboard, ArrowRight, CheckCircle2, AlertCircle, Info, Loader2, Download, Zap, FileText, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- CONFIGURATION ---
const API_BASE_URL = "http://localhost:8000";

// --- UI COMPONENTS ---

const AnimatedScore = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(latest),
    });
    return () => controls.stop();
  }, [value]);

  return (
    <span className="tabular-nums font-black text-white">
      {displayValue.toFixed(1)}
    </span>
  );
};

const Badge = ({ children, status }) => {
  const styles = {
    "ELITE": "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]",
    "STRONG": "bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]",
    "INTERVIEW": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    "POLISH": "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    "REJECT": "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    "Audit Failed": "bg-slate-500/10 text-slate-400 border-slate-500/20"
  };
  return (
    <motion.span 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all",
        styles[status] || styles['Needs Radical Polish']
      )}
    >
      {children}
    </motion.span>
  );
};

const Card = ({ children, className, delay = 0 }) => (
  <motion.div 
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className={cn(
      "relative group backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden",
      className
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    {children}
  </motion.div>
);

const PremiumButton = ({ children, onClick, disabled, className, variant = 'primary' }) => {
  const styles = {
    primary: "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    ghost: "bg-transparent text-slate-400 hover:text-white"
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative rounded-2xl font-bold px-8 py-4 transition-all flex items-center justify-center gap-2",
        styles[variant],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {variant === 'primary' && !disabled && (
        <motion.div 
          className="absolute inset-0 rounded-2xl bg-white/20"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        />
      )}
      {children}
    </motion.button>
  );
};

// --- APP CORE ---

export default function App() {
  const [view, setView] = useState('LANDING');
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const performAudit = async (url) => {
    if (!url.includes('github.com/')) {
        setError("Please enter a valid GitHub repository URL");
        return;
    }
    setView('LOADING');
    setError(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const resData = await response.json();

      if (!response.ok) throw new Error(resData.detail || "Analysis failed");

      setData(resData);
      setView('RESULTS');
    } catch (err) {
      setError(err.name === 'AbortError' ? "Analysis timed out" : err.message);
      setView('LANDING');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes('github.com')) setRepoUrl(text);
    } catch (err) {}
  };

  const handleSaveAnalysis = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devlens-audit-${data.score}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- RENDERING ---

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-sky-500/30 relative overflow-hidden">
      {/* GLOBAL BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-sky-500/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[120px] animate-pulse delay-700" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <AnimatePresence mode="wait">
        {/* 1. LANDING VIEW */}
        {view === 'LANDING' && (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 max-w-4xl mx-auto pt-32 pb-12 px-6 text-center space-y-16"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/20 bg-sky-500/5 text-sky-400 text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-3 h-3" /> System V2.4 Now Live
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white leading-[1.1]">
                Code that <br /> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400">closes deals.</span>
              </h1>
              <p className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl font-medium leading-relaxed">
                DevLens performs industrial-grade audits on your GitHub repositories to surface the hiring signals recruiters actually look for.
              </p>
            </motion.div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative max-w-2xl mx-auto"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-purple-600 rounded-3xl blur opacity-20 group-focus-within:opacity-40 transition" />
              <div className="relative bg-slate-900/80 border border-white/10 p-2 rounded-3xl flex flex-col md:flex-row gap-2">
                <div className="flex-1 flex items-center px-6 gap-4 bg-transparent group">
                  <Github className="w-6 h-6 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
                  <input 
                    type="text"
                    placeholder="URL: github.com/user/project"
                    className="w-full bg-transparent border-none outline-none py-5 text-slate-100 placeholder:text-slate-600 font-bold text-lg"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && performAudit(repoUrl)}
                  />
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePaste} 
                    className="text-slate-500 hover:text-sky-400 p-2"
                  >
                    <Clipboard className="w-5 h-5" />
                  </motion.button>
                </div>
                <PremiumButton onClick={() => performAudit(repoUrl)} disabled={!repoUrl.includes('github.com/')}>
                  Analyze <ArrowRight className="w-5 h-5" />
                </PremiumButton>
              </div>
            </motion.div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto p-5 bg-rose-500/5 backdrop-blur-md border border-rose-500/20 text-rose-400 rounded-3xl flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0 font-black">!</div>
                <p className="text-sm font-bold text-left leading-tight">{error}</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 2. LOADING VIEW */}
        {view === 'LOADING' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center pt-48 space-y-12 px-6 text-center"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 border-4 border-sky-500/5 border-t-sky-500 rounded-full shadow-[0_0_30px_rgba(14,165,233,0.2)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Github className="w-10 h-10 text-sky-500" />
                </motion.div>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-white tracking-tight uppercase">Quantifying Skillset...</h2>
              <div className="flex gap-1 justify-center">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-sky-500"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 3. RESULTS VIEW */}
        {view === 'RESULTS' && data && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 max-w-6xl mx-auto p-6 md:p-12 space-y-16"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-8 border-b border-white/5">
                <PremiumButton variant="ghost" onClick={() => setView('LANDING')} className="px-0">
                  <ArrowRight className="w-5 h-5 rotate-180" /> <span className="uppercase tracking-widest text-[10px] font-black">New Audit</span>
                </PremiumButton>
                <PremiumButton onClick={handleSaveAnalysis} variant="secondary">
                  <Download className="w-4 h-4" /> Save Analysis
                </PremiumButton>
            </div>

            {/* Main Section */}
            <section className="relative group text-center space-y-8">
                {/* Score Glow Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-sky-500/20 blur-[100px] pointer-events-none group-hover:bg-sky-500/30 transition-all duration-700" />
                
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="relative space-y-6"
                >
                    <span className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] relative z-10">Recruiter Scorecard</span>
                    <div className="text-[10rem] md:text-[14rem] font-black text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] leading-none font-mono">
                      <AnimatedScore value={data.score} />
                    </div>
                    <div className="flex justify-center">
                      <Badge status={data.status}>{data.status}</Badge>
                    </div>
                </motion.div>
            </section>

            {/* Executive Summary & Insight */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 space-y-6" delay={0.1}>
                    <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-8 h-px bg-slate-800" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-400/80">Recruiter Verdict</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-slate-100 leading-[1.4] selection:bg-sky-500/50">
                    "{data.feedback}"
                    </p>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.15)] place-content-center" delay={0.2}>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 border border-indigo-500/30 rounded-xl bg-indigo-500/10">
                              <Zap className="w-6 h-6 text-indigo-400 fill-indigo-400/20" />
                            </div>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{data.wow_insight?.title || 'Signal Detected'}</span>
                        </div>
                        <p className="text-xl font-bold text-white leading-snug">
                            {data.wow_insight?.description}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card delay={0.3}>
                    <div className="flex items-center gap-3 mb-10">
                        <div className="p-2 border border-amber-500/20 rounded-xl bg-amber-500/5">
                          <Zap className="w-5 h-5 text-amber-500" />
                        </div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Hiring Priority Items</h3>
                    </div>
                    <div className="space-y-4">
                        {data.checklist.map((item, id) => (
                           <motion.details 
                             key={id} 
                             whileHover={{ x: 4 }}
                             className="group bg-white/5 border border-white/5 rounded-2xl overflow-hidden cursor-pointer hover:border-white/10 transition-all border-l-4 border-l-amber-500/50"
                           >
                                <summary className="flex items-center justify-between p-5 list-none">
                                    <div className="flex items-center gap-3">
                                        {item.impact === 'High' ? (
                                            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        )}
                                        <span className="font-bold text-slate-200 text-sm">{item.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={cn(
                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                                        item.impact === 'High' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 'text-slate-500 border-white/5 bg-white/5'
                                      )}>
                                          {item.impact}
                                      </span>
                                      <motion.div animate={{ rotate: 0 }} className="group-open:rotate-180 transition-transform">
                                          <ArrowRight className="w-4 h-4 rotate-90" />
                                      </motion.div>
                                    </div>
                                </summary>
                                <div className="px-5 pb-5 space-y-4 text-xs leading-relaxed border-t border-white/5 pt-4">
                                    <div className="flex gap-2">
                                        <div className="w-1 bg-sky-500/50 rounded-full" />
                                        <p className="text-slate-400 font-medium">{item.hiring_impact || item.reasoning}</p>
                                    </div>
                                </div>
                           </motion.details>
                        ))}
                    </div>
                </Card>

                <Card delay={0.4}>
                    <div className="flex items-center gap-3 mb-10">
                         <div className="p-2 border border-sky-500/20 rounded-xl bg-sky-500/5">
                            <FileText className="w-5 h-5 text-sky-500" />
                        </div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Documentation Health</h3>
                    </div>
                    <div className="space-y-3">
                        {data.readme_audits.map((audit, id) => (
                           <motion.div 
                            key={id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + (id * 0.05) }}
                            className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5"
                           >
                                <div className="flex items-center gap-3">
                                  {audit.passed ? (
                                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                      </div>
                                  ) : (
                                      <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                        <AlertCircle className="w-4 h-4 text-rose-500" />
                                      </div>
                                  )}
                                  <span className={cn(
                                    "text-sm font-bold",
                                    audit.passed ? "text-slate-200" : "text-slate-500 line-through decoration-slate-600/50"
                                  )}>{audit.label}</span>
                                </div>
                           </motion.div>
                        ))}
                    </div>
                </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOM CURSOR EFFECT (SUBTLE) */}
      <div className="hidden lg:block fixed inset-0 pointer-events-none mix-blend-screen opacity-20 bg-[radial-gradient(circle_at_var(--x)_var(--y),_#38bdf8_0%,_transparent_20%)]" />
    </div>
  );
}
