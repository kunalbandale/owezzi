import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, Settings, Share2, Check } from 'lucide-react';

type Theme = 'light' | 'dark' | 'midnight' | 'sunset' | 'nord' | 'emerald' | 'cherry' | 'lavender' | 'arctic' | 'ember' | 'monochrome';
type Mode = 'work' | 'short' | 'long';

interface TimerState {
  durations: { work: number; short: number; long: number };
  sessionCount: number;
  totalFocusTime: number;
  completedSessions: number;
}

const themeNames: Record<Theme, string> = {
  light: 'Light Mode',
  dark: 'Dark Mode',
  midnight: 'Midnight Blue',
  sunset: 'Seoul Sunrise',
  nord: 'Tokyo Dusk',
  emerald: 'Kyoto Forest',
  cherry: 'Nordic Cabin',
  lavender: 'Lavender Fields',
  arctic: 'Arctic Frost',
  ember: 'Ember Glow',
  monochrome: 'Monochrome',
};

interface BackgroundInfo {
  type: 'color' | 'gradient' | 'image';
  value: string;
  textDark: boolean;
}

const themeBackgrounds: Record<Theme, BackgroundInfo> = {
  light: { type: 'color', value: '#f7f7f9', textDark: true },
  dark: { type: 'color', value: '#121214', textDark: false },
  midnight: { type: 'color', value: '#0a0a1a', textDark: false },
  sunset: { type: 'image', value: '/seoul_sunrise.png', textDark: false },
  nord: { type: 'image', value: '/tokyo_dusk.png', textDark: false },
  emerald: { type: 'image', value: '/kyoto_forest.png', textDark: false },
  cherry: { type: 'image', value: '/nordic_snow.png', textDark: false },
  lavender: { type: 'gradient', value: 'linear-gradient(to bottom, #1a1625, #2d2447, #5c4d7d)', textDark: false },
  arctic: { type: 'gradient', value: 'linear-gradient(to bottom, #0f1a2a, #1a3a5c, #2d5a7b)', textDark: false },
  ember: { type: 'gradient', value: 'linear-gradient(to bottom, #1a0a0a, #3a1a0a, #5c2a0a)', textDark: false },
  monochrome: { type: 'color', value: '#18181b', textDark: false },
};



const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${m}:${s}`;
  }
  return `${m}:${s}`;
};

/**
 * Synthesizes and plays a notification sound using the Web Audio API oscillator.
 * Avoids loading large external audio files to optimize page load speeds.
 */
const playSound = (type: 'start' | 'complete', muted: boolean) => {
  if (muted) return;

  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === 'start') {
    // Gentle high-pitched click on starting the session
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.08;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.08);
  } else {
    // Upward two-tone melodic notification chime when focus/break concludes
    oscillator.frequency.value = 523.25;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.12;
    oscillator.start();
    setTimeout(() => {
      oscillator.frequency.value = 659.25;
    }, 120);
    oscillator.stop(audioContext.currentTime + 0.25);
  }
};

export default function App() {
  // Theme selection: Defaults to 'dark' mode if no saved preference in localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('owezzi-theme');
    return (saved as Theme) || 'dark';
  });

  const [state, setState] = useState<TimerState>(() => {
    const saved = localStorage.getItem('owezzi-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate from minutes to seconds if needed
      let durations = parsed.durations || { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
      if (durations.work < 180 && durations.work > 0) {
        durations = {
          work: durations.work * 60,
          short: durations.short * 60,
          long: durations.long * 60
        };
      }
      return {
        durations,
        sessionCount: parsed.sessionCount || 1,
        totalFocusTime: parsed.totalFocusTime || 0,
        completedSessions: parsed.completedSessions || 0,
      };
    }
    return {
      durations: { work: 25 * 60, short: 5 * 60, long: 15 * 60 },
      sessionCount: 1,
      totalFocusTime: 0,
      completedSessions: 0,
    };
  });

  const [mode, setMode] = useState<Mode>('work');
  const [timeLeft, setTimeLeft] = useState(state.durations.work);
  const [isRunning, setIsRunning] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('owezzi-muted') === 'true');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'timers' | 'sounds' | 'stats'>('general');
  const [tempWork, setTempWork] = useState(25);
  const [tempShort, setTempShort] = useState(5);
  const [tempLong, setTempLong] = useState(10);
  const [copied, setCopied] = useState(false);

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editH, setEditH] = useState(0);
  const [editM, setEditM] = useState(0);
  const [editS, setEditS] = useState(0);

  const handleCardClick = () => {
    if (isRunning) return;
    const total = state.durations[mode];
    setEditH(Math.floor(total / 3600));
    setEditM(Math.floor((total % 3600) / 60));
    setEditS(total % 60);
    setIsEditingTime(true);
  };

  const saveInlineTime = () => {
    let newTotal = editH * 3600 + editM * 60 + editS;
    if (newTotal < 1) newTotal = 1;
    const newDurations = { ...state.durations, [mode]: newTotal };
    setState((s) => ({ ...s, durations: newDurations }));
    setTimeLeft(newTotal);
    setIsEditingTime(false);
  };

  useEffect(() => {
    if (showSettings) {
      setTempWork(Math.floor(state.durations.work / 60));
      setTempShort(Math.floor(state.durations.short / 60));
      setTempLong(Math.floor(state.durations.long / 60));
      setSettingsTab('general');
    }
  }, [showSettings, state.durations]);

  const saveSettingsChanges = () => {
    const newDurations = {
      work: Math.max(1, tempWork) * 60,
      short: Math.max(1, tempShort) * 60,
      long: Math.max(1, tempLong) * 60,
    };
    setState((s) => ({ ...s, durations: newDurations }));
    setTimeLeft(newDurations[mode]);
    setShowSettings(false);
  };

  const intervalRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('owezzi-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('owezzi-state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('owezzi-muted', String(muted));
  }, [muted]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    playSound('start', muted);

    intervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          playSound('complete', muted);

          if (mode === 'work') {
            setState((s) => ({
              ...s,
              sessionCount: s.sessionCount + 1,
              completedSessions: s.completedSessions + 1,
              totalFocusTime: s.totalFocusTime + s.durations.work,
            }));

            const nextMode = state.sessionCount % 4 === 0 ? 'long' : 'short';
            setMode(nextMode);
            return state.durations[nextMode];
          } else {
            setMode('work');
            return state.durations.work;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, state.durations, state.sessionCount, muted]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleTimer = useCallback(() => {
    setIsRunning((prev) => !prev);
    setIsEditingTime(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(state.durations[mode]);
    setIsEditingTime(false);
  }, [mode, state.durations]);



  const handleModeChange = (newMode: Mode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(state.durations[newMode]);
    setIsEditingTime(false);
  };

  const handleShare = async () => {
    const shareText = `I've completed ${state.completedSessions} focus sessions (${Math.floor(state.totalFocusTime / 60)} minutes) using Owezzi Pomodoro Timer! boost your productivity at owezzi.in`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Owezzi - Pomodoro Timer',
          text: shareText,
          url: 'https://owezzi.in',
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };


  const bgInfo = themeBackgrounds[theme];
  const isDark = !bgInfo.textDark;
  const bgStyle = bgInfo.type === 'image'
    ? { backgroundImage: `url(${bgInfo.value})`, backgroundPosition: 'center', backgroundSize: 'cover' }
    : bgInfo.type === 'gradient'
      ? { background: bgInfo.value }
      : { backgroundColor: bgInfo.value };

  return (
    <div
      ref={containerRef}
      style={bgStyle}
      className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-[background-image,background-color,color] duration-1000 ease-in-out font-ui ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}
    >
      {/* Ambient glow effect when running */}
      {isRunning && (
        <div
          className="fixed inset-0 pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(ellipse at 50% 45%, var(--ambient-color, rgba(100,100,150,0.06)), transparent 55%)`,
          }}
        />
      )}

      {/* Top Left Branding Logo */}
      <div className="absolute top-6 left-6 z-20 flex flex-col pointer-events-none select-none">
        <span className={`text-3xl font-bold tracking-tight font-logo leading-none drop-shadow-md ${isDark ? 'text-white' : 'text-slate-900'}`}>
          owezzi.in
        </span>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        <button
          onClick={() => setMuted((m) => !m)}
          className={`p-2.5 rounded-full backdrop-blur-md transition-all select-none hover:scale-105 active:scale-95 ${
            isDark ? 'bg-black/20 hover:bg-black/40 text-white' : 'bg-white/40 hover:bg-white/60 text-slate-900 border border-slate-900/10'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          onClick={toggleFullscreen}
          className={`p-2.5 rounded-full backdrop-blur-md transition-all select-none hover:scale-105 active:scale-95 ${
            isDark ? 'bg-black/20 hover:bg-black/40 text-white' : 'bg-white/40 hover:bg-white/60 text-slate-900 border border-slate-900/10'
          }`}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Main Timer Display Area */}
      <div className="flex flex-col items-center justify-center z-10 px-4 text-center">
        {/* Mode Tabs */}
        <div className="flex gap-2 sm:gap-3 justify-center mb-8 select-none">
          {(['work', 'short', 'long'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all backdrop-blur-md lowercase border ${
                mode === m
                  ? isDark
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : isDark
                    ? 'border-white/30 text-white/90 hover:bg-white/10'
                    : 'border-slate-900/20 text-slate-900/90 hover:bg-black/5'
              }`}
            >
              {m === 'work' ? 'pomodoro' : m === 'short' ? 'short break' : 'long break'}
            </button>
          ))}
        </div>

        {/* Big digits / edit block */}
        <div className="relative mb-6">
          {isEditingTime ? (
            <div className="flex flex-col items-center gap-4 py-5 px-6 rounded-[28px] bg-black/85 backdrop-blur-md border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 justify-center text-4xl sm:text-5xl font-bold text-white">
                <div className="relative flex items-center justify-center">
                  <input
                    type="number"
                    value={editH || ''}
                    onChange={(e) => setEditH(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className="w-16 sm:w-20 text-center bg-white/10 text-white font-bold rounded-xl py-2 px-1 outline-none border border-white/20 focus:border-[var(--accent)] transition-colors text-3xl sm:text-4xl"
                    placeholder="00"
                  />
                  <span className="absolute bottom-1 right-2 text-[9px] text-white/50 pointer-events-none uppercase font-semibold">h</span>
                </div>
                <span className="opacity-50 text-2xl">:</span>
                <div className="relative flex items-center justify-center">
                  <input
                    type="number"
                    value={editM || ''}
                    onChange={(e) => setEditM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-16 sm:w-20 text-center bg-white/10 text-white font-bold rounded-xl py-2 px-1 outline-none border border-white/20 focus:border-[var(--accent)] transition-colors text-3xl sm:text-4xl"
                    placeholder="00"
                  />
                  <span className="absolute bottom-1 right-2 text-[9px] text-white/50 pointer-events-none uppercase font-semibold">m</span>
                </div>
                <span className="opacity-50 text-2xl">:</span>
                <div className="relative flex items-center justify-center">
                  <input
                    type="number"
                    value={editS || ''}
                    onChange={(e) => setEditS(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-16 sm:w-20 text-center bg-white/10 text-white font-bold rounded-xl py-2 px-1 outline-none border border-white/20 focus:border-[var(--accent)] transition-colors text-3xl sm:text-4xl"
                    placeholder="00"
                  />
                  <span className="absolute bottom-1 right-2 text-[9px] text-white/50 pointer-events-none uppercase font-semibold">s</span>
                </div>
              </div>
              <div className="flex gap-2 w-full max-w-[200px] justify-center mt-2">
                <button
                  onClick={saveInlineTime}
                  className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:scale-105 transition-all shadow-md active:scale-95"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingTime(false)}
                  className="flex-1 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold hover:scale-105 transition-all border border-white/10 active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center select-none cursor-pointer group px-6 text-center"
              onClick={handleCardClick}
              title={isRunning ? "" : "Click to edit duration"}
            >
              <div className={`text-8xl sm:text-[11rem] md:text-[13rem] font-extrabold tabular-nums tracking-tighter leading-none font-clock drop-shadow-2xl hover:scale-105 transition-transform duration-500 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {formatTime(timeLeft)}
              </div>
              {!isRunning && (
                <div className="text-[10px] sm:text-xs font-semibold opacity-0 group-hover:opacity-85 transition-all duration-300 mt-2 bg-black/40 px-4 py-1.5 rounded-full text-white backdrop-blur-sm border border-white/10 shadow-md">
                  Click to Edit Duration
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons / Controls Row */}
        <div className="flex items-center gap-4 justify-center mt-6 select-none">
          <button
            onClick={toggleTimer}
            className={`px-10 py-3 sm:px-12 sm:py-3.5 rounded-full font-bold text-base sm:text-lg transition-all shadow-lg hover:scale-105 active:scale-95 ${
              isDark 
                ? 'bg-white text-black hover:bg-white/90 shadow-white/5' 
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/10'
            }`}
          >
            {isRunning ? 'pause' : 'start'}
          </button>

          <button
            onClick={resetTimer}
            className={`p-3 rounded-full transition-all select-none hover:scale-110 active:scale-95 border backdrop-blur-sm ${
              isDark 
                ? 'border-white/30 text-white/80 hover:text-white hover:bg-white/10' 
                : 'border-slate-900/30 text-slate-800 hover:text-slate-950 hover:bg-black/5'
            }`}
            title="Reset"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className={`p-3 rounded-full transition-all select-none hover:scale-110 active:scale-95 border backdrop-blur-sm ${
              isDark 
                ? 'border-white/30 text-white/80 hover:text-white hover:bg-white/10' 
                : 'border-slate-900/30 text-slate-800 hover:text-slate-950 hover:bg-black/5'
            }`}
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Session indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 opacity-70 hover:opacity-100 transition-opacity select-none text-center">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wide">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                  i < (state.sessionCount - 1) % 4 + 1
                    ? isDark ? 'bg-white' : 'bg-slate-900'
                    : isDark ? 'bg-white/20' : 'bg-slate-950/20'
                } ${
                  (state.sessionCount - 1) % 4 === i && isRunning ? 'animate-pulse' : ''
                }`}
              />
            ))}
            <span className={`ml-1.5 font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>{state.sessionCount} / 4</span>
          </div>
          <div className={`text-[9px] uppercase tracking-[0.25em] font-bold opacity-60 ${isDark ? 'text-white' : 'text-slate-950'}`}>
            sessions completed: {state.completedSessions}
          </div>
        </div>
      </div>

      {/* Sidebar Tabbed Settings Panel (studywithme.io style) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-2xl settings-modal rounded-[28px] overflow-hidden flex h-[480px] shadow-2xl animate-modal-enter border">
            {/* Sidebar (Left Pane) */}
            <div className="w-1/3 p-6 flex flex-col gap-3 settings-sidebar h-full border-r">
              <h3 className="text-xs uppercase tracking-[0.15em] font-bold settings-text-muted mb-3 px-3">Preferences</h3>
              {(['general', 'timers', 'sounds', 'stats'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSettingsTab(tab)}
                  className={`w-full text-left py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    settingsTab === tab
                      ? 'settings-tab-active shadow-sm font-bold pl-4'
                      : 'settings-tab-inactive pl-3'
                  }`}
                >
                  {tab === 'general' ? 'General' : tab === 'timers' ? 'Timers' : tab === 'sounds' ? 'Sounds' : 'Statistics'}
                </button>
              ))}

              <button
                onClick={() => {
                  if (confirm('Reset all configuration, timers, and theme settings to default?')) {
                    localStorage.removeItem('owezzi-theme');
                    localStorage.removeItem('owezzi-state');
                    localStorage.removeItem('owezzi-muted');
                    window.location.reload();
                  }
                }}
                className="border border-red-500/35 hover:bg-red-500/10 text-red-500 font-semibold px-4 py-2 rounded-xl text-xs transition-all mt-auto self-start bg-transparent"
              >
                Reset all
              </button>
            </div>

            {/* Content Viewport (Right Pane) */}
            <div className="w-2/3 p-8 flex flex-col justify-between h-full settings-content">
              <div className="flex-1 overflow-y-auto pr-1">
                {settingsTab === 'general' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider settings-text-muted mb-2 font-bold">Aesthetic Theme</h4>
                      <div className="relative">
                        <select
                          value={theme}
                          onChange={(e) => setTheme(e.target.value as Theme)}
                          className="w-full settings-input rounded-xl px-4 py-3 outline-none transition-colors text-sm font-semibold cursor-pointer appearance-none"
                        >
                          {(Object.keys(themeNames) as Theme[]).map((t) => (
                            <option key={t} value={t} className="bg-[var(--bg)] py-2 text-[var(--ink)]">
                              {themeNames[t]}
                            </option>
                          ))}
                        </select>
                        <span className="absolute right-4 top-3.5 settings-text-muted/50 pointer-events-none text-xs">▼</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-[var(--muted)]/10 mt-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Sound Notifications</span>
                        <span className="text-[10px] settings-text-muted">Ping browser alert when session completes</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 settings-toggle-track peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--bg)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                      </label>
                    </div>
                  </div>
                )}

                {settingsTab === 'timers' && (
                  <div className="flex flex-col gap-5">
                    <h4 className="text-xs uppercase tracking-wider settings-text-muted mb-1 font-bold">Set Session Durations</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] settings-text-muted mb-1.5 block font-semibold">Focus</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={tempWork}
                            onChange={(e) => setTempWork(Math.max(1, parseInt(e.target.value) || 0))}
                            min={1}
                            className="w-full text-center settings-input rounded-xl py-2.5 outline-none transition-colors text-sm font-bold"
                          />
                        </div>
                        <span className="text-[9px] settings-text-muted text-center block mt-1">minutes</span>
                      </div>

                      <div>
                        <label className="text-[10px] settings-text-muted mb-1.5 block font-semibold">Short Break</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={tempShort}
                            onChange={(e) => setTempShort(Math.max(1, parseInt(e.target.value) || 0))}
                            min={1}
                            className="w-full text-center settings-input rounded-xl py-2.5 outline-none transition-colors text-sm font-bold"
                          />
                        </div>
                        <span className="text-[9px] settings-text-muted text-center block mt-1">minutes</span>
                      </div>

                      <div>
                        <label className="text-[10px] settings-text-muted mb-1.5 block font-semibold">Long Break</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={tempLong}
                            onChange={(e) => setTempLong(Math.max(1, parseInt(e.target.value) || 0))}
                            min={1}
                            className="w-full text-center settings-input rounded-xl py-2.5 outline-none transition-colors text-sm font-bold"
                          />
                        </div>
                        <span className="text-[9px] settings-text-muted text-center block mt-1">minutes</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 py-3 border-t border-[var(--muted)]/10 mt-3 select-none">
                      <input
                        type="checkbox"
                        id="seq-toggle"
                        defaultChecked
                        className="w-4 h-4 rounded text-[var(--accent)] bg-[var(--surface)] border-[var(--muted)]/25 focus:ring-0 cursor-pointer mt-0.5"
                      />
                      <label htmlFor="seq-toggle" className="text-xs text-[var(--ink)]/80 cursor-pointer font-medium leading-relaxed">
                        Use the Pomodoro sequence: Pomodoro &rarr; short break, repeat 4x, then one long break.
                      </label>
                    </div>
                  </div>
                )}

                {settingsTab === 'sounds' && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider settings-text-muted mb-2 font-bold">Mute Settings</h4>
                      <button
                        onClick={() => setMuted((m) => !m)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                          muted
                            ? 'border-red-500/25 bg-red-500/10 text-red-400'
                            : 'settings-button-secondary'
                        }`}
                      >
                        {muted ? 'Sound Muted' : 'Sound Enabled'}
                      </button>
                    </div>

                    <div className="border-t border-[var(--muted)]/10 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs uppercase tracking-wider settings-text-muted font-bold">Volume</h4>
                        <span className="text-xs text-[var(--ink)]/80">80%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        defaultValue="80"
                        className="w-full accent-[var(--accent)] bg-[var(--surface)] h-1 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {settingsTab === 'stats' && (
                  <div className="flex flex-col gap-5">
                    <h4 className="text-xs uppercase tracking-wider settings-text-muted font-bold">Study Record</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl p-4 settings-card">
                        <div className="text-3xl font-extrabold text-[var(--ink)]">{state.completedSessions}</div>
                        <div className="text-xs settings-text-muted font-semibold mt-1">Sessions Completed</div>
                      </div>
                      <div className="rounded-2xl p-4 settings-card">
                        <div className="text-3xl font-extrabold text-[var(--ink)]">{Math.floor(state.totalFocusTime / 60)}</div>
                        <div className="text-xs settings-text-muted font-semibold mt-1">Total Focus Minutes</div>
                      </div>
                    </div>

                    <div className="border-t border-[var(--muted)]/10 pt-4">
                      <button
                        onClick={handleShare}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                          copied
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'settings-button-primary font-bold shadow-lg'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check size={16} />
                            Copied stats to clipboard!
                          </>
                        ) : (
                          <>
                            <Share2 size={16} />
                            Share Progress Stats
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--muted)]/15 mt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2.5 rounded-full settings-button-secondary transition-all text-sm font-semibold active:scale-95"
                >
                  Close
                </button>
                <button
                  onClick={saveSettingsChanges}
                  className="px-6 py-2.5 rounded-full settings-button-primary transition-all text-sm font-bold active:scale-95 shadow-md shadow-white/5"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
