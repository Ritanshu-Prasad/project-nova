import { describe, expect, it } from 'vitest';
import { useAccount } from './account';
import { useCourse, type LibraryEntry } from './course';
import { pilotId, totalLibraryXp } from './fleet';
import { useProfile } from './hub';

describe('fleet client', () => {
  it('pilotId is deterministic for authenticated Google user and callsign', () => {
    useAccount.setState({ user: { sub: 'google-uid-999', email: 'pilot@example.com', name: 'Pilot', picture: '' } });
    const id1 = pilotId();
    expect(id1).toMatch(/^[a-f0-9]{32}$/);

    // Another call returns identical id
    const id2 = pilotId();
    expect(id2).toBe(id1);

    // Reset account, switch to callsign
    useAccount.setState({ user: null });
    useProfile.setState({ callsign: 'Ritanshu' });
    const idCallsign1 = pilotId();
    expect(idCallsign1).toMatch(/^[a-f0-9]{32}$/);

    useProfile.setState({ callsign: 'ritanshu' }); // case-insensitive
    const idCallsign2 = pilotId();
    expect(idCallsign2).toBe(idCallsign1);
  });

  it('totalLibraryXp aggregates completed topics, passed modules, and quizzes across all courses', () => {
    const course1: Partial<LibraryEntry> = {
      progress: {
        'c1-t1': { cleared: true, notes: '' },
        'c1-t2': { cleared: true, notes: '' },
      },
      modules: {
        'c1-m1': { passed: true, best: 1, attempts: 1 },
      },
      skill: {
        mmr: 1200,
        history: [],
        correct: 4,
        answered: 5, // 4 correct * 30 + 1 wrong * 5 = 125
      },
    };

    const course2: Partial<LibraryEntry> = {
      progress: {
        'c2-t1': { cleared: true, notes: '' },
      },
      modules: {
        'c2-m1': { passed: true, best: 1, attempts: 1 },
      },
      skill: {
        mmr: 1300,
        history: [],
        correct: 2,
        answered: 2, // 2 correct * 30 = 60
      },
    };

    useCourse.setState({
      stats: { xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: '2026-10-24', dayQuizzes: 0 },
      library: {
        c1: course1 as LibraryEntry,
        c2: course2 as LibraryEntry,
      },
    });

    // Course 1: (2 topics * 30) + (1 module * 80) + (4 * 30 + 1 * 5) = 60 + 80 + 125 = 265
    // Course 2: (1 topic * 30) + (1 module * 80) + (2 * 30) = 30 + 80 + 60 = 170
    // Total sum = 265 + 170 = 435 XP
    expect(totalLibraryXp()).toBe(435);
  });
});
