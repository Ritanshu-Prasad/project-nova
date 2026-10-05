/**
 * MMR ranks on a spaceship scale — Iron → Bronze → Silver → Gold → Platinum → Diamond → Master.
 * Every tier below Master has three divisions (III → II → I), so progress is felt every few answers.
 */
export interface Tier {
  id: string;
  name: string;
  /** Classic ladder equivalent, for players who think in metals. */
  metal: string;
  /** MMR needed to enter the tier. */
  min: number;
  color: string;
  blurb: string;
}

export const TIERS: readonly Tier[] = [
  { id: 'probe', name: 'Probe', metal: 'Iron', min: 0, color: '#a1a8b3', blurb: 'Unmanned and curious — every pilot starts here.' },
  { id: 'shuttle', name: 'Shuttle', metal: 'Bronze', min: 1150, color: '#d4895a', blurb: 'Short hops between ideas you already know.' },
  { id: 'corvette', name: 'Corvette', metal: 'Silver', min: 1300, color: '#d5dee9', blurb: 'Quick and nimble on the fundamentals.' },
  { id: 'frigate', name: 'Frigate', metal: 'Gold', min: 1450, color: '#facc15', blurb: 'Steady under pressure, even on harder planets.' },
  { id: 'cruiser', name: 'Cruiser', metal: 'Platinum', min: 1600, color: '#5eead4', blurb: 'Long range — you connect ideas across modules.' },
  { id: 'dreadnought', name: 'Dreadnought', metal: 'Diamond', min: 1750, color: '#8b9cff', blurb: 'Hard questions don’t slow you down.' },
  { id: 'master', name: 'Master', metal: 'Master', min: 1900, color: '#f472b6', blurb: 'Command of the fleet — the top of the ladder.' },
];

/** Probe's divisions start here (anything lower is still Probe III). */
const FLOOR = 1000;
const DIVISIONS = ['III', 'II', 'I'] as const;

export interface Rank {
  tier: Tier;
  /** Index into TIERS. */
  index: number;
  division: (typeof DIVISIONS)[number] | null;
  label: string;
  /** Ordinal across the whole ladder (tier × 3 + division) — compare to detect promotions. */
  step: number;
  /** 0–1 through the current division. */
  progress: number;
  /** MMR still needed for the next division. */
  toNext: number;
  nextLabel: string | null;
}

export function rankOf(mmr: number): Rank {
  let index = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (mmr >= TIERS[i].min) {
      index = i;
      break;
    }
  }
  const tier = TIERS[index];
  const next = TIERS[index + 1];
  if (!next) return { tier, index, division: null, label: tier.name, step: index * 3, progress: 1, toNext: 0, nextLabel: null };
  const lo = index === 0 ? FLOOR : tier.min;
  const span = (next.min - lo) / 3;
  const d = Math.max(0, Math.min(2, Math.floor((mmr - lo) / span)));
  const divLo = lo + d * span;
  return {
    tier,
    index,
    division: DIVISIONS[d],
    label: `${tier.name} ${DIVISIONS[d]}`,
    step: index * 3 + d,
    progress: Math.max(0, Math.min(1, (mmr - divLo) / span)),
    toNext: Math.max(1, Math.ceil(divLo + span - mmr)),
    nextLabel: d < 2 ? `${tier.name} ${DIVISIONS[d + 1]}` : next.id === 'master' ? next.name : `${next.name} III`,
  };
}
