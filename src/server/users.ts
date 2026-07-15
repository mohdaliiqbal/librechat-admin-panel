/**
 * Server functions for user management.
 *
 * Calls the LibreChat Admin API (/api/admin/users) for list, search, and delete.
 * Create user is not yet wired.
 */

import { z } from 'zod';
import { queryOptions } from '@tanstack/react-query';
import { SystemRoles } from 'librechat-data-provider';
import { createServerFn } from '@tanstack/react-start';
import { SystemCapabilities } from '@librechat/data-schemas/capabilities';
import type { AdminUserSearchResult } from '@librechat/data-schemas';
import type { TUser } from 'librechat-data-provider';
import type * as t from '@/types';
import { requireCapability } from './capabilities';
import { apiFetch, extractApiError } from './utils/api';

// ── Server functions ─────────────────────────────────────────────────

export const getUsersFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ users: TUser[] }> => {
    const response = await apiFetch('/api/admin/users');
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }
    const json = (await response.json()) as { users: TUser[] };
    return { users: json.users ?? [] };
  },
);

export const usersQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: () => getUsersFn().then((r) => r.users),
  staleTime: 30_000,
});

export const createUserFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.nativeEnum(SystemRoles),
    }),
  )
  .handler(async (): Promise<{ user: TUser }> => {
    throw new Error('Not implemented: createUserFn');
  });

export const deleteUserFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(data.id)}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete user: ${response.status}`);
    }
  });

export const searchUsersFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ query: z.string() }))
  .handler(async ({ data }): Promise<{ users: AdminUserSearchResult[] }> => {
    const response = await apiFetch(`/api/admin/users/search?q=${encodeURIComponent(data.query)}`);
    if (!response.ok) {
      await extractApiError(response, 'Failed to search users');
    }
    const json = (await response.json()) as { users: AdminUserSearchResult[] };
    return { users: json.users ?? [] };
  });

// ── Token balance (live credits, not config policy) ──────────────────

export const getUserBalanceFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<t.UserBalance> => {
    await requireCapability(SystemCapabilities.READ_USERS);
    const response = await apiFetch(
      `/api/admin/users/${encodeURIComponent(data.id)}/balance`,
    );
    if (!response.ok) {
      await extractApiError(response, 'Failed to fetch user balance');
    }
    return (await response.json()) as t.UserBalance;
  });

export const updateUserBalanceFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ id: z.string(), mode: z.enum(['set', 'add']), amount: z.number() }),
  )
  .handler(async ({ data }): Promise<{ userId: string; mode: string; tokenCredits: number }> => {
    await requireCapability(SystemCapabilities.MANAGE_USERS);
    const response = await apiFetch(
      `/api/admin/users/${encodeURIComponent(data.id)}/balance`,
      { method: 'POST', body: JSON.stringify({ mode: data.mode, amount: data.amount }) },
    );
    if (!response.ok) {
      await extractApiError(response, 'Failed to update user balance');
    }
    return (await response.json()) as { userId: string; mode: string; tokenCredits: number };
  });

export const userBalanceQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['userBalance', userId],
    queryFn: () => getUserBalanceFn({ data: { id: userId } }),
    staleTime: 30_000,
  });
