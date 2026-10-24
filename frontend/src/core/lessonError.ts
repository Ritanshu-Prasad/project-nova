const CONNECTION = 'NOVA could not write this lesson. Check your connection and try again.';
const MODEL_UNAVAILABLE = "NOVA couldn't write this lesson this time. Try again.";

/** What to tell the learner when a lesson cannot be written: a 502 or 503 means the model failed, anything else is taken as the connection. */
export function lessonFailureMessage(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 502 || status === 503 ? MODEL_UNAVAILABLE : CONNECTION;
}
