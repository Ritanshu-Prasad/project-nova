import { create } from 'zustand';
import { audio } from './audio';
import { useNova } from './store';

export interface RankTier {
  name: string;
  minMmr: number;
  color: string;
  badge: string;
  bracket: string;
}

export const RANK_TIERS: readonly RankTier[] = [
  { name: 'Nova Ace', minMmr: 1900, color: '#f59e0b', badge: 'ACE', bracket: 'Tier I' },
  { name: 'Orbital Commander', minMmr: 1600, color: '#ec4899', badge: 'CMD', bracket: 'Tier II' },
  { name: 'Vanguard Specialist', minMmr: 1300, color: '#8b5cf6', badge: 'SPEC', bracket: 'Tier III' },
  { name: 'Flight Cadet', minMmr: 1000, color: '#38bdf8', badge: 'CADET', bracket: 'Tier IV' },
  { name: 'Novice Pilot', minMmr: 0, color: '#94a3b8', badge: 'ROOKIE', bracket: 'Tier V' },
] as const;

export function getRankTier(mmr: number): RankTier {
  return RANK_TIERS.find((t) => mmr >= t.minMmr) || RANK_TIERS[RANK_TIERS.length - 1];
}

export interface Quest {
  id: string;
  title: string;
  category: 'Algorithm' | 'System Architecture' | 'Cognitive Load' | 'Neural Logic';
  difficulty: 'Novice' | 'Adept' | 'Master' | 'Apex';
  description: string;
  initialPrompt: string;
  rewardXp: number;
  rewardMmr: number;
}

export const QUESTS: readonly Quest[] = [
  {
    id: 'q1',
    title: 'Diagnostic Placement: Search Mechanics',
    category: 'Algorithm',
    difficulty: 'Novice',
    description: 'Diagnose algorithmic fundamentals: Binary Search Tree lookup vs linear search.',
    initialPrompt: 'Pilot, initiating neural diagnostic. Compare the average and worst-case time complexity of searching in a Binary Search Tree (BST) versus an array. How would you prevent BST degeneration?',
    rewardXp: 120,
    rewardMmr: 25,
  },
  {
    id: 'q2',
    title: 'Cognitive Calibration: Concurrency & Async',
    category: 'System Architecture',
    difficulty: 'Adept',
    description: 'Explain JavaScript event loop mechanics and microtasks vs macrotasks.',
    initialPrompt: 'Systems online. Explain how microtasks (e.g. Promises) and macrotasks (e.g. setTimeout) behave in the event loop when high-frequency telemetry updates arrive at 60 FPS.',
    rewardXp: 180,
    rewardMmr: 35,
  },
  {
    id: 'q3',
    title: 'Deep Space Memory: Space Complexity & Cache',
    category: 'Neural Logic',
    difficulty: 'Master',
    description: 'Optimize spatial memory locality and LRU cache eviction.',
    initialPrompt: 'Our ship navigation cache has limited registers. Explain the optimal data structure combination for an O(1) LRU (Least Recently Used) cache, and justify your choice.',
    rewardXp: 250,
    rewardMmr: 45,
  },
];

interface GamificationState {
  callsign: string;
  mmr: number;
  xp: number;
  streak: number;
  completedQuests: string[];
  activeQuestId: string;
  recentMmrDelta: number | null;

  setCallsign: (name: string) => void;
  recordMmrChange: (delta: number) => void;
  recordXpGain: (amount: number) => void;
  setActiveQuest: (id: string) => void;
  completeQuest: (id: string) => void;
  resetProgress: () => void;
}

const STORAGE_KEY = 'nova.pilot_gamification';

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fallback to default */
  }
  return {
    callsign: 'PILOT-07',
    mmr: 1200,
    xp: 60,
    streak: 1,
    completedQuests: [] as string[],
    activeQuestId: 'q1',
  };
}

export const useGamification = create<GamificationState>()((set, get) => {
  const initial = loadSavedState();

  const persist = (partial: Partial<GamificationState>) => {
    try {
      const state = { ...get(), ...partial };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          callsign: state.callsign,
          mmr: state.mmr,
          xp: state.xp,
          streak: state.streak,
          completedQuests: state.completedQuests,
          activeQuestId: state.activeQuestId,
        })
      );
    } catch {
      /* storage unavailable */
    }
  };

  return {
    callsign: initial.callsign,
    mmr: initial.mmr,
    xp: initial.xp,
    streak: initial.streak,
    completedQuests: initial.completedQuests,
    activeQuestId: initial.activeQuestId,
    recentMmrDelta: null,

    setCallsign: (callsign) => {
      set({ callsign });
      persist({ callsign });
    },

    recordMmrChange: (delta) => {
      const prev = get().mmr;
      const next = Math.max(100, Math.min(3000, prev + delta));
      set({ mmr: next, recentMmrDelta: delta });
      persist({ mmr: next });

      // Audio feedback
      if (delta > 0) {
        audio.play('chime');
        useNova.getState().notify({
          kind: 'levelup',
          title: `MMR Adjusted (+${delta})`,
          lines: [`Current Rating: ${next} MMR`, getRankTier(next).name],
          ttl: 3.5,
        });
      } else if (delta < 0) {
        audio.play('denied');
        useNova.getState().notify({
          kind: 'system',
          title: `Difficulty Re-aligned (${delta})`,
          lines: [`MMR Calibrated to ${next}`],
          ttl: 3.0,
        });
      }

      setTimeout(() => set({ recentMmrDelta: null }), 3000);
    },

    recordXpGain: (amount) => {
      const prevXp = get().xp;
      const nextXp = prevXp + amount;
      const prevLevel = Math.floor(prevXp / 250) + 1;
      const nextLevel = Math.floor(nextXp / 250) + 1;

      set({ xp: nextXp });
      persist({ xp: nextXp });

      if (nextLevel > prevLevel) {
        audio.play('powerUp');
        useNova.getState().notify({
          kind: 'quest',
          title: `LEVEL UP! LEVEL ${nextLevel}`,
          lines: ['Neural capacity expanded', `Rank: ${getRankTier(get().mmr).name}`],
          ttl: 4.5,
        });
      }
    },

    setActiveQuest: (id) => {
      set({ activeQuestId: id });
      persist({ activeQuestId: id });
      audio.play('quest');
    },

    completeQuest: (id) => {
      const quest = QUESTS.find((q) => q.id === id);
      const completed = Array.from(new Set([...get().completedQuests, id]));
      set({ completedQuests: completed });
      persist({ completedQuests: completed });

      if (quest) {
        get().recordMmrChange(quest.rewardMmr);
        get().recordXpGain(quest.rewardXp);
      }
    },

    resetProgress: () => {
      const resetData = {
        callsign: 'PILOT-07',
        mmr: 1200,
        xp: 0,
        streak: 0,
        completedQuests: [],
        activeQuestId: 'q1',
      };
      set(resetData);
      persist(resetData);
    },
  };
});
