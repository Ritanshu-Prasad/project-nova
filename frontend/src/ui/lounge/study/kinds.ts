import { Atom, Braces, FileText, Landmark, Languages, Sigma, Sparkles, type LucideIcon } from 'lucide-react';
import type { TopicKind } from '../../../core/courseSchema';

export interface KindTemplate {
  label: string;
  icon: LucideIcon;
  tint: string;
  tip: string;
}

/** Only these kinds say something the learner cannot already see; a plain concept topic shows no badge. */
export const BADGE_KINDS: TopicKind[] = ['programming', 'document'];

/** Lesson layout template per topic kind: the AI only picks the kind, the UI does the rest. */
export const KIND_TEMPLATES: Record<TopicKind, KindTemplate> = {
  concept: { label: 'Concept', icon: Sparkles, tint: '#a78bfa', tip: 'Explain this to Pixel in one sentence before you take the quiz.' },
  programming: { label: 'Programming', icon: Braces, tint: '#38bdf8', tip: 'Type the code yourself instead of pasting — your fingers remember.' },
  math: { label: 'Maths', icon: Sigma, tint: '#f59e0b', tip: 'Rewrite each formula from memory, then check it against the sheet.' },
  science: { label: 'Science', icon: Atom, tint: '#34d399', tip: 'Sketch the process as a quick diagram in your notes.' },
  humanities: { label: 'Humanities', icon: Landmark, tint: '#f472b6', tip: 'Tie each idea to a real event, person or example.' },
  language: { label: 'Language', icon: Languages, tint: '#fb7185', tip: 'Say new words out loud and use them in a sentence.' },
  document: { label: 'From your documents', icon: FileText, tint: '#60a5fa', tip: 'Open the page references in your PDF to read the full context.' },
};
