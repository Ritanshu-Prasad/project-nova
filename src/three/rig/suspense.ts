/**
 * Number of module subtrees currently suspended (loading textures, fonts, …).
 * Incremented by the <Guard> fallback while it is mounted; the boot sequence waits for zero.
 */
export const suspense = { pending: 0 };
