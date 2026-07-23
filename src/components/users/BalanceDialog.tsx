import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type * as t from '@/types';
import { notifySuccess, notifyError } from '@/utils';
import { FormDialog } from '@/components/shared';
import { updateUserBalanceFn, userBalanceQueryOptions } from '@/server';
import { useLocalize } from '@/hooks';

/** tokenCredits are micro-dollars: 1 credit = 1e-6 USD, so USD = credits / 1e6. */
const CREDITS_PER_USD = 1_000_000;
const fmtUsd = (credits: number | undefined) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format((credits ?? 0) / CREDITS_PER_USD);

export function BalanceDialog({ user, onClose }: t.BalanceDialogProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<t.BalanceMode>('set');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const userId = user?.id ?? '';

  const { data: balance, isLoading } = useQuery({
    ...userBalanceQueryOptions(userId),
    enabled: !!user,
  });

  const resetAndClose = () => {
    setMode('set');
    setAmount('');
    setError('');
    onClose();
  };

  const mutation = useMutation({
    // amount arrives in USD; the balance API is in credits, so convert (× 1e6).
    mutationFn: (dollars: number) =>
      updateUserBalanceFn({ data: { id: userId, mode, amount: Math.round(dollars * CREDITS_PER_USD) } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['userBalance', userId] });
      notifySuccess(
        localize('com_toast_balance_updated', {
          name: user?.name ?? '',
          credits: fmtUsd(result.tokenCredits),
        }),
      );
      resetAndClose();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const doSubmit = () => {
    setError('');
    const parsed = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(parsed)) {
      setError(localize('com_users_balance_amount_invalid'));
      return;
    }
    if (mode === 'set' && parsed < 0) {
      setError(localize('com_users_balance_amount_negative'));
      return;
    }
    mutation.mutate(parsed);
  };

  return (
    <FormDialog
      open={!!user}
      title={localize('com_users_manage_credits')}
      submitLabel={localize('com_users_balance_apply')}
      submitDisabled={amount.trim() === '' || !balance?.enabled}
      saving={mutation.isPending}
      error={error}
      onSubmit={doSubmit}
      onClose={resetAndClose}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-(--cui-color-text-default)">
          {localize('com_users_balance_current')}
        </span>
        <span className="text-2xl font-semibold text-(--cui-color-text-default)">
          {isLoading ? '…' : fmtUsd(balance?.tokenCredits)}
        </span>
        {balance && !balance.enabled && (
          <span className="text-xs text-(--cui-color-text-warning)">
            {localize('com_users_balance_disabled_note')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="balance-mode" className="text-sm font-medium text-(--cui-color-text-default)">
          {localize('com_users_balance_mode_label')}
        </label>
        <select
          id="balance-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as t.BalanceMode)}
          className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm text-(--cui-color-text-default)"
        >
          <option value="set">{localize('com_users_balance_mode_set')}</option>
          <option value="add">{localize('com_users_balance_mode_add')}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="balance-amount" className="text-sm font-medium text-(--cui-color-text-default)">
          {localize('com_users_balance_amount_label')}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-(--cui-color-text-muted)">$</span>
          <input
            id="balance-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={localize('com_users_balance_amount_placeholder')}
            autoFocus
            className="flex-1 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm text-(--cui-color-text-default) placeholder:text-(--cui-color-text-disabled)"
          />
        </div>
        <span className="text-xs text-(--cui-color-text-muted)">
          {localize('com_users_balance_amount_hint')}
        </span>
      </div>
    </FormDialog>
  );
}
