/** Shared product constants (host-owned). */

/** Optional proof photos expire after this many days (or next cycle). */
export const PROOF_PHOTO_TTL_DAYS = 7;

/** Max template tree depth (root → … → leaf). */
export const MAX_TREE_DEPTH = 3;

/** Default leaf estimate when unspecified. */
export const DEFAULT_LEAF_MINUTES = 10;

/** Periodic tasks re-raise on this cadence unless customized. */
export const DEFAULT_PERIODIC_INTERVAL = 4;
export const DEFAULT_PERIODIC_UNIT = "week" as const;

/** Default reward points on a new template. */
export const DEFAULT_TASK_POINTS = 1;

/**
 * Household calendar timezone for Sunday-night points reset.
 * Override via `household_meta.timezone` in Supabase.
 */
export const DEFAULT_HOUSEHOLD_TIMEZONE = "Europe/London";

/** Singleton row id for `household_meta`. */
export const HOUSEHOLD_META_ID = "default";

/**
 * Soft mid-tone hex colours for household identity tinting.
 * Assigned in order when a person has no stored colour yet.
 */
export const DEFAULT_PERSON_COLORS = [
  "#3d8b6e",
  "#c46b3a",
  "#3a7ca5",
  "#b85c7a",
  "#8a7a3d",
  "#2e8b8b",
  "#c49a3a",
  "#6d7f9c",
] as const;
