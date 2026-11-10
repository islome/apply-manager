"use client";

import { useMemo, useState } from "react";
import { useLanguage, type TFunction } from "@/i18n/LanguageProvider";
import { LOCALES } from "@/i18n/types";
import type { MessageKey } from "@/i18n/messages";

/** Only the fields the chart reads; the dashboard passes its already-loaded applications. */
export type TrendApplication = {
  created_at: string;
  vacancy: { title: string } | { title: string }[] | null;
};

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

/** Label every Nth day on the x-axis so labels never collide. */
const LABEL_EVERY: Record<Range, number> = { 7: 1, 14: 2, 30: 5 };

type Day = {
  date: Date;
  count: number;
  /** vacancy title -> applications that day, most first */
  byVacancy: [string, number][];
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function vacancyTitle(v: TrendApplication["vacancy"]): string | null {
  const one = Array.isArray(v) ? v[0] : v;
  return one?.title?.trim() || null;
}

/** Clean y-axis: at most 4 intervals, steps of 1/2/5 x 10^n, never below 1. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

function useNames(t: TFunction) {
  return useMemo(
    () => ({
      months: t("dash.trend.months").split(","),
      weekdays: t("dash.trend.weekdays").split(","),
    }),
    [t],
  );
}

export default function ApplicationTrend({
  applications,
  now,
  ready,
}: {
  applications: TrendApplication[];
  now: Date | null;
  ready: boolean;
}) {
  const { lang, t } = useLanguage();
  const { months, weekdays } = useNames(t);
  const [range, setRange] = useState<Range>(14);
  const [active, setActive] = useState<number | null>(null);

  const numberFmt = useMemo(() => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 1 }), [lang]);
  const plural = useMemo(() => new Intl.PluralRules(LOCALES[lang]), [lang]);
  const unit = (n: number) => t(`dash.trend.unit.${plural.select(n)}` as MessageKey);
  const shortLabel = (d: Date) => `${d.getDate()} ${months[d.getMonth()] ?? ""}`;
  const longLabel = (d: Date) => `${weekdays[d.getDay()] ?? ""}, ${shortLabel(d)}`;

  const stats = useMemo(() => {
    if (!now) return null;

    // bucket every application by local calendar day, once
    const buckets = new Map<string, TrendApplication[]>();
    for (const a of applications) {
      const d = new Date(a.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const list = buckets.get(key);
      if (list) list.push(a);
      else buckets.set(key, [a]);
    }

    const dayAt = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const countAt = (offset: number) => buckets.get(dayKey(dayAt(offset)))?.length ?? 0;

    const days: Day[] = Array.from({ length: range }, (_, i) => {
      const date = dayAt(range - 1 - i);
      const list = buckets.get(dayKey(date)) ?? [];
      const per = new Map<string, number>();
      for (const a of list) {
        const title = vacancyTitle(a.vacancy) ?? "—";
        per.set(title, (per.get(title) ?? 0) + 1);
      }
      return { date, count: list.length, byVacancy: [...per].sort((x, y) => y[1] - x[1]) };
    });

    const total = days.reduce((s, d) => s + d.count, 0);
    let previous = 0;
    for (let offset = range; offset < range * 2; offset++) previous += countAt(offset);

    const peakIndex = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);

    return {
      days,
      total,
      delta: total - previous,
      average: total / range,
      peakIndex: days[peakIndex].count > 0 ? peakIndex : null,
      today: days[days.length - 1].count,
      yesterday: days[days.length - 2]?.count ?? countAt(1),
      scale: niceScale(Math.max(...days.map((d) => d.count))),
    };
  }, [applications, now, range]);

  const activeDay = stats && active !== null ? stats.days[active] : null;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white">
      {/* header: title + period */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">{t("dash.trend.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t("dash.trend.subtitleN", { n: range })}</p>
        </div>
        <div role="group" aria-label={t("dash.trend.rangeAria")} className="inline-flex rounded-lg bg-zinc-100 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => {
                setRange(r);
                setActive(null);
              }}
              className={`h-7 rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                r === range
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-zinc-200/70"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {t("dash.trend.range", { n: r })}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        {!ready || !stats ? (
          <div className="space-y-4" aria-hidden="true">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
            <div className="h-52 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ) : (
          <>
            {/* precise numbers first */}
            <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-zinc-500">{t("dash.trend.total")}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{stats.total}</dd>
                <dd className="mt-0.5 text-xs">
                  {stats.delta === 0 ? (
                    <span className="text-zinc-500">{t("dash.trend.samePrev", { n: range })}</span>
                  ) : (
                    <span className={stats.delta > 0 ? "text-emerald-700" : "text-rose-700"}>
                      {stats.delta > 0 ? "↑" : "↓"} {Math.abs(stats.delta)}{" "}
                      <span className="text-zinc-500">{t("dash.trend.vsPrev", { n: range })}</span>
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span aria-hidden="true" className="h-px w-3 bg-zinc-500" />
                  {t("dash.trend.avg")}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
                  {numberFmt.format(stats.average)}
                </dd>
                <dd className="mt-0.5 text-xs text-zinc-500">{t("dash.trend.avgSub")}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("dash.trend.peak")}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
                  {stats.peakIndex === null ? "—" : stats.days[stats.peakIndex].count}
                </dd>
                <dd className="mt-0.5 text-xs text-zinc-500">
                  {stats.peakIndex === null ? " " : longLabel(stats.days[stats.peakIndex].date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("dash.trend.today")}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{stats.today}</dd>
                <dd className="mt-0.5 text-xs text-zinc-500">{t("dash.trend.yesterday", { n: stats.yesterday })}</dd>
              </div>
            </dl>

            {/* chart */}
            <div className="relative" onMouseLeave={() => setActive(null)}>
              <div className="relative ml-8 h-52">
                {/* gridlines + y ticks */}
                {stats.scale.ticks.map((v) => (
                  <div
                    key={v}
                    aria-hidden="true"
                    className={`absolute inset-x-0 border-t ${v === 0 ? "border-zinc-300" : "border-zinc-100"}`}
                    style={{ bottom: `${(v / stats.scale.top) * 100}%` }}
                  >
                    <span className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[11px] tabular-nums text-zinc-400">
                      {v}
                    </span>
                  </div>
                ))}

                {/* daily average reference line (solid: dashed would read as a projection) */}
                {stats.total > 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-zinc-500/70"
                    style={{ bottom: `${(stats.average / stats.scale.top) * 100}%` }}
                  />
                )}

                {stats.total === 0 && (
                  <p className="absolute inset-0 grid place-items-center text-sm text-zinc-400">{t("dash.trend.empty")}</p>
                )}

                {/* columns: the whole column height is the hit target */}
                <div className="absolute inset-0 flex items-end gap-0.5">
                  {stats.days.map((d, i) => {
                    const pct = (d.count / stats.scale.top) * 100;
                    const isActive = active === i;
                    const dimmed = active !== null && !isActive;
                    return (
                      <button
                        key={dayKey(d.date)}
                        type="button"
                        aria-label={t("dash.trend.bar", { date: longLabel(d.date), n: d.count })}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive(null)}
                        className={`relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                          isActive ? "bg-zinc-100/70" : ""
                        }`}
                      >
                        {d.count > 0 && (
                          <span
                            className={`relative w-full max-w-6 rounded-t-[4px] transition-[background-color,height] duration-300 ease-smooth ${
                              dimmed ? "bg-zinc-300" : "bg-zinc-800"
                            }`}
                            style={{ height: `${pct}%` }}
                          >
                            {/* value on the cap: only the peak (and the hovered one) */}
                            {(i === stats.peakIndex || isActive) && (
                              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-medium tabular-nums text-zinc-700">
                                {d.count}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* tooltip */}
                {activeDay && active !== null && (
                  <div
                    role="status"
                    className={`pointer-events-none absolute bottom-full z-20 mb-2 w-56 rounded-lg border border-zinc-200/80 bg-white p-3 text-left shadow-overlay ${
                      active < stats.days.length / 3
                        ? ""
                        : active > (stats.days.length * 2) / 3
                          ? "-translate-x-full"
                          : "-translate-x-1/2"
                    }`}
                    style={{ left: `${((active + 0.5) / stats.days.length) * 100}%` }}
                  >
                    <p className="text-xs text-zinc-500">{longLabel(activeDay.date)}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      <span className="text-lg font-semibold text-zinc-900">{activeDay.count}</span> {unit(activeDay.count)}
                    </p>
                    {activeDay.byVacancy.length > 0 && (
                      <div className="mt-2 border-t border-zinc-100 pt-2">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                          {t("dash.trend.byVacancy")}
                        </p>
                        <ul className="space-y-0.5">
                          {activeDay.byVacancy.slice(0, 4).map(([title, n]) => (
                            <li key={title} className="flex items-center justify-between gap-3 text-xs">
                              <span className="truncate text-zinc-600">{title}</span>
                              <span className="shrink-0 font-medium tabular-nums text-zinc-900">{n}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* x-axis */}
              <div aria-hidden="true" className="ml-8 mt-2 flex gap-0.5 text-[11px] text-zinc-400">
                {stats.days.map((d, i) => {
                  const last = stats.days.length - 1;
                  const every = LABEL_EVERY[range];
                  const show = i === last || (i % every === 0 && last - i >= every);
                  return (
                    <span key={dayKey(d.date)} className="relative min-w-0 flex-1 text-center">
                      {show && (
                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                          {i === last ? t("dash.trend.today") : shortLabel(d.date)}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
              <div className="h-4" aria-hidden="true" />
            </div>

            {/* the same numbers for screen readers */}
            <table className="sr-only">
              <caption>{t("dash.trend.subtitleN", { n: range })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("dash.trend.colDate")}</th>
                  <th scope="col">{t("dash.trend.colCount")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.days.map((d) => (
                  <tr key={dayKey(d.date)}>
                    <td>{longLabel(d.date)}</td>
                    <td>{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
