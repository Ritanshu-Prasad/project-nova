import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { audio } from './audio';
import { popPool, useCourse, type RatedQuestion } from './course';
import { buildQuiz } from './quizBuilder';
import { useHub, type Station } from './hub';

/**
 * Surprise pop quizzes. One can arrive at any random moment while the pilot is aboard (lounge or mid-lesson,
 * never during another quiz). The pilot may take it right away or put it off: taking it before the bonus
 * window closes pays ×1.75 MMR on correct answers; after that it is still there, at the normal rate.
 * Pilots can also start a practice round from the lounge at any time (normal rate). Each round is a fresh
 * random draw of 5–10 mixed-format questions (see core/quizBuilder.ts).
 */
export const POP = {
  bonus: 1.75,
  /** How long the ×1.75 bonus lasts after the quiz arrives. */
  windowMs: 4 * 60_000,
  /** Random gap before the first surprise of a session, and between surprises. */
  firstDelay: [70_000, 160_000],
  gap: [4 * 60_000, 9 * 60_000],
} as const;

export interface PopOffer {
  courseId: string;
  arrivedAt: number;
  deadline: number;
  /** The pilot has seen the arrival alert (and chose "Later" or let it slide away). */
  seen: boolean;
}

export interface PopRun {
  questions: RatedQuestion[];
  /** Seconds per question (null = untimed). */
  limits: (number | null)[];
  multiplier: number;
  /** Came from a surprise offer (vs. a practice round). */
  surprise: boolean;
}

interface PopState {
  offer: PopOffer | null;
  run: PopRun | null;
  /** When the next surprise may arrive (epoch ms). */
  nextAt: number;
  /** Where to send the pilot after the quiz. */
  returnTo: Station;
  arrive: (courseId: string) => void;
  defer: () => void;
  /** Builds a round: with a live offer inside its window → bonus; otherwise a practice round. */
  begin: () => PopRun | null;
  end: () => void;
}

const LS = 'nova.pop.v1';
const rand = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);

const loadOffer = (): PopOffer | null => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? 'null') as PopOffer | null;
  } catch {
    return null;
  }
};

export const usePop = create<PopState>()((set, get) => ({
  offer: loadOffer(),
  run: null,
  nextAt: Date.now() + rand(POP.firstDelay),
  returnTo: 'hub',

  arrive: (courseId) => {
    const now = Date.now();
    set({ offer: { courseId, arrivedAt: now, deadline: now + POP.windowMs, seen: false } });
  },

  defer: () => {
    const o = get().offer;
    if (o) set({ offer: { ...o, seen: true } });
  },

  begin: () => {
    const c = useCourse.getState();
    const e = c.activeId ? c.library[c.activeId] : undefined;
    if (!e) return null;
    const pool = popPool(e);
    if (!pool.length) return null;
    const o = get().offer;
    const live = !!o && o.courseId === e.course.id;
    const quiz = buildQuiz(pool);
    const run: PopRun = { questions: quiz.questions, limits: quiz.limits, multiplier: o && live && Date.now() <= o.deadline ? POP.bonus : 1, surprise: live };
    // Starting consumes the offer — no restarting for a second bonus.
    set({ run, offer: live ? null : o });
    return run;
  },

  end: () => set({ run: null, nextAt: Date.now() + rand(POP.gap) }),
}));

usePop.subscribe((s, prev) => {
  if (s.offer === prev.offer) return;
  try {
    localStorage.setItem(LS, JSON.stringify(s.offer));
  } catch {
    /* ignore */
  }
});

/** Seconds left in the bonus window (0 when it has closed). */
export const bonusLeft = (o: PopOffer | null, now = Date.now()) => (o ? Math.max(0, Math.ceil((o.deadline - now) / 1000)) : 0);
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Seconds left in an offer's bonus window, ticking once a second. */
export function useBonusClock(offer: PopOffer | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!offer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [offer]);
  return bonusLeft(offer, now);
}

/** Take the waiting pop quiz (from the arrival alert, the pill or the dock). */
export function takePopQuiz() {
  const from = useHub.getState().station;
  usePop.setState({ returnTo: from === 'lesson' ? 'lesson' : 'hub' });
  usePop.getState().defer();
  audio.play('click');
  useHub.getState().go('quiz');
}

