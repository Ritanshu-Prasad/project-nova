import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Code2,
  Copy,
  Flame,
  Key,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  getInitialAISettings,
  saveAISettings,
  sendChatMessage,
  type AIProvider,
  type AISettings,
  type ChatMessage,
} from '../../core/aiService';
import { audio } from '../../core/audio';
import { getRankTier, useGamification } from '../../core/gamification';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import './comms.css';

type StudyTab = 'chat' | 'quiz' | 'codelab' | 'notes';
type TeachingStyle = 'socratic' | 'eli5' | 'blitz' | 'deep';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  mmrReward: number;
}

const SAMPLE_QUIZ: QuizQuestion[] = [
  {
    id: 'quiz-1',
    question: 'What is the worst-case time complexity of searching in an unbalanced Binary Search Tree (BST)?',
    options: ['O(log n)', 'O(1)', 'O(n)', 'O(n log n)'],
    correctIndex: 2,
    explanation:
      'In the worst case (e.g. elements inserted in strictly ascending order), an unbalanced BST degenerates into a single linked list, requiring O(n) traversals.',
    mmrReward: 25,
  },
  {
    id: 'quiz-2',
    question: 'In the JavaScript Runtime, which queue executes first after the synchronous stack empties?',
    options: ['Macrotask Queue (setTimeout)', 'Microtask Queue (Promise.then)', 'RequestAnimationFrame', 'I/O Polling'],
    correctIndex: 1,
    explanation:
      'The microtask queue (Promise callbacks, queueMicrotask) is drained completely before the event loop picks up the next macrotask.',
    mmrReward: 30,
  },
  {
    id: 'quiz-3',
    question: 'Which data structures combine to create an O(1) Least Recently Used (LRU) Cache?',
    options: ['Hash Map + Doubly Linked List', 'Binary Heap + Array', 'Stack + Queue', 'Trie + Graph'],
    correctIndex: 0,
    explanation:
      'The Hash Map provides O(1) key lookups, while the Doubly Linked List allows O(1) node detachment and moving elements to the front.',
    mmrReward: 35,
  },
];

export default function CommsPanel() {
  const open = useNova((s) => s.commsOpen);
  const mmr = useGamification((s) => s.mmr);
  const xp = useGamification((s) => s.xp);
  const streak = useGamification((s) => s.streak);
  const recentMmrDelta = useGamification((s) => s.recentMmrDelta);
  const recordMmrChange = useGamification((s) => s.recordMmrChange);
  const recordXpGain = useGamification((s) => s.recordXpGain);
  const resetProgress = useGamification((s) => s.resetProgress);

  const [activeTab, setActiveTab] = useState<StudyTab>('chat');
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyle>('socratic');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [settings, setSettings] = useState<AISettings>(getInitialAISettings);
  const [showSettings, setShowSettings] = useState(false);

  // Chat Tab State
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      sender: 'ai',
      content: `Greetings Pilot! NOVA Comms online. 🛰️\n\nI am your personal AI Study Companion. How can I assist your learning today?\n\n- 💬 **Ask me any technical question or concept**\n- 🎯 **Take the Practice Quiz to boost your MMR**\n- 💻 **Use Code Lab to analyze time complexity and bugs**\n- 📝 **Review Smart Revision Notes**`,
      timestamp: Date.now(),
    },
  ]);

  // Quiz Tab State
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Code Lab State
  const [codeSnippet, setCodeSnippet] = useState(
    `function findDuplicates(arr: number[]): number[] {\n  const seen = new Set<number>();\n  const dupes: number[] = [];\n  for (const x of arr) {\n    if (seen.has(x)) dupes.push(x);\n    else seen.add(x);\n  }\n  return dupes;\n}`
  );
  const [codeAnalysis, setCodeAnalysis] = useState<string | null>(null);
  const [analyzingCode, setAnalyzingCode] = useState(false);

  // Smart Notes
  const [notes, setNotes] = useState<string[]>([
    'BST Lookup: O(log n) average if balanced (AVL/Red-Black), O(n) if degenerated.',
    'Microtask Queue: Promises & MutationObservers take priority over macrotasks (setTimeout).',
    'LRU Cache: HashMap (O(1) get) + Doubly Linked List (O(1) eviction/reordering).',
  ]);

  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rank = getRankTier(mmr);
  const level = Math.floor(xp / 250) + 1;
  const xpInLevel = xp % 250;
  const xpProgress = Math.min(100, Math.round((xpInLevel / 250) * 100));

  // Auto-scroll
  useEffect(() => {
    if (activeTab === 'chat' && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, loading, activeTab]);

  // Play boot audio when opened
  useEffect(() => {
    if (open) {
      audio.play('hudBoot');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Speech readout helper
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`]/g, '').slice(0, 300);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const closeComms = () => {
    audio.play('click');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    useNova.getState().setCommsOpen(false);
  };

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || input.trim();
    if (!textToSend || loading) return;

    audio.play('click');
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setInput('');
    setLoading(true);

    // Apply persona modifier to prompt
    let contextualText = textToSend;
    if (teachingStyle === 'socratic') {
      contextualText += '\n[Style: Socratic Mentor - guide me with questions rather than just lecturing]';
    } else if (teachingStyle === 'eli5') {
      contextualText += '\n[Style: ELI5 - explain using an intuitive real-world analogy]';
    } else if (teachingStyle === 'blitz') {
      contextualText += '\n[Style: Exam Blitz - keep it crisp, high-yield bullet points]';
    }

    try {
      const response = await sendChatMessage(messages, contextualText, settings);
      audio.play('notify');

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        content: response.text,
        timestamp: Date.now(),
        mmrDelta: response.mmrDelta,
        xpDelta: response.xpDelta,
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (voiceEnabled) {
        speakText(response.text);
      }

      if (response.mmrDelta) recordMmrChange(response.mmrDelta);
      if (response.xpDelta) recordXpGain(response.xpDelta);
    } catch {
      audio.play('denied');
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'system',
          content: 'Transmission interrupted. Check your network or model settings in the gear menu.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Submit Quiz Answer
  const handleQuizSubmit = () => {
    if (selectedOption === null || quizSubmitted) return;
    const q = SAMPLE_QUIZ[currentQuizIndex];
    setQuizSubmitted(true);

    if (selectedOption === q.correctIndex) {
      audio.play('chime');
      recordMmrChange(q.mmrReward);
      recordXpGain(q.mmrReward * 2);
    } else {
      audio.play('denied');
      recordMmrChange(-10);
    }
  };

  const nextQuizQuestion = () => {
    setSelectedOption(null);
    setQuizSubmitted(false);
    setCurrentQuizIndex((prev) => (prev + 1) % SAMPLE_QUIZ.length);
    audio.play('click');
  };

  // Analyze Code in Lab
  const analyzeCodeHandler = async () => {
    if (!codeSnippet.trim() || analyzingCode) return;
    setAnalyzingCode(true);
    audio.play('click');

    const prompt = `Analyze this code snippet for correctness, edge cases, and Big-O time and space complexity:\n\`\`\`typescript\n${codeSnippet}\n\`\`\``;
    try {
      const res = await sendChatMessage([], prompt, settings);
      setCodeAnalysis(res.text);
      audio.play('notify');
      recordXpGain(30);
    } catch {
      setCodeAnalysis('Analysis interrupted. Check AI model connection in settings.');
    } finally {
      setAnalyzingCode(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="comms-overlay"
          className="nova-comms-overlay"
          style={{ zIndex: Z.pillar + 5 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="nova-comms-window"
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          >
            {/* Header: Gamification & Controls */}
            <div className="nova-comms-header">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="font-display text-sm font-bold tracking-wider text-sky-200">
                    NOVA COMMS · AI STUDY COMPANION
                  </span>
                </div>

                <div
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: `${rank.color}20`,
                    borderColor: `${rank.color}60`,
                    borderWidth: '1px',
                    color: rank.color,
                  }}
                >
                  <Award className="size-3.5" />
                  <span>{rank.badge}</span>
                  <span className="opacity-75">| {rank.name}</span>
                </div>
              </div>

              {/* Player Stats */}
              <div className="flex items-center gap-4 text-xs">
                {/* MMR Counter */}
                <div className="flex items-center gap-1.5 rounded bg-sky-950/70 px-2.5 py-1 ring-1 ring-sky-500/25">
                  <span className="text-slate-400">MMR:</span>
                  <span className="font-bold text-sky-200">{mmr}</span>
                  {recentMmrDelta !== null && (
                    <motion.span
                      initial={{ scale: 0, y: -4 }}
                      animate={{ scale: 1, y: 0 }}
                      className={`text-[11px] font-bold ${
                        recentMmrDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {recentMmrDelta >= 0 ? `+${recentMmrDelta}` : recentMmrDelta}
                    </motion.span>
                  )}
                </div>

                {/* Level & XP */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-amber-300">
                    <Zap className="size-3.5" />
                    <span className="font-bold">LVL {level}</span>
                  </div>
                  <div className="relative h-2 w-20 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-amber-400 transition-all duration-300"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{xpInLevel}/250 XP</span>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-1 text-orange-400">
                  <Flame className="size-3.5" />
                  <span className="font-bold">{streak}</span>
                </div>

                {/* Voice Readout Toggle */}
                <button
                  type="button"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  title={voiceEnabled ? 'Voice Readout Enabled' : 'Voice Readout Disabled'}
                  className={`rounded p-1 transition ${
                    voiceEnabled ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </button>

                {/* Settings */}
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Model & API Settings"
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                >
                  <Settings className="size-4" />
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={closeComms}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Study Mode Navigation Tabs */}
            <div className="nova-tab-bar">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`nova-tab-btn ${activeTab === 'chat' ? 'is-active' : ''}`}
              >
                <MessageSquare className="size-3.5" />
                <span>Tutor Conversation</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quiz')}
                className={`nova-tab-btn ${activeTab === 'quiz' ? 'is-active' : ''}`}
              >
                <CheckCircle2 className="size-3.5" />
                <span>Practice Quiz (MMR +XP)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('codelab')}
                className={`nova-tab-btn ${activeTab === 'codelab' ? 'is-active' : ''}`}
              >
                <Code2 className="size-3.5" />
                <span>Code Lab & Complexity</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`nova-tab-btn ${activeTab === 'notes' ? 'is-active' : ''}`}
              >
                <BookOpen className="size-3.5" />
                <span>Smart Revision Notes</span>
              </button>
            </div>

            {/* Teaching Style Selector (Visible in Chat) */}
            {activeTab === 'chat' && (
              <div className="nova-style-selector">
                <span className="text-slate-400">Teaching Persona:</span>
                <button
                  type="button"
                  onClick={() => setTeachingStyle('socratic')}
                  className={`nova-style-pill ${teachingStyle === 'socratic' ? 'is-active' : ''}`}
                >
                  🏛️ Socratic (Guiding Questions)
                </button>
                <button
                  type="button"
                  onClick={() => setTeachingStyle('eli5')}
                  className={`nova-style-pill ${teachingStyle === 'eli5' ? 'is-active' : ''}`}
                >
                  💡 ELI5 (Analogies)
                </button>
                <button
                  type="button"
                  onClick={() => setTeachingStyle('blitz')}
                  className={`nova-style-pill ${teachingStyle === 'blitz' ? 'is-active' : ''}`}
                >
                  ⚡ Exam Blitz (High-Yield)
                </button>
                <button
                  type="button"
                  onClick={() => setTeachingStyle('deep')}
                  className={`nova-style-pill ${teachingStyle === 'deep' ? 'is-active' : ''}`}
                >
                  🔬 Deep Architecture
                </button>
              </div>
            )}

            {/* Tab 1: Tutor Conversation */}
            {activeTab === 'chat' && (
              <>
                <div ref={feedRef} className="nova-comms-feed">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={m.sender === 'ai' ? 'msg-ai' : m.sender === 'user' ? 'msg-user' : 'msg-system'}
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-sky-400">
                          {m.sender === 'ai' ? '🤖 NOVA' : m.sender === 'user' ? '👤 YOU' : '⚡ SYSTEM'}
                        </span>
                        <div className="flex items-center gap-2">
                          {m.sender === 'ai' && (
                            <button
                              type="button"
                              onClick={() => speakText(m.content)}
                              title="Read Aloud"
                              className="text-slate-400 hover:text-sky-300"
                            >
                              <Volume2 className="size-3" />
                            </button>
                          )}
                          <span>
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="whitespace-pre-wrap">{formatContent(m.content)}</div>

                      {(m.mmrDelta || m.xpDelta) && (
                        <div className="mt-2 flex items-center gap-2 border-t border-sky-500/15 pt-2 text-[11px]">
                          {m.mmrDelta !== undefined && (
                            <span
                              className={`font-mono font-bold ${
                                m.mmrDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {m.mmrDelta >= 0 ? `▲ +${m.mmrDelta} MMR` : `▼ ${m.mmrDelta} MMR`}
                            </span>
                          )}
                          {m.xpDelta !== undefined && (
                            <span className="font-mono text-amber-300">+{m.xpDelta} XP</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="msg-ai flex items-center gap-2 text-sky-300">
                      <Sparkles className="size-4 animate-spin text-sky-400" />
                      <span className="animate-pulse">NOVA is formulating response...</span>
                    </div>
                  )}
                </div>

                {/* Quick Learning Chips */}
                <div className="flex flex-wrap gap-2 border-t border-sky-500/10 bg-slate-950/70 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => handleSend('Can you explain this in simpler terms with a real-world analogy?')}
                    className="nova-chip-btn"
                  >
                    💡 Explain with Analogy (-5 MMR)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend('Challenge me with an advanced follow-up question.')}
                    className="nova-chip-btn"
                  >
                    🔥 Increase Challenge (+20 MMR)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend('Show a clean code implementation for this.')}
                    className="nova-chip-btn"
                  >
                    💻 Code Implementation
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend('What are the real-world production gotchas and edge cases?')}
                    className="nova-chip-btn"
                  >
                    ⚠️ Edge Cases & Gotchas
                  </button>
                </div>

                {/* Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="nova-comms-inputbar"
                >
                  <span className="font-mono text-sm text-sky-400">&gt;</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask NOVA anything or solve the problem to level up..."
                    className="nova-input-field"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="flex items-center gap-1.5 rounded bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                  >
                    <Send className="size-3.5" />
                    <span>SEND</span>
                  </button>
                </form>
              </>
            )}

            {/* Tab 2: Practice Quiz */}
            {activeTab === 'quiz' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="nova-quiz-card max-w-2xl mx-auto">
                  <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                    <span className="text-xs uppercase tracking-wider text-sky-400">
                      Question {currentQuizIndex + 1} of {SAMPLE_QUIZ.length}
                    </span>
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-500/30">
                      +{SAMPLE_QUIZ[currentQuizIndex].mmrReward} MMR on Correct
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-white">
                    {SAMPLE_QUIZ[currentQuizIndex].question}
                  </h3>

                  <div className="space-y-2 mt-2">
                    {SAMPLE_QUIZ[currentQuizIndex].options.map((opt, idx) => {
                      let stateClass = '';
                      if (quizSubmitted) {
                        if (idx === SAMPLE_QUIZ[currentQuizIndex].correctIndex) {
                          stateClass = 'correct';
                        } else if (idx === selectedOption) {
                          stateClass = 'incorrect';
                        }
                      } else if (idx === selectedOption) {
                        stateClass = 'selected';
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => !quizSubmitted && setSelectedOption(idx)}
                          className={`nova-quiz-option ${stateClass}`}
                        >
                          <span className="size-5 rounded border border-white/20 flex items-center justify-center text-xs font-mono">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{opt}</span>
                          {quizSubmitted && idx === SAMPLE_QUIZ[currentQuizIndex].correctIndex && (
                            <CheckCircle2 className="size-4 ml-auto text-emerald-400" />
                          )}
                          {quizSubmitted &&
                            idx === selectedOption &&
                            idx !== SAMPLE_QUIZ[currentQuizIndex].correctIndex && (
                              <XCircle className="size-4 ml-auto text-rose-400" />
                            )}
                        </button>
                      );
                    })}
                  </div>

                  {quizSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 rounded bg-slate-900/90 p-4 border border-sky-500/30 text-xs text-slate-300"
                    >
                      <div className="font-bold text-sky-300 mb-1">
                        {selectedOption === SAMPLE_QUIZ[currentQuizIndex].correctIndex
                          ? '🎉 Correct! Rating calibrated upward.'
                          : '⚠️ Incorrect. Study the concept below:'}
                      </div>
                      <p>{SAMPLE_QUIZ[currentQuizIndex].explanation}</p>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-sky-500/20">
                    <button
                      type="button"
                      onClick={() => handleSend(`Quiz me on: ${SAMPLE_QUIZ[currentQuizIndex].question}`)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      💬 Discuss in Tutor Chat &rarr;
                    </button>

                    {!quizSubmitted ? (
                      <button
                        type="button"
                        disabled={selectedOption === null}
                        onClick={handleQuizSubmit}
                        className="rounded bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-40"
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={nextQuizQuestion}
                        className="flex items-center gap-1 rounded bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
                      >
                        <span>Next Question</span>
                        <Play className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Code Lab */}
            {activeTab === 'codelab' && (
              <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Paste or write code to analyze algorithms & time complexity:</span>
                  <button
                    type="button"
                    onClick={analyzeCodeHandler}
                    disabled={analyzingCode}
                    className="flex items-center gap-1.5 rounded bg-sky-500 px-4 py-1.5 font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    {analyzingCode ? (
                      <Sparkles className="size-3.5 animate-spin" />
                    ) : (
                      <Zap className="size-3.5" />
                    )}
                    <span>Analyze Code & Big-O</span>
                  </button>
                </div>

                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  className="nova-code-editor"
                  placeholder="Paste your TypeScript, Python, or C++ algorithm here..."
                />

                {codeAnalysis && (
                  <div className="rounded border border-sky-500/30 bg-slate-900/95 p-4 text-xs text-slate-200">
                    <div className="font-bold text-sky-300 mb-2 flex items-center gap-2">
                      <Sparkles className="size-4 text-sky-400" />
                      <span>NOVA Code & Complexity Analysis</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{formatContent(codeAnalysis)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Smart Notes */}
            {activeTab === 'notes' && (
              <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-sky-500/20">
                  <h3 className="font-display font-bold text-sky-200 text-sm">
                    Session Key Takeaways & Cheat Sheet
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const userNote = window.prompt('Enter study takeaway to remember:');
                        if (userNote?.trim()) setNotes((prev) => [...prev, userNote.trim()]);
                      }}
                      className="flex items-center gap-1 rounded bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/20"
                    >
                      <span>+ Add Note</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(notes.join('\n\n'));
                        audio.play('click');
                        useNova.getState().notify({
                          kind: 'toast',
                          title: 'Copied Notes to Clipboard',
                          ttl: 2.5,
                        });
                      }}
                      className="flex items-center gap-1 rounded bg-sky-500/10 px-3 py-1 text-xs text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/20"
                    >
                      <Copy className="size-3.5" />
                      <span>Copy All</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {notes.map((note, i) => (
                    <div
                      key={i}
                      className="rounded border border-sky-500/20 bg-slate-900/80 p-3.5 text-xs text-slate-200 flex items-start gap-3"
                    >
                      <span className="size-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 font-bold">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      handleSend('Please synthesize our session into 3 high-yield revision bullet points.');
                      setActiveTab('chat');
                    }}
                    className="nova-chip-btn !px-4 !py-2 !text-xs"
                  >
                    ✨ Ask NOVA to Generate New Revision Bullet Points
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Settings Modal (Choose Any Model) */}
          {showSettings && (
            <SettingsModal
              settings={settings}
              onSave={(newSettings) => {
                setSettings(newSettings);
                saveAISettings(newSettings);
                setShowSettings(false);
                audio.play('chime');
                useNova.getState().notify({
                  kind: 'toast',
                  title: 'AI Model Synchronized',
                  lines: [`Provider: ${newSettings.provider.toUpperCase()}`],
                  ttl: 2.5,
                });
              }}
              onClose={() => setShowSettings(false)}
              onResetProgress={resetProgress}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).trim().split('\n');
      const lang = lines[0].match(/^[a-z]+/i) ? lines.shift() : '';
      const code = lines.join('\n');
      return (
        <div key={index} className="nova-code-block">
          {lang && <div className="mb-1 text-[10px] text-slate-400 uppercase tracking-widest">{lang}</div>}
          <code>{code}</code>
        </div>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface SettingsModalProps {
  settings: AISettings;
  onSave: (s: AISettings) => void;
  onClose: () => void;
  onResetProgress: () => void;
}

function SettingsModal({ settings, onSave, onClose, onResetProgress }: SettingsModalProps) {
  const [provider, setProvider] = useState<AIProvider>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ provider, apiKey, model, baseUrl });
  };

  const setPreset = (preset: 'ollama' | 'gemini' | 'nebius' | 'fastapi' | 'offline') => {
    if (preset === 'ollama') {
      setProvider('openai');
      setBaseUrl('http://localhost:11434/v1');
      setModel('llama3');
      setApiKey('ollama'); // Ollama doesn't require a key, placeholder
    } else if (preset === 'gemini') {
      setProvider('gemini');
      setModel('gemini-2.5-flash');
    } else if (preset === 'nebius') {
      setProvider('nebius');
      setBaseUrl('https://api.studio.nebius.ai/v1');
      setModel('meta-llama/Meta-Llama-3.1-70B-Instruct');
    } else if (preset === 'fastapi') {
      setProvider('openai');
      setBaseUrl('http://localhost:8000/v1');
      setModel('my-custom-model');
    } else if (preset === 'offline') {
      setProvider('offline');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-sky-500/30 bg-slate-900 p-6 shadow-2xl font-mono text-slate-200">
        <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
          <div className="flex items-center gap-2 font-display text-base font-bold text-sky-300">
            <Key className="size-4" />
            <span>AI ENGINE & MODEL SELECTION</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mt-3">
          <label className="mb-1.5 block text-[11px] text-slate-400">Quick Model Presets:</label>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setPreset('ollama')}
              className="rounded bg-sky-950/80 p-1.5 border border-sky-500/30 text-sky-300 hover:bg-sky-900/60"
            >
              🦙 Local Ollama (Mac)
            </button>
            <button
              type="button"
              onClick={() => setPreset('gemini')}
              className="rounded bg-sky-950/80 p-1.5 border border-sky-500/30 text-sky-300 hover:bg-sky-900/60"
            >
              ⚡ Google Gemini
            </button>
            <button
              type="button"
              onClick={() => setPreset('nebius')}
              className="rounded bg-sky-950/80 p-1.5 border border-sky-500/30 text-sky-300 hover:bg-sky-900/60"
            >
              🚀 Nebius AI Studio
            </button>
            <button
              type="button"
              onClick={() => setPreset('fastapi')}
              className="rounded bg-sky-950/80 p-1.5 border border-sky-500/30 text-sky-300 hover:bg-sky-900/60"
            >
              🌐 Custom / FastAPI
            </button>
            <button
              type="button"
              onClick={() => setPreset('offline')}
              className="rounded bg-sky-950/80 p-1.5 border border-sky-500/30 text-sky-300 hover:bg-sky-900/60"
            >
              🧠 Offline Simulator
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block text-slate-400">AI Provider Type</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="w-full rounded border border-sky-500/20 bg-slate-950 p-2 text-white outline-none focus:border-sky-400"
            >
              <option value="gemini">Google Gemini (API Key)</option>
              <option value="nebius">Nebius AI Studio (OpenAI Compatible)</option>
              <option value="openai">OpenAI / Local Ollama / Custom Server</option>
              <option value="offline">Offline Simulated Tutor (Zero Keys Needed)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-slate-400">API Key / Token</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key or token..."
              className="w-full rounded border border-sky-500/20 bg-slate-950 p-2 font-mono text-white outline-none focus:border-sky-400"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Saved strictly in your browser's localStorage. If using local Ollama, any placeholder works.
            </p>
          </div>

          {provider !== 'offline' && provider !== 'gemini' && (
            <div>
              <label className="mb-1 block text-slate-400">Base URL (API Endpoint)</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g. http://localhost:11434/v1 or https://api.your-model.com/v1"
                className="w-full rounded border border-sky-500/20 bg-slate-950 p-2 text-white outline-none focus:border-sky-400"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-slate-400">Model Name</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. llama3, deepseek-coder, gemini-2.5-flash"
              className="w-full rounded border border-sky-500/20 bg-slate-950 p-2 text-white outline-none focus:border-sky-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-sky-500/20">
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset your MMR score and quest progress?')) {
                  onResetProgress();
                  onClose();
                }
              }}
              className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
            >
              <RotateCcw className="size-3" />
              <span>Reset Progress</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-sky-500 px-4 py-1.5 font-bold text-slate-950 hover:bg-sky-400"
              >
                Save Model
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
