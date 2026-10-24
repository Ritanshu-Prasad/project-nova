/** Next state of a show/hide-answer toggle. */
export const toggleReveal = (open: boolean) => !open;

/** The label the toggle button shows for the current state. */
export const revealLabel = (open: boolean) => (open ? 'Hide answer' : 'Show answer');
