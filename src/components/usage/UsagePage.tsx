import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import type * as t from '@/types';
import { usageSummaryQueryOptions } from '@/server';
import { EmptyState, LoadingState, PermissionsUnavailable } from '@/components/shared';
import { useLocalize } from '@/hooks';
import { cn } from '@/utils';

const RANGE_OPTIONS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

/** Stable palette for model slices/series (amber-first, matching the chat cost capsule). */
const MODEL_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#ec4899',
  '#eab308',
];

const fmtUsd = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(n ?? 0) < 1 ? 4 : 2,
  }).format(n ?? 0);

const fmtNum = (n: number) => new Intl.NumberFormat().format(n ?? 0);

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--cui-color-background-default)',
  border: '1px solid var(--cui-color-stroke-default)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--cui-color-text-default)',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-4">
      <span className="text-xs font-medium text-(--cui-color-text-muted)">{label}</span>
      <span className="text-2xl font-semibold text-(--cui-color-text-default)">{value}</span>
      {sub && <span className="text-xs text-(--cui-color-text-muted)">{sub}</span>}
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-4',
        className,
      )}
    >
      <h3 className="mb-3 text-sm font-medium text-(--cui-color-text-default)">{title}</h3>
      {children}
    </section>
  );
}

export function UsagePage() {
  const localize = useLocalize();
  const [days, setDays] = useState<RangeDays>(30);

  const range = useMemo<t.UsageRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const { data, isLoading, isError } = useQuery(usageSummaryQueryOptions(range));

  const maxUserSpend = useMemo(
    () => Math.max(0, ...(data?.byUser ?? []).map((u) => u.spendUsd)),
    [data],
  );

  const hasSpend = !!data && data.totals.spendUsd > 0;

  return (
    <div
      role="region"
      aria-label={localize('com_nav_usage')}
      className="flex flex-1 flex-col gap-6 overflow-auto p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-(--cui-color-text-default)">
            {localize('com_nav_usage')}
          </h2>
          <p className="text-sm text-(--cui-color-text-muted)">{localize('com_usage_subtitle')}</p>
        </div>
        <div className="flex gap-1" role="group" aria-label={localize('com_usage_range')}>
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                days === d
                  ? 'bg-(--cui-color-background-active) text-(--cui-color-text-default)'
                  : 'text-(--cui-color-text-muted) hover:bg-(--cui-color-background-hover) hover:text-(--cui-color-text-default)',
              )}
            >
              {localize('com_usage_last_days', { count: String(d) })}
            </button>
          ))}
        </div>
      </header>

      {isError ? (
        <PermissionsUnavailable />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          {/* KPI row */}
          <section
            aria-label={localize('com_usage_totals')}
            className="grid grid-cols-2 gap-4 md:grid-cols-4"
          >
            <StatCard label={localize('com_usage_total_spend')} value={fmtUsd(data.totals.spendUsd)} />
            <StatCard label={localize('com_usage_tokens')} value={fmtNum(data.totals.tokens)} />
            <StatCard label={localize('com_usage_messages')} value={fmtNum(data.totals.messages)} />
            <StatCard
              label={localize('com_usage_active_users')}
              value={fmtNum(data.totals.activeUsers)}
            />
          </section>

          {/* charts */}
          <section className="grid gap-4 lg:grid-cols-3">
            <Panel title={localize('com_usage_spend_over_time')} className="lg:col-span-2">
              <div className="h-64 w-full">
                {hasSpend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.timeseries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--cui-color-stroke-default)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'var(--cui-color-text-muted)' }}
                        tickFormatter={(v: string) => v.slice(5)}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--cui-color-text-muted)' }}
                        tickFormatter={(v: number) => `$${v}`}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => [fmtUsd(Number(value)), localize('com_usage_spend')]}
                      />
                      <Area
                        type="monotone"
                        dataKey="spendUsd"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#spendFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState message={localize('com_usage_empty')} />
                  </div>
                )}
              </div>
            </Panel>

            <Panel title={localize('com_usage_by_model')}>
              <div className="h-64 w-full">
                {hasSpend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.byModel}
                        dataKey="spendUsd"
                        nameKey="model"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                      >
                        {data.byModel.map((m, i) => (
                          <Cell key={m.model} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => [fmtUsd(Number(value)), String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState message={localize('com_usage_empty')} />
                  </div>
                )}
              </div>
              {hasSpend && (
                <ul className="mt-2 flex flex-col gap-1">
                  {data.byModel.slice(0, 6).map((m, i) => (
                    <li key={m.model} className="flex items-center gap-2 text-xs">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }}
                      />
                      <span className="truncate text-(--cui-color-text-default)">{m.model}</span>
                      <span className="ml-auto text-(--cui-color-text-muted)">
                        {Math.round(m.share * 100)}% · {fmtUsd(m.spendUsd)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          {/* spend by user */}
          <Panel title={localize('com_usage_by_user')}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-(--cui-color-stroke-default)">
                    <th className="px-3 py-2 font-medium text-(--cui-color-text-muted)">
                      {localize('com_users_col_user')}
                    </th>
                    <th className="px-3 py-2 font-medium text-(--cui-color-text-muted)">
                      {localize('com_usage_col_spend')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-(--cui-color-text-muted)">
                      {localize('com_usage_tokens')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-(--cui-color-text-muted)">
                      {localize('com_usage_messages')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.byUser.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-b border-(--cui-color-stroke-default) last:border-0"
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-(--cui-color-text-default)">
                            {u.name || u.email || u.userId}
                          </span>
                          {u.name && u.email && (
                            <span className="text-xs text-(--cui-color-text-muted)">{u.email}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-(--cui-color-background-muted)">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{
                                width: `${maxUserSpend > 0 ? (u.spendUsd / maxUserSpend) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="tabular-nums text-(--cui-color-text-default)">
                            {fmtUsd(u.spendUsd)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-(--cui-color-text-muted)">
                        {fmtNum(u.tokens)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-(--cui-color-text-muted)">
                        {fmtNum(u.messages)}
                      </td>
                    </tr>
                  ))}
                  {data.byUser.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState message={localize('com_usage_empty')} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* model pricing registry */}
          <Panel title={localize('com_usage_model_pricing')}>
            <p className="mb-3 text-xs text-(--cui-color-text-muted)">
              {localize('com_usage_pricing_note')}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-(--cui-color-stroke-default)">
                    <th className="px-3 py-2 font-medium text-(--cui-color-text-muted)">
                      {localize('com_usage_col_model')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-(--cui-color-text-muted)">
                      {localize('com_usage_col_prompt')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-(--cui-color-text-muted)">
                      {localize('com_usage_col_completion')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.modelPricing.map((p) => (
                    <tr
                      key={p.model}
                      className="border-b border-(--cui-color-stroke-default) last:border-0"
                    >
                      <td className="px-3 py-2 text-(--cui-color-text-default)">{p.model}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-(--cui-color-text-muted)">
                        {fmtUsd(p.promptUsdPer1M)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-(--cui-color-text-muted)">
                        {fmtUsd(p.completionUsdPer1M)}
                      </td>
                    </tr>
                  ))}
                  {data.modelPricing.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState message={localize('com_usage_pricing_empty')} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
