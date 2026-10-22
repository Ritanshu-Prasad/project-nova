import { Flag } from 'lucide-react';
import { useState } from 'react';
import { reportQuestion, type ReportReason } from '../../../core/courseApi';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'wrong_answer', label: 'The marked answer is wrong' },
  { id: 'unclear', label: 'The question is unclear' },
  { id: 'wrong_type', label: 'It is the wrong kind of question' },
  { id: 'off_topic', label: 'It is not about the lesson' },
];

type Phase = 'closed' | 'choosing' | 'sent' | 'error';

/** A small way to tell us a question is wrong; it sends the question's text and the reason, and nothing about the learner. */
export default function ReportQuestion({ question }: { question: string }) {
  const [phase, setPhase] = useState<Phase>('closed');

  const send = (reason: ReportReason) => {
    setPhase('sent');
    reportQuestion(question, reason).catch(() => setPhase('error'));
  };

  if (phase === 'sent') return <p className="text-xs text-emerald-200">Thanks, we will look at this question.</p>;
  if (phase === 'choosing')
    return (
      <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label="What is wrong with this question?">
        {REASONS.map((reason) => (
          <button key={reason.id} type="button" onClick={() => send(reason.id)} className="cursor-pointer rounded-full border border-white/15 px-3 py-1 text-white/70 transition hover:border-[var(--user)] hover:text-white">
            {reason.label}
          </button>
        ))}
      </div>
    );
  return (
    <button type="button" onClick={() => setPhase('choosing')} className="flex cursor-pointer items-center gap-1.5 text-xs text-white/45 transition hover:text-white/80">
      <Flag size={12} /> {phase === 'error' ? 'Could not send, try again' : 'Report this question'}
    </button>
  );
}
