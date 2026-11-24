"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { FlowBucket } from "@/lib/analytics";
import { niceScale } from "@/lib/chart";

const HALF = 112; // px for each side of the zero line

function bucketKey(b: FlowBucket) {
  return `${b.start.getFullYear()}-${b.start.getMonth()}-${b.start.getDate()}`;
}

/** Hires above the zero line, leavers below, one column per week or month. */
export default function FlowChart({ buckets, loading }: { buckets: FlowBucket[] | null; loading: boolean }) {
  const { t } = useLanguage();
  const months = useMemo(() => t("dash.trend.months").split(","), [t]);
  const [active, setActive] = useState<number | null>(null);

  const short = (b: FlowBucket) =>
    b.kind === "month" ? (months[b.start.getMonth()] ?? "") : `${b.start.getDate()} ${months[b.start.getMonth()] ?? ""}`;
  const long = (b: FlowBucket) => {
    if (b.kind === "month") return `${months[b.start.getMonth()] ?? ""} ${b.start.getFullYear()}`;
    const end = new Date(b.start.getFullYear(), b.start.getMonth(), b.start.getDate() + 6);
    return `${short(b)} – ${end.getDate()} ${months[end.getMonth()] ?? ""}`;
  };

  const stats = useMemo(() => {
    if (!buckets) return null;
    const hires = buckets.reduce((s, b) => s + b.hires, 0);
    const leavers = buckets.reduce((s, b) => s + b.leavers, 0);
    const scale = niceScale(Math.max(0, ...buckets.map((b) => Math.max(b.hires, b.leavers))));
    return { hires, leavers, net: hires - leavers, scale };
  }, [buckets]);

  const every = buckets && buckets.length > 8 ? 2 : 1;
  const activeBucket = buckets && active !== null ? buckets[active] : null;
  const net = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">{t("an.flow.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {buckets?.[0]?.kind === "month" ? t("an.flow.subtitleMonths") : t("an.flow.subtitleWeeks")}
          </p>
        </div>
        <div aria-hidden="true" className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-600" />
            {t("an.flow.hires")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-rose-400" />
            {t("an.flow.leavers")}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5">
        {loading || !buckets || !stats ? (
          <div className="space-y-4" aria-hidden="true">
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
            <div className="h-56 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ) : (
          <>
            <dl className="mb-6 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-zinc-500">{t("an.flow.hires")}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{stats.hires}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("an.flow.leavers")}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{stats.leavers}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("an.flow.net")}</dt>
                <dd
                  className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
                    stats.net > 0 ? "text-emerald-700" : stats.net < 0 ? "text-rose-700" : "text-zinc-900"
                  }`}
                >
                  {net(stats.net)}
                </dd>
              </div>
            </dl>

            <div className="relative" onMouseLeave={() => setActive(null)}>
              <div className="relative ml-8" style={{ height: HALF * 2 }}>
                {/* gridlines: the same ticks mirrored below zero */}
                {stats.scale.ticks.flatMap((v) => (v === 0 ? [0] : [v, -v])).map((v) => (
                  <div
                    key={v}
                    aria-hidden="true"
                    className={`absolute inset-x-0 border-t ${v === 0 ? "border-zinc-300" : "border-zinc-100"}`}
                    style={{ top: HALF - (v / stats.scale.top) * HALF }}
                  >
                    <span className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[11px] tabular-nums text-zinc-400">
                      {Math.abs(v)}
                    </span>
                  </div>
                ))}

                {stats.hires + stats.leavers === 0 && (
                  <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-zinc-400">
                    {t("an.flow.empty")}
                  </p>
                )}

                <div className="absolute inset-0 flex gap-0.5">
                  {buckets.map((b, i) => {
                    const isActive = active === i;
                    const dim = active !== null && !isActive;
                    return (
                      <button
                        key={bucketKey(b)}
                        type="button"
                        aria-label={t("an.flow.bar", { when: long(b), hires: b.hires, leavers: b.leavers })}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive(null)}
                        className={`relative h-full min-w-0 flex-1 rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                          isActive ? "bg-zinc-100/70" : ""
                        }`}
                      >
                        {b.hires > 0 && (
                          <span
                            className={`absolute left-1/2 w-full max-w-6 -translate-x-1/2 rounded-t-[4px] transition-colors ${
                              dim ? "bg-zinc-300" : "bg-emerald-600"
                            }`}
                            style={{ bottom: HALF, height: (b.hires / stats.scale.top) * HALF }}
                          />
                        )}
                        {b.leavers > 0 && (
                          <span
                            className={`absolute left-1/2 w-full max-w-6 -translate-x-1/2 rounded-b-[4px] transition-colors ${
                              dim ? "bg-zinc-200" : "bg-rose-400"
                            }`}
                            style={{ top: HALF, height: (b.leavers / stats.scale.top) * HALF }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {activeBucket && active !== null && (
                  <div
                    role="status"
                    className={`pointer-events-none absolute top-0 z-20 w-48 rounded-lg border border-zinc-200/80 bg-white p-3 text-left shadow-overlay ${
                      active < buckets.length / 3 ? "" : active > (buckets.length * 2) / 3 ? "-translate-x-full" : "-translate-x-1/2"
                    }`}
                    style={{ left: `${((active + 0.5) / buckets.length) * 100}%` }}
                  >
                    <p className="text-xs text-zinc-500">{long(activeBucket)}</p>
                    <dl className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-zinc-600">
                          <span className="h-2 w-2 rounded-sm bg-emerald-600" />
                          {t("an.flow.hires")}
                        </dt>
                        <dd className="font-medium tabular-nums text-zinc-900">{activeBucket.hires}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-zinc-600">
                          <span className="h-2 w-2 rounded-sm bg-rose-400" />
                          {t("an.flow.leavers")}
                        </dt>
                        <dd className="font-medium tabular-nums text-zinc-900">{activeBucket.leavers}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-zinc-100 pt-1">
                        <dt className="text-zinc-600">{t("an.flow.net")}</dt>
                        <dd className="font-medium tabular-nums text-zinc-900">
                          {net(activeBucket.hires - activeBucket.leavers)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>

              {/* x-axis */}
              <div aria-hidden="true" className="ml-8 mt-2 flex gap-0.5 text-[11px] text-zinc-400">
                {buckets.map((b, i) => {
                  const last = buckets.length - 1;
                  const show = i === last || (i % every === 0 && last - i >= every);
                  return (
                    <span key={bucketKey(b)} className="relative min-w-0 flex-1 text-center">
                      {show && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{short(b)}</span>}
                    </span>
                  );
                })}
              </div>
              <div className="h-4" aria-hidden="true" />
            </div>

            <table className="sr-only">
              <caption>{t("an.flow.title")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("an.flow.colWhen")}</th>
                  <th scope="col">{t("an.flow.hires")}</th>
                  <th scope="col">{t("an.flow.leavers")}</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={bucketKey(b)}>
                    <td>{long(b)}</td>
                    <td>{b.hires}</td>
                    <td>{b.leavers}</td>
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
