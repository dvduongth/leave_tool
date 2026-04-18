/**
 * Centralized constants for business rules.
 * Keep these in one place so policy changes don't require hunting through code.
 */

// --- Leave policy ---
/** Base annual leave in hours (12 days × 8h). */
export const BASE_ANNUAL_LEAVE_HOURS = 96;

/** Hours credited per completed "seniority tier". 1 day = 8h. */
export const SENIORITY_BONUS_HOURS_PER_TIER = 8;

/** One bonus tier is granted every N years of service. */
export const SENIORITY_YEARS_PER_TIER = 5;

/** Alert threshold: warn user when remaining balance drops below this (hours). */
export const LOW_BALANCE_THRESHOLD_HOURS = 16;

/** Grace period in months: old cycle remains usable after cycleEnd. */
export const GRACE_PERIOD_MONTHS = 2;

/** Leave cycle starts on June 1st each year. */
export const CYCLE_START_MONTH = 6; // June (1-indexed)
export const CYCLE_START_DAY = 1;

// --- OT policy ---
/** Alert threshold: warn on dashboard when monthly OT exceeds this (hours). */
export const HIGH_OT_THRESHOLD_HOURS = 20;

// --- Working hours ---
export const STANDARD_LUNCH_START = "12:00";
export const STANDARD_LUNCH_END = "13:00";

// --- Translation ---
/** DeepL free tier accepts up to 50 texts per call; we use 40 for safety. */
export const TRANSLATE_BATCH_SIZE = 40;
