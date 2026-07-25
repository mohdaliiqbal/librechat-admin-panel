/**
 * Server functions for the admin Usage/consumption view.
 *
 * Proxies the LibreChat Admin API (GET /api/admin/usage/summary), which
 * aggregates the transactions ledger into spend by user, by model, and per day.
 */

import { z } from 'zod';
import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { SystemCapabilities } from '@librechat/data-schemas/capabilities';
import type * as t from '@/types';
import { requireCapability } from './capabilities';
import { apiFetch, extractApiError } from './utils/api';

export const getUsageSummaryFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ from: z.string().optional(), to: z.string().optional() }))
  .handler(async ({ data }): Promise<t.UsageSummary> => {
    await requireCapability(SystemCapabilities.READ_USERS);
    const params = new URLSearchParams();
    if (data.from) {
      params.set('from', data.from);
    }
    if (data.to) {
      params.set('to', data.to);
    }
    const qs = params.toString();
    const response = await apiFetch(`/api/admin/usage/summary${qs ? `?${qs}` : ''}`);
    if (!response.ok) {
      await extractApiError(response, 'Failed to fetch usage summary');
    }
    return (await response.json()) as t.UsageSummary;
  });

export const usageSummaryQueryOptions = (range: t.UsageRange = {}) =>
  queryOptions({
    queryKey: ['usageSummary', range.from ?? null, range.to ?? null],
    queryFn: () => getUsageSummaryFn({ data: range }),
    staleTime: 30_000,
  });
