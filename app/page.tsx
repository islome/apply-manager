"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Inbox,
  Plus,
  UserCheck,
} from "lucide-react";
import { STAGES, stageLabel, timeAgo } from "@/lib/applications";
import { useLanguage, type TFunction } from "@/i18n/LanguageProvider";
import { LOCALES, type Lang } from "@/i18n/types";
import { majorLabel } from "@/lib/vacancy-options";
import Avatar from "@/components/applicants/Avatar";
import { getCached, setCached } from "@/lib/data-cache";

type Vacancy = {
  id: string;
  title?: string;
  is_active: boolean;
};

type Candidate = {
  full_name: string;
  major: string | null;
  photo_url: string | null;
};

type Application = {
  id: string;
  vacancy_id?: string | null;
  status: string;
  created_at: string;
  candidate: Candidate | Candidate[] | null;
  vacancy: { title: string; major: string } | { title: string; major: string }[] | null;
};

type DashboardData = {
  vacancies: Vacancy[];
  applications: Application[];
};

const DAY = 86_400_000;
const STALE_DAYS = 3; // a "new" application waiting longer than this needs attention

function stageOf(status: string, t: TFunction): { label: string; dot: string } {
  const stage = STAGES.find((s) => s.id === status);
  return { label: stage ? stageLabel(stage.id, t) : status, dot: stage?.dot ?? "bg-zinc-400" };
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function longDate(d: Date, lang: Lang) {
  return d.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}

function shortDate(d: Date, lang: Lang) {
  return d.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "short" });
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [vacanciesResponse, applicationsResponse] = await Promise.all([
    fetch("/api/hr/vacancies", { credentials: "same-origin", cache: "no-store" }),
    fetch("/api/hr/applications", { credentials: "same-origin", cache: "no-store" }),
  ]);

  if (!vacanciesResponse.ok || !applicationsResponse.ok) {
    const failedResponse = !vacanciesResponse.ok ? vacanciesResponse : applicationsResponse;
    const result = (await failedResponse.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(result?.error ?? "");
  }

  const [vacancies, applications] = (await Promise.all([
    vacanciesResponse.json(),
    applicationsResponse.json(),
  ])) as [Vacancy[], Application[]];

  return { vacancies, applications };
}

/* ------------------------------------------------------------------ pieces */

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {action.label}
            <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function KpiCard({
  title,
  value,
  foot,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  foot: ReactNode;
  icon: typeof Inbox;
  loading: boolean;
}) {
  if (loading) return <div className="h-29 animate-pulse rounded-xl bg-black/5" />;
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm text-zinc-500">{title}</h2>
        <Icon size={16} strokeWidth={1.5} className="text-zinc-400" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{foot}</p>
    </article>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-black/5 ${className}`} />;
}

/* -------------------------------------------------------------------- page */

export default function DashboardPage() {
  const { lang, t } = useLanguage();
  const ago = (value: string) => timeAgo(value, t, lang, nowMs);
  const [data, setData] = useState<DashboardData | null>(() => getCached<DashboardData>("dashboard") ?? null);
  const [loading, setLoading] = useState(() => !getCached("dashboard"));
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(() => (getCached("dashboard") ? new Date() : null));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fresh = await fetchDashboardData();
      setCached("dashboard", fresh);
      setData(fresh);
      setNow(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message ? loadError.message : "\0");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchDashboardData()
      .then((result) => {
        setCached("dashboard", result);
        if (active) {
          setData(result);
          setNow(new Date());
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error && loadError.message ? loadError.message : "\0");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const vacancies = data?.vacancies ?? [];
  const applications = data?.applications ?? [];
  const ready = !loading && !!data && !!now;
  const nowMs = now?.getTime() ?? 0;
  const num = (n: number) => (ready ? String(n) : "—"); // never show 0 while loading or after an error

  /* ---- numbers HR cares about ---- */
  const total = applications.length;
  const ageOf = (a: Application) => nowMs - new Date(a.created_at).getTime();

  const waiting = applications
    .filter((a) => a.status === "new")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // oldest first
  const stale = waiting.filter((a) => ageOf(a) >= STALE_DAYS * DAY);

  const thisWeek = applications.filter((a) => ageOf(a) < 7 * DAY).length;
  const lastWeek = applications.filter((a) => ageOf(a) >= 7 * DAY && ageOf(a) < 14 * DAY).length;
  const weekDelta = thisWeek - lastWeek;

  const newToday = now ? applications.filter((a) => startOfDay(new Date(a.created_at)) === startOfDay(now)).length : 0;

  const hired = applications.filter((a) => a.status === "hired").length;
  const hireRate = total ? Math.round((hired / total) * 100) : null;

  const activeVacancies = vacancies.filter((v) => v.is_active);

  const perVacancy = new Map<string, number>();
  for (const a of applications) {
    if (a.vacancy_id) perVacancy.set(a.vacancy_id, (perVacancy.get(a.vacancy_id) ?? 0) + 1);
  }
  const vacancyRows = vacancies
    .map((v) => ({ ...v, count: perVacancy.get(v.id) ?? 0 }))
    .sort((x, y) => y.count - x.count || Number(y.is_active) - Number(x.is_active));
  const emptyActive = vacancyRows.filter((v) => v.is_active && v.count === 0);

  const stageCounts = STAGES.map((s) => ({
    id: s.id as string,
    ...stageOf(s.id, t),
    count: applications.filter((a) => a.status === s.id).length,
  }));

  const days = Array.from({ length: 14 }, (_, i) => {
    const dayStart = now ? startOfDay(now) - (13 - i) * DAY : 0;
    const count = applications.filter((a) => startOfDay(new Date(a.created_at)) === dayStart).length;
    return { date: new Date(dayStart), count };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const categories = applications.reduce<Record<string, number>>((counts, a) => {
    const candidate = relation(a.candidate);
    const vacancy = relation(a.vacancy);
    const category = candidate?.major?.trim() || vacancy?.major?.trim() || t("dash.byField.uncategorized");
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
  const categoryEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = Math.max(1, ...categoryEntries.map(([, c]) => c));

  const recent = [...applications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  /* ---- attention items (the actionable part) ---- */
  const attention: { text: string; href: string }[] = [];
  if (waiting.length) attention.push({ text: t("dash.attention.waiting", { n: waiting.length }), href: "/applicants" });
  if (stale.length) attention.push({ text: t("dash.attention.stale", { n: stale.length, days: STALE_DAYS }), href: "/applicants" });
  if (emptyActive.length) attention.push({ text: t("dash.attention.emptyVac", { n: emptyActive.length }), href: "/vacancies" });

  return (
    <div className="mx-auto w-full max-w-[1600px] px-2 pb-6 ">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{t("dash.title")}</h1>
          <p className="text-sm text-zinc-500">
            {now ? `${longDate(now, lang)} · ${t("dash.todayNew", { n: newToday })}` : t("dash.loadingData")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/vacancies"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            {t("dash.addVacancy")}
          </Link>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          <p>{error === "\0" ? t("dash.loadFailed") : error}</p>
          <button type="button" onClick={() => void load()} className="font-medium underline">
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* what needs a decision right now */}
      {ready && (
        <section aria-label={t("dash.attention.title")} className="mb-5 rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 className="text-sm font-semibold text-zinc-900">{t("dash.attention.title")}</h2>
            <span className="text-xs text-zinc-500">{attention.length ? t("dash.attention.count", { n: attention.length }) : t("dash.attention.allGood")}</span>
          </div>

          {attention.length === 0 ? (
            <p className="px-5 pb-4 text-sm text-zinc-500">{t("dash.attention.none")}</p>
          ) : (
            <div className="grid gap-x-8 gap-y-4 px-5 pb-4 lg:grid-cols-2">
              <ul className="divide-y divide-zinc-100">
                {attention.map((item) => (
                  <li key={item.text} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-zinc-800">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span className="truncate">{item.text}</span>
                    </span>
                    <Link href={item.href} className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700">
                      {t("dash.view")}
                    </Link>
                  </li>
                ))}
              </ul>

              {waiting.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-zinc-500">{t("dash.attention.longest")}</p>
                  <ul className="divide-y divide-zinc-100">
                    {waiting.slice(0, 3).map((a) => {
                      const c = relation(a.candidate);
                      const v = relation(a.vacancy);
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 truncate text-zinc-900">
                            {c?.full_name || t("dash.unknownCandidate")}
                            <span className="text-zinc-500"> · {v?.title || "—"}</span>
                          </span>
                          <span className="shrink-0 text-xs text-zinc-500">{ago(a.created_at)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* key numbers */}
      <section aria-label={t("dash.stats")} aria-busy={loading} className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          loading={!ready && !error}
          icon={Inbox}
          title={t("dash.kpi.new")}
          value={num(waiting.length)}
          foot={!ready ? "" : waiting.length && now ? t("dash.kpi.oldest", { ago: ago(waiting[0].created_at) }) : t("dash.kpi.noneWaiting")}
        />
        <KpiCard
          loading={!ready && !error}
          icon={CalendarDays}
          title={t("dash.kpi.week")}
          value={num(thisWeek)}
          foot={
            !ready ? "" : weekDelta === 0 ? (
              t("dash.kpi.sameWeek")
            ) : (
              <span className={weekDelta > 0 ? "text-emerald-700" : "text-zinc-500"}>
                {weekDelta > 0 ? "↑" : "↓"} {t("dash.kpi.weekDelta", { n: Math.abs(weekDelta) })}
              </span>
            )
          }
        />
        <KpiCard
          loading={!ready && !error}
          icon={BriefcaseBusiness}
          title={t("dash.kpi.activeVac")}
          value={num(activeVacancies.length)}
          foot={ready ? t("dash.kpi.vacFoot", { total: vacancies.length, inactive: vacancies.length - activeVacancies.length }) : ""}
        />
        <KpiCard
          loading={!ready && !error}
          icon={UserCheck}
          title={t("dash.kpi.hired")}
          value={num(hired)}
          foot={!ready ? "" : hireRate === null ? t("dash.kpi.noApps") : t("dash.kpi.hireRate", { n: hireRate })}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="space-y-5">
          <Card title={t("dash.trend.title")} subtitle={t("dash.trend.subtitle")}>
            {!ready ? (
              <Skeleton className="h-28" />
            ) : (
              <>
                <div
                  role="img"
                  aria-label={t("dash.trend.aria", { n: days.reduce((s, d) => s + d.count, 0) })}
                  className="flex h-28 items-end gap-1.5"
                >
                  {days.map((d, i) => (
                    <div
                      key={i}
                      title={t("dash.trend.bar", { date: shortDate(d.date, lang), n: d.count })}
                      className={`flex-1 rounded-sm ${d.count ? "bg-blue-500" : "bg-zinc-200"}`}
                      style={{ height: d.count ? `${Math.max(8, (d.count / maxDay) * 100)}%` : "2px" }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-zinc-500">
                  <span>{shortDate(days[0].date, lang)}</span>
                  <span>{t("dash.trend.today")}</span>
                </div>
              </>
            )}
          </Card>

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">{t("dash.recent.title")}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">{t("dash.recent.subtitle")}</p>
              </div>
              <Link
                href="/applicants"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {t("dash.all")}
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {!ready && !error && (
              <div className="space-y-2 px-5 pb-5" aria-label={t("dash.recent.loading")}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            )}

            {ready && recent.length === 0 && (
              <p className="px-5 pb-5 text-sm text-zinc-500">
                {t("dash.recent.empty")}
              </p>
            )}

            {ready && recent.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-155 border-collapse text-left">
                  <thead>
                    <tr className="border-y border-zinc-100 text-xs font-medium text-zinc-500">
                      <th className="px-5 py-2.5 font-medium">{t("dash.recent.candidate")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("dash.recent.vacancy")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("dash.recent.field")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("dash.recent.submitted")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("dash.recent.stage")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((a) => {
                      const c = relation(a.candidate);
                      const v = relation(a.vacancy);
                      const name = c?.full_name || t("dash.unknownCandidate");
                      const stage = stageOf(a.status, t);

                      return (
                        <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-3">
                              <Avatar
                                key={c?.photo_url ?? name}
                                name={name}
                                url={c?.photo_url}
                                className="h-8 w-8 text-xs"
                              />
                              <span className="text-sm font-medium text-zinc-900">{name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-zinc-700">{v?.title || "—"}</td>
                          <td className="px-4 py-2.5 text-sm text-zinc-500">{c?.major || v?.major ? majorLabel((c?.major || v?.major)!, t) : "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">{ago(a.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-zinc-700">
                              <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                              {stage.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <Card title={t("dash.funnel.title")} subtitle={t("dash.funnel.subtitle")}>
            {!ready ? (
              <Skeleton className="h-40" />
            ) : total === 0 ? (
              <p className="text-sm text-zinc-500">{t("dash.funnel.empty")}</p>
            ) : (
              <ul className="space-y-3.5">
                {stageCounts.map((s) => (
                  <li key={s.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-zinc-700">
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                      <span className="tabular-nums text-zinc-900">
                        {s.count}
                        <span className="ml-1.5 text-xs text-zinc-500">{Math.round((s.count / total) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${(s.count / total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("dash.byVac.title")} subtitle={t("dash.byVac.subtitle")} action={{ href: "/vacancies", label: t("dash.all") }}>
            {!ready ? (
              <Skeleton className="h-40" />
            ) : vacancyRows.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("dash.byVac.empty")}</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {vacancyRows.slice(0, 5).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        title={v.is_active ? t("dash.byVac.active") : t("dash.byVac.inactive")}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.is_active ? "bg-emerald-500" : "bg-zinc-400"}`}
                      />
                      <span className={`truncate ${v.is_active ? "text-zinc-900" : "text-zinc-500"}`}>{v.title ?? t("dash.byVac.fallback")}</span>
                    </span>
                    {v.is_active && v.count === 0 ? (
                      <span className="shrink-0 text-xs text-amber-700">{t("dash.byVac.noApps")}</span>
                    ) : (
                      <span className="shrink-0 tabular-nums text-zinc-900">{v.count}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("dash.byField.title")} subtitle={t("dash.byField.subtitle")}>
            {!ready ? (
              <Skeleton className="h-32" />
            ) : categoryEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("dash.byField.empty")}</p>
            ) : (
              <ul className="space-y-3.5">
                {categoryEntries.map(([category, count]) => (
                  <li key={category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-zinc-700">{majorLabel(category, t)}</span>
                      <span className="shrink-0 tabular-nums text-zinc-900">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(count / maxCategory) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
