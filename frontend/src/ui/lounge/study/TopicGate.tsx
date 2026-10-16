import { Loader2, RotateCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { PlacedTopic } from '../../../core/courseSchema';
import { ensureTopic, prefetchNextTopic } from '../../../core/topicLoader';
import Btn from './Btn';
import { TYPE } from './typography';

/** Shows a topic once its lesson has been written; an outline-only topic is fetched on arrival, and the next one is prefetched. */
export default function TopicGate({ courseId, topic, children }: { courseId: string; topic: PlacedTopic; children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loaded = topic.loaded !== false;

  useEffect(() => {
    if (loaded) return prefetchNextTopic(courseId, topic.id);
    ensureTopic(courseId, topic.id).catch(() => setFailed(true));
  }, [courseId, topic.id, loaded, attempt]);

  if (loaded) return <>{children}</>;

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center font-sans">
      <h1 className={TYPE.heading}>{topic.title}</h1>
      {failed ? (
        <>
          <p className={TYPE.body}>NOVA could not write this lesson. Check your connection and try again.</p>
          <Btn variant="primary" icon={<RotateCw size={14} />} onClick={() => (setFailed(false), setAttempt((n) => n + 1))}>
            Try again
          </Btn>
        </>
      ) : (
        <p className={`flex items-center gap-2 ${TYPE.body}`}>
          <Loader2 size={16} className="animate-spin" /> Writing this lesson…
        </p>
      )}
    </div>
  );
}
