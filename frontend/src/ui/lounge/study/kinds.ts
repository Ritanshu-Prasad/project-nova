import { Atom, Braces, FileText, Landmark, Languages, Sigma, Sparkles, type LucideIcon } from 'lucide-react';
import type { TopicKind } from '../../../core/courseSchema';

/** Side-rail widgets a lesson template can show. */
export type RailWidget = 'objectives' | 'terms' | 'formulas' | 'snippets' | 'sources' | 'notes' | 'tip';

export interface KindTemplate {
  label: string;
  icon: LucideIcon;
  tint: string;
  rail: RailWidget[];
  tip: string;
}

/** Lesson layout template per topic kind: the AI only picks the kind, the UI does the rest. */
export const KIND_TEMPLATES: Record<TopicKind, KindTemplate> = {
  concept: { label: 'Concept', icon: Sparkles, tint: '#a78bfa', rail: ['objectives', 'terms', 'notes', 'tip'], tip: 'Explain this to Pixel in one sentence before you take the quiz.' },
  programming: { label: 'Programming', icon: Braces, tint: '#38bdf8', rail: ['objectives', 'snippets', 'terms', 'notes', 'tip'], tip: 'Type the code yourself instead of pasting — your fingers remember.' },
  math: { label: 'Maths', icon: Sigma, tint: '#f59e0b', rail: ['objectives', 'formulas', 'terms', 'notes', 'tip'], tip: 'Rewrite each formula from memory, then check it against the sheet.' },
  science: { label: 'Science', icon: Atom, tint: '#34d399', rail: ['objectives', 'terms', 'notes', 'tip'], tip: 'Sketch the process as a quick diagram in your notes.' },
  humanities: { label: 'Humanities', icon: Landmark, tint: '#f472b6', rail: ['objectives', 'terms', 'notes', 'tip'], tip: 'Tie each idea to a real event, person or example.' },
  language: { label: 'Language', icon: Languages, tint: '#fb7185', rail: ['objectives', 'terms', 'notes', 'tip'], tip: 'Say new words out loud and use them in a sentence.' },
  document: { label: 'From your documents', icon: FileText, tint: '#60a5fa', rail: ['objectives', 'sources', 'terms', 'notes', 'tip'], tip: 'Open the page references in your PDF to read the full context.' },
};
