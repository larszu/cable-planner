/** Grid size in px — must match snapGrid in App.tsx and Background gap.
 *  Lives in its own module so utility files (snapUtils, etc.) can import it
 *  without pulling in the full store, which would create a circular import
 *  the moment the store wants to call back into those utilities. */
export const GRID_SIZE = 20;
