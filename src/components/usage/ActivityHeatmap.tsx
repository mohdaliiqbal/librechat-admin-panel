import { useMemo } from 'react';
import type * as t from '@/types';
import { useLocalize } from '@/hooks';

/** Shared with the by-model chart so colors are consistent across the page. */
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
const OTHER_COLOR = '#6b7280';
const EMPTY_COLOR = 'var(--cui-color-background-muted)';

const CELL = 11;
const GAP = 3;
const WEEKS = 53;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const fmtNum = (n: number) => new Intl.NumberFormat().format(n ?? 0);

interface Cell {
  date: string;
  future: boolean;
  day?: t.UsageActivityDay;
}

export function ActivityHeatmap({ activity }: { activity: t.UsageActivityDay[] }) {
  const localize = useLocalize();

  const { weeks, segments, topModels, colorFor, maxTokens, hasOther } = useMemo(() => {
    const byDate = new Map(activity.map((a) => [a.date, a]));

    // Model → color: the top models (by tokens) get distinct colors, the rest share "Other".
    const modelTotals = new Map<string, number>();
    let maxTok = 0;
    for (const a of activity) {
      modelTotals.set(a.model, (modelTotals.get(a.model) ?? 0) + a.tokens);
      if (a.tokens > maxTok) {
        maxTok = a.tokens;
      }
    }
    const top = [...modelTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MODEL_COLORS.length)
      .map((e) => e[0]);
    const other = modelTotals.size > top.length;
    const color = (model: string) => {
      const i = top.indexOf(model);
      return i >= 0 ? MODEL_COLORS[i] : OTHER_COLOR;
    };

    // Grid: WEEKS columns ending this week, each a Sun→Sat column, iterated in UTC.
    const end = utcDay(new Date());
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - end.getUTCDay() - (WEEKS - 1) * 7);
    const cols: Cell[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const key = keyOf(cur);
        col.push({ date: key, future: cur > end, day: byDate.get(key) });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      cols.push(col);
    }

    // Month label segments (consecutive weeks sharing the first-day month).
    const segs: Array<{ month: number; weeks: number }> = [];
    let prev = -1;
    for (const col of cols) {
      const m = new Date(`${col[0].date}T00:00:00Z`).getUTCMonth();
      if (m !== prev) {
        segs.push({ month: m, weeks: 1 });
        prev = m;
      } else {
        segs[segs.length - 1].weeks += 1;
      }
    }

    return {
      weeks: cols,
      segments: segs,
      topModels: top,
      colorFor: color,
      maxTokens: maxTok,
      hasOther: other,
    };
  }, [activity]);

  const cellStyle = (cell: Cell) => {
    if (cell.future) {
      return { width: CELL, height: CELL, background: 'transparent' };
    }
    if (!cell.day || cell.day.tokens <= 0) {
      return { width: CELL, height: CELL, borderRadius: 2, background: EMPTY_COLOR };
    }
    // Subtle opacity gradient by volume so busy days read stronger.
    const intensity = maxTokens > 0 ? Math.log1p(cell.day.tokens) / Math.log1p(maxTokens) : 1;
    const opacity = 0.45 + 0.55 * intensity;
    return {
      width: CELL,
      height: CELL,
      borderRadius: 2,
      background: colorFor(cell.day.model),
      opacity,
    };
  };

  const title = (cell: Cell) =>
    cell.day && cell.day.tokens > 0
      ? `${cell.date} · ${fmtNum(cell.day.tokens)} tokens · ${cell.day.model}`
      : `${cell.date} · no activity`;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          {/* month labels */}
          <div className="flex text-[10px] text-(--cui-color-text-muted)" style={{ gap: GAP }}>
            {segments.map((seg, i) => (
              <div
                key={i}
                style={{ width: seg.weeks * (CELL + GAP) - GAP }}
                className="overflow-visible whitespace-nowrap"
              >
                {seg.weeks >= 2 ? MONTHS[seg.month] : ''}
              </div>
            ))}
          </div>
          {/* grid */}
          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((col, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                {col.map((cell) => (
                  <div key={cell.date} title={title(cell)} style={cellStyle(cell)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* model legend */}
      {topModels.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--cui-color-text-muted)">
          {topModels.map((m, i) => (
            <span key={m} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: MODEL_COLORS[i] }}
              />
              <span className="truncate text-(--cui-color-text-default)">{m}</span>
            </span>
          ))}
          {hasOther && (
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: OTHER_COLOR }}
              />
              <span>{localize('com_usage_other')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
