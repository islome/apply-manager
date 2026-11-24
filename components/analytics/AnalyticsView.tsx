"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { MessageKey } from "@/i18n/messages";
import { LOCALES } from "@/i18n/types";
import { useStages } from "@/hooks/useStages";
import { getCached, setCached } from "@/lib/data-cache";
import {
  PERIODS,
  fetchAnalytics,
  flowSeries,
  funnelStats,
  payrollStats,
  workforceStats,
  type AnalyticsData,
  type Period,
} from "@/lib/analytics";
import KpiStrip from "./KpiStrip";
import FlowChart from "./FlowChart";
import HiringFunnel from "./HiringFunnel";
import PayrollForecast from "./PayrollForecast";

const CACHE_KEY = "analytics";

export default function AnalyticsView() {
  const { lang, t } = useLanguage();
  const { stages } = useStages();
  const [data, setData] = useState<AnalyticsData | null>(() => getCached<AnalyticsData>(CACHE_KEY) ?? null);
  const [now, setNow] = useState<Date | null>(() => (getCached(CACHE_KEY) ? new Date() : null));
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>(90);

  const apply = useCallback((fresh: AnalyticsData) => {
    setCached(CACHE_KEY, fresh);
    setData(fresh);
    setNow(new Date());
  }, []);
  const failed = useCallback((e: unknown) => setError(e instanceof Error && e.message ? e.message : "\0"), []);

  // retry button
  const load = useCallback(() => {
    setError("");
    fetchAnalytics().then(apply, failed);
  }, [apply, failed]);

  // first load (the cached copy, if any, shows meanwhile)
  useEffect(() => {
    const ctrl = new AbortController();
    fetchAnalytics(ctrl.signal).then(apply, (e) => {
      if (!ctrl.signal.aborted) failed(e);
    });
    return () => ctrl.abort();
  }, [apply, failed]);

  const ready = !!data && !!now;
  const workforce = useMemo(() => (ready ? workforceStats(data, period, now) : null), [ready, data, period, now]);
  const flow = useMemo(() => (ready ? flowSeries(data, period, now) : null), [ready, data, period, now]);
  const payroll = useMemo(() => (ready ? payrollStats(data, now) : null), [ready, data, now]);
  const funnel = useMemo(() => (ready ? funnelStats(data, stages, period, now) : null), [ready, data, stages, period, now]);

  const fmt = useMemo(() => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 1 }), [lang]);
  const pct = (n: number | null) => (n === null ? "—" : `${fmt.format(n)}%`);
  const days = (n: number) => t("an.days", { n: fmt.format(n) });
  const showSkeleton = !ready && !error;

  return (
    <div className="w-full">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("an.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("an.subtitle")}</p>
        </div>
        <div role="group" aria-label={t("an.periodAria")} className="inline-flex rounded-lg bg-zinc-100 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
              className={`h-8 rounded-md px-3 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                p === period
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-zinc-200/70"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {t(`an.period.${p}` as MessageKey)}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          <p>{error === "\0" ? t("an.loadFailed") : error}</p>
          <button type="button" onClick={load} className="font-medium underline">
            {t("common.retry")}
          </button>
        </div>
      )}

      <KpiStrip stats={workforce} period={period} loading={showSkeleton || !ready} pct={pct} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <FlowChart buckets={flow} loading={showSkeleton} />
        <HiringFunnel
          funnel={funnel}
          period={period}
          history={data?.history ?? true}
          loading={showSkeleton}
          pct={pct}
          days={days}
        />
      </div>

      <div className="mt-6">
        <PayrollForecast payroll={payroll} notInPanel={workforce?.notInPanel ?? 0} loading={showSkeleton} pct={pct} />
      </div>
    </div>
  );
}
