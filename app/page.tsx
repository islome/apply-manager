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
import { STAGES } from "@/lib/applications";

type Vacancy = {
  id: string;
  title?: string;
  is_active: boolean;
};

type Candidate = {
  full_name: string;
  major: string | null;
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

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktyabr", "noyabr", "dekabr",
];
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

// Pipeline stage labels in Uzbek; the colour dot still comes from STAGES in lib/applications.
const STAGE_LABELS: Record<string, string> = {
  new: "Yangi",
  confirmed: "Tasdiqlangan",
  interview: "Suhbat",
  hired: "Qabul qilingan",
  cancel: "Bekor qilingan",
};

function stageOf(status: string): { label: string; dot: string } {
  const stage = STAGES.find((s) => s.id === status);
  return { label: STAGE_LABELS[status] ?? stage?.label ?? status, dot: stage?.dot ?? "bg-zinc-400" };
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function longDate(d: Date) {
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${d.getFullYear()} · ${WEEKDAYS[d.getDay()]}`;
}

function shortDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function ago(value: string, now: Date) {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "hozirgina";
  if (min < 60) return `${min} daq oldin`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} kun oldin`;
  return shortDate(new Date(t));
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
    throw new Error(result?.error ?? "Ma'lumotlarni yuklab bo'lmadi.");
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
  if (loading) return <div className="h-[116px] animate-pulse rounded-xl bg-black/5" />;
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboardData());
      setNow(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchDashboardData()
      .then((result) => {
        if (active) {
          setData(result);
          setNow(new Date());
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Ma'lumotlarni yuklab bo'lmadi.");
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
    ...stageOf(s.id),
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
    const category = candidate?.major?.trim() || vacancy?.major?.trim() || "Tasniflanmagan";
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
  if (waiting.length) attention.push({ text: `${waiting.length} ta yangi ariza hali ko'rib chiqilmagan`, href: "/applicants" });
  if (stale.length) attention.push({ text: `${stale.length} ta ariza ${STALE_DAYS} kundan ortiq javob kutmoqda`, href: "/applicants" });
  if (emptyActive.length) attention.push({ text: `${emptyActive.length} ta faol vakansiyaga hali ariza kelmagan`, href: "/vacancies" });

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Bosh sahifa</h1>
          <p className="text-sm text-zinc-500">
            {now ? `${longDate(now)} · bugun ${newToday} ta yangi ariza` : "Ma'lumotlar yuklanmoqda…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/applicants"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            Arizalarni ko&apos;rish
          </Link>
          <Link
            href="/vacancies"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            Vakansiya qo&apos;shish
          </Link>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="font-medium underline">
            Qayta urinish
          </button>
        </div>
      )}

      {/* what needs a decision right now */}
      {ready && (
        <section aria-label="E'tibor talab qiladi" className="mb-5 rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 className="text-sm font-semibold text-zinc-900">E&apos;tibor talab qiladi</h2>
            <span className="text-xs text-zinc-500">{attention.length ? `${attention.length} ta` : "Hammasi joyida"}</span>
          </div>

          {attention.length === 0 ? (
            <p className="px-5 pb-4 text-sm text-zinc-500">Hozircha shoshilinch ish yo&apos;q: yangi arizalar ko&apos;rib chiqilgan.</p>
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
                      Ko&apos;rish
                    </Link>
                  </li>
                ))}
              </ul>

              {waiting.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-zinc-500">Eng uzoq kutayotganlar</p>
                  <ul className="divide-y divide-zinc-100">
                    {waiting.slice(0, 3).map((a) => {
                      const c = relation(a.candidate);
                      const v = relation(a.vacancy);
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 truncate text-zinc-900">
                            {c?.full_name || "Noma'lum nomzod"}
                            <span className="text-zinc-500"> · {v?.title || "—"}</span>
                          </span>
                          <span className="shrink-0 text-xs text-zinc-500">{ago(a.created_at, now!)}</span>
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
      <section aria-label="Statistika" aria-busy={loading} className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          loading={!ready && !error}
          icon={Inbox}
          title="Yangi arizalar"
          value={num(waiting.length)}
          foot={!ready ? "" : waiting.length && now ? `Eng eskisi: ${ago(waiting[0].created_at, now)}` : "Kutayotgani yo'q"}
        />
        <KpiCard
          loading={!ready && !error}
          icon={CalendarDays}
          title="Shu hafta"
          value={num(thisWeek)}
          foot={
            !ready ? "" : weekDelta === 0 ? (
              "O'tgan haftadek"
            ) : (
              <span className={weekDelta > 0 ? "text-emerald-700" : "text-zinc-500"}>
                {weekDelta > 0 ? "↑" : "↓"} {Math.abs(weekDelta)} ta o&apos;tgan haftaga nisbatan
              </span>
            )
          }
        />
        <KpiCard
          loading={!ready && !error}
          icon={BriefcaseBusiness}
          title="Faol vakansiyalar"
          value={num(activeVacancies.length)}
          foot={ready ? `Jami ${vacancies.length} ta, ${vacancies.length - activeVacancies.length} tasi nofaol` : ""}
        />
        <KpiCard
          loading={!ready && !error}
          icon={UserCheck}
          title="Qabul qilinganlar"
          value={num(hired)}
          foot={!ready ? "" : hireRate === null ? "Hali ariza yo'q" : `Jami arizalarning ${hireRate}%`}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="space-y-5">
          <Card title="Arizalar dinamikasi" subtitle="So'nggi 14 kun">
            {!ready ? (
              <Skeleton className="h-28" />
            ) : (
              <>
                <div
                  role="img"
                  aria-label={`So'nggi 14 kunda ${days.reduce((s, d) => s + d.count, 0)} ta ariza`}
                  className="flex h-28 items-end gap-1.5"
                >
                  {days.map((d, i) => (
                    <div
                      key={i}
                      title={`${shortDate(d.date)}: ${d.count} ta`}
                      className={`flex-1 rounded-sm ${d.count ? "bg-blue-500" : "bg-zinc-200"}`}
                      style={{ height: d.count ? `${Math.max(8, (d.count / maxDay) * 100)}%` : "2px" }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-zinc-500">
                  <span>{shortDate(days[0].date)}</span>
                  <span>Bugun</span>
                </div>
              </>
            )}
          </Card>

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">So&apos;nggi arizalar</h2>
                <p className="mt-0.5 text-xs text-zinc-500">Eng oxirgi 8 ta</p>
              </div>
              <Link
                href="/applicants"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Hammasi
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {!ready && !error && (
              <div className="space-y-2 px-5 pb-5" aria-label="Arizalar yuklanmoqda">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            )}

            {ready && recent.length === 0 && (
              <p className="px-5 pb-5 text-sm text-zinc-500">
                Hozircha arizalar yo&apos;q. Nomzodlar bot orqali ariza topshirganda, ular shu yerda ko&apos;rinadi.
              </p>
            )}

            {ready && recent.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-zinc-100 text-xs font-medium text-zinc-500">
                      <th className="px-5 py-2.5 font-medium">Nomzod</th>
                      <th className="px-4 py-2.5 font-medium">Vakansiya</th>
                      <th className="px-4 py-2.5 font-medium">Yo&apos;nalish</th>
                      <th className="px-4 py-2.5 font-medium">Topshirdi</th>
                      <th className="px-4 py-2.5 font-medium">Bosqich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((a) => {
                      const c = relation(a.candidate);
                      const v = relation(a.vacancy);
                      const name = c?.full_name || "Noma'lum nomzod";
                      const initials = name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase();
                      const stage = stageOf(a.status);

                      return (
                        <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
                                {initials}
                              </span>
                              <span className="text-sm font-medium text-zinc-900">{name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-zinc-700">{v?.title || "—"}</td>
                          <td className="px-4 py-2.5 text-sm text-zinc-500">{c?.major || v?.major || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">{ago(a.created_at, now!)}</td>
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
          <Card title="Tanlov voronkasi" subtitle="Arizalar bosqichlar bo'yicha">
            {!ready ? (
              <Skeleton className="h-40" />
            ) : total === 0 ? (
              <p className="text-sm text-zinc-500">Ariza kelgach, bosqichlar shu yerda ko&apos;rinadi.</p>
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

          <Card title="Vakansiyalar bo'yicha" subtitle="Qaysi vakansiyaga ko'proq ariza keldi" action={{ href: "/vacancies", label: "Hammasi" }}>
            {!ready ? (
              <Skeleton className="h-40" />
            ) : vacancyRows.length === 0 ? (
              <p className="text-sm text-zinc-500">Hali vakansiya qo&apos;shilmagan.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {vacancyRows.slice(0, 5).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        title={v.is_active ? "Faol" : "Nofaol"}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.is_active ? "bg-emerald-500" : "bg-zinc-400"}`}
                      />
                      <span className={`truncate ${v.is_active ? "text-zinc-900" : "text-zinc-500"}`}>{v.title ?? "Vakansiya"}</span>
                    </span>
                    {v.is_active && v.count === 0 ? (
                      <span className="shrink-0 text-xs text-amber-700">ariza yo&apos;q</span>
                    ) : (
                      <span className="shrink-0 tabular-nums text-zinc-900">{v.count}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Yo'nalish bo'yicha" subtitle="Nomzodning mutaxassisligi">
            {!ready ? (
              <Skeleton className="h-32" />
            ) : categoryEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">Hali yo&apos;nalishlar yo&apos;q.</p>
            ) : (
              <ul className="space-y-3.5">
                {categoryEntries.map(([category, count]) => (
                  <li key={category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-zinc-700">{category}</span>
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
