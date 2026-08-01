/**
 * Types for the admin Usage/consumption view.
 * Mirror the shape returned by LibreChat `GET /api/admin/usage/summary`.
 */

export interface UsageTotals {
  /** Total spend over the range, in USD. */
  spendUsd: number;
  /** Total prompt+completion tokens over the range. */
  tokens: number;
  /** Distinct assistant messages billed over the range. */
  messages: number;
  /** Users with any spend over the range. */
  activeUsers: number;
}

export interface UsageByUser {
  userId: string;
  name: string;
  email: string;
  spendUsd: number;
  tokens: number;
  messages: number;
}

export interface UsageByModel {
  model: string;
  spendUsd: number;
  tokens: number;
  /** Fraction of total spend (0–1). */
  share: number;
}

export interface UsageTimePoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  spendUsd: number;
}

/** A configured model price from LibreChat's `tokenValues` registry (USD per 1M tokens). */
export interface ModelPricing {
  model: string;
  promptUsdPer1M: number;
  completionUsdPer1M: number;
}

/** One day of activity for the contribution heatmap. */
export interface UsageActivityDay {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  tokens: number;
  /** Dominant model (by tokens) that day. */
  model: string;
}

export interface UsageActivityTotals {
  lifetimeTokens: number;
  peakDayTokens: number;
  activeDays: number;
}

export interface UsageSummary {
  range: { from: string; to: string };
  currency: string;
  totals: UsageTotals;
  byUser: UsageByUser[];
  byModel: UsageByModel[];
  timeseries: UsageTimePoint[];
  modelPricing: ModelPricing[];
  /** Per-day activity over the last ~365 days (for the heatmap). */
  activity?: UsageActivityDay[];
  activityTotals?: UsageActivityTotals;
}

export interface UsageRange {
  from?: string;
  to?: string;
}
