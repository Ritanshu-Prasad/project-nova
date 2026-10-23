import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Brain, Check, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { audio } from '../../core/audio';
import {
  askInterviewTurn,
  requestBlueprint,
  finalizeBlueprintCourse,
  type BlueprintModule,
  type BlueprintOutline,
  type InterviewResponse,
  type InterviewTurn,
} from '../../core/courseApi';
import type { Course, Level } from '../../core/courseSchema';
import { HudButton } from '../common/HudButton';

interface KnowledgeCheckProps {
  objective: string;
  level: Level;
  onCourseReady: (course: Course) => void;
  onSkipToStandard: () => void;
  onBack: () => void;
}

const FALLBACK_TURNS: { question: string; suggestions: string[] }[] = [
  {
    question: 'What is your current background with this subject?',
    suggestions: ['Complete beginner from scratch', 'I know the basics & syntax', 'Experienced developer / engineer'],
  },
  {
    question: 'What practical outcome or project do you want to build by the end?',
    suggestions: ['Build a real-world working project', 'Master the core concepts for work', 'Prepare for technical interviews'],
  },
  {
    question: 'What learning format fits your style best?',
    suggestions: ['Hands-on code examples', 'Conceptual analogies & diagrams', 'In-depth theory & formulas'],
  },
];

export default function KnowledgeCheck({
  objective,
  level,
  onCourseReady,
  onSkipToStandard,
  onBack,
}: KnowledgeCheckProps) {
  const [turn, setTurn] = useState(1);
  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [blueprint, setBlueprint] = useState<BlueprintOutline | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch the first diagnostic question on mount
  useEffect(() => {
    let cancelled = false;
    async function loadFirstTurn() {
      setLoading(true);
      try {
        const res = await askInterviewTurn(objective, level, []);
        if (!cancelled) {
          setCurrentQuestion(res.question);
          setSuggestions(res.suggestions || []);
          setSummary(res.summarySoFar || '');
        }
      } catch (err) {
        console.warn('Knowledge check API unavailable, using friendly fallback:', err);
        if (!cancelled) {
          const fallback = FALLBACK_TURNS[0];
          setCurrentQuestion(fallback.question);
          setSuggestions(fallback.suggestions);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFirstTurn();
    return () => {
      cancelled = true;
    };
  }, [objective, level]);

  const handleAnswer = async (answerText: string) => {
    const text = answerText.trim();
    if (!text || loading) return;

    audio.play('click');
    const newHistory: InterviewTurn[] = [
      ...history,
      { role: 'assistant', content: currentQuestion },
      { role: 'user', content: text },
    ];
    setHistory(newHistory);
    setUserInput('');

    // If we've reached turn 3 or the final step, proceed to build the tailored blueprint
    if (turn >= 3) {
      await generateAndFinalize(newHistory, `${summary}\nUser background & goals: ${text}`);
      return;
    }

    setLoading(true);
    const nextTurnIndex = turn + 1;
    setTurn(nextTurnIndex);

    try {
      const res: InterviewResponse = await askInterviewTurn(objective, level, newHistory);
      setCurrentQuestion(res.question);
      setSuggestions(res.suggestions || []);
      setSummary(res.summarySoFar || summary);
      if (res.readyForBlueprint) {
        await generateAndFinalize(newHistory, res.summarySoFar || summary);
      }
    } catch (err) {
      console.warn('Next turn API failed, using fallback:', err);
      const fallback = FALLBACK_TURNS[nextTurnIndex - 1] || FALLBACK_TURNS[2];
      setCurrentQuestion(fallback.question);
      setSuggestions(fallback.suggestions);
    } finally {
      setLoading(false);
    }
  };

  const generateAndFinalize = async (interviewHistory: InterviewTurn[], finalSummary: string) => {
    setFinalizing(true);
    setStatusMessage('Designing your personalized learning route…');
    try {
      // Step 1: Request tailored blueprint outline
      const bp = await requestBlueprint(objective, level, finalSummary);
      setBlueprint(bp);
      setStatusMessage('Forging modules and planet quizzes…');

      // Step 2: Finalize into live course schema
      const course = await finalizeBlueprintCourse({
        objective,
        level,
        title: bp.title,
        subtitle: bp.subtitle,
        modules: bp.modules,
      });

      onCourseReady(course);
    } catch (err) {
      console.warn('Tailored blueprint failed, falling back to standard generator:', err);
      // Fallback: if blueprint service had an error, seamlessly fall back to standard course generation
      onSkipToStandard();
    }
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-lg"
            style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}
          >
            <Brain size={18} />
          </span>
          <div>
            <div className="chip-label">Personalize</div>
            <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Tailor your journey</h2>
          </div>
        </div>
        <div className="text-xs font-medium text-white/50">
          Step {turn} of 3
        </div>
      </div>

      <p className="mt-2 text-sm text-white/60">
        A quick 3-step check so NOVA skips what you already master and focuses on your goals.
      </p>

      {/* Progress pill indicator */}
      <div className="mt-4 flex gap-1.5">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{
              background:
                step <= turn
                  ? 'var(--user)'
                  : 'rgba(255, 255, 255, 0.1)',
            }}
          />
        ))}
      </div>

      {finalizing ? (
        <div className="my-10 flex flex-col items-center justify-center py-6 text-center">
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--user)' }} />
          <h3 className="mt-4 font-display text-lg font-semibold text-white">{statusMessage}</h3>
          <p className="mt-1 text-xs text-white/50">Personalizing modules based on your answers…</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {/* Question Box */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 shadow-inner">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} />
              <div className="min-h-[44px]">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Loader2 size={16} className="animate-spin" /> Thinking of the best diagnostic check…
                  </div>
                ) : (
                  <p className="text-[15px] font-medium leading-relaxed text-white">{currentQuestion}</p>
                )}
              </div>
            </div>

            {/* Quick Answer Suggestion Chips */}
            {!loading && suggestions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/[0.07]">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Quick options (click to select)
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswer(sug)}
                      className="cursor-pointer rounded-xl bg-white/[0.06] px-3 py-2 text-left text-xs font-medium text-white/85 ring-1 ring-white/10 transition hover:bg-[rgb(var(--user-rgb)/0.15)] hover:text-white hover:ring-[var(--user)]"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom Answer Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAnswer(userInput);
                }
              }}
              disabled={loading}
              placeholder="Or type a custom answer here…"
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--user)]"
            />
            <HudButton
              variant="primary"
              size="md"
              disabled={!userInput.trim() || loading}
              onClick={() => handleAnswer(userInput)}
              icon={turn === 3 ? <Check size={16} /> : <ArrowRight size={16} />}
            >
              {turn === 3 ? 'Finish & Build' : 'Next'}
            </HudButton>
          </div>

          {/* Navigation Controls */}
          <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1.5 text-white/50 transition hover:text-white"
            >
              <ArrowLeft size={14} /> Back to goal
            </button>
            <button
              type="button"
              onClick={onSkipToStandard}
              disabled={loading}
              className="cursor-pointer text-white/40 underline-offset-4 transition hover:text-white hover:underline"
            >
              Skip check & generate generic course
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
