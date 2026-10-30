"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle,
  Clock,
  Users,
} from "lucide-react";

type Vacancy = {
  id: string;
  is_active: boolean;
};

type Candidate = {
  full_name: string;
  major: string | null;
};

type Application = {
  id: string;
  status: string;
  created_at: string;
  candidate: Candidate | Candidate[] | null;
  vacancy: { title: string; major: string } | { title: string; major: string }[] | null;
};

type DashboardData = {
  vacancies: Vacancy[];
  applications: Application[];
};

type StatCardProps = {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
  color: "indigo" | "sky" | "emerald" | "amber";
};

const statStyles: Record<StatCardProps["color"], string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  sky: "bg-sky-50 text-sky-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
};

function StatCard({ title, value, description, icon: Icon, color }: StatCardProps) {
  return (
    <article className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.035)] sm:p-[17px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-slate-500">{title}</h2>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${statStyles[color]}`}>
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </article>
  );
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string) {
  switch (status) {
    case "new":
      return "New";
    case "reviewed":
      return "Reviewed";
    case "shortlisted":
      return "Shortlisted";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "new":
      return "bg-indigo-50 text-indigo-700";
    case "reviewed":
      return "bg-amber-50 text-amber-700";
    case "shortlisted":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
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
    throw new Error(result?.error ?? "Could not load dashboard data.");
  }

  const [vacancies, applications] = (await Promise.all([
    vacanciesResponse.json(),
    applicationsResponse.json(),
  ])) as [Vacancy[], Application[]];

  return { vacancies, applications };
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboardData());
      setToday(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dashboard data.");
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
          setToday(new Date());
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load dashboard data.",
          );
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
  const activeVacancies = vacancies.filter((vacancy) => vacancy.is_active).length;
  const newToday = today
    ? applications.filter((application) => {
        const appliedAt = new Date(application.created_at);
        return (
          appliedAt.getFullYear() === today.getFullYear() &&
          appliedAt.getMonth() === today.getMonth() &&
          appliedAt.getDate() === today.getDate()
        );
      }).length
    : 0;

  const categories = applications.reduce<Record<string, number>>((counts, application) => {
    const candidate = relation(application.candidate);
    const vacancy = relation(application.vacancy);
    const category = candidate?.major?.trim() || vacancy?.major?.trim() || "Uncategorized";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
  const categoryEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const maxCategoryCount = Math.max(1, ...categoryEntries.map(([, count]) => count));
  const recentApplicants = [...applications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const stats: StatCardProps[] = [
    {
      title: "Applicants",
      value: applications.length,
      description: "Total applications",
      icon: Users,
      color: "indigo",
    },
    {
      title: "Vacancies",
      value: vacancies.length,
      description: "Total posted",
      icon: BriefcaseBusiness,
      color: "sky",
    },
    {
      title: "Active vacancies",
      value: activeVacancies,
      description: `${vacancies.length - activeVacancies} inactive`,
      icon: CheckCircle,
      color: "emerald",
    },
    {
      title: "New today",
      value: newToday,
      description: "Applications received today",
      icon: Clock,
      color: "amber",
    },
  ];

  return (
    <main className="min-h-full bg-[#f3f4f8] px-4 py-6 text-slate-900 sm:px-5">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-slate-500">
              {today
                ? `Dashboard data from ${new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(today)}`
                : "Loading dashboard data…"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/applicants")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View applicants
            <ArrowUpRight size={16} />
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => void load()} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <section
          aria-label="Dashboard statistics"
          aria-busy={loading}
          className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-4"
        >
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          <section className="overflow-hidden rounded-[21px] border border-slate-200/80 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.035)]">
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-5">
              <div>
                <h2 className="text-base font-bold tracking-tight">Recent Applicants</h2>
                <p className="mt-1 text-xs text-slate-500">Latest applications from the database</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/applicants")}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View all
                <ArrowUpRight size={14} />
              </button>
            </div>

            {loading && (
              <div className="space-y-3 px-5 pb-5" aria-label="Loading applicants">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            )}

            {!loading && !error && recentApplicants.length === 0 && (
              <p className="px-5 pb-5 text-sm text-slate-500">No applicants yet.</p>
            )}

            {!loading && recentApplicants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-slate-100 text-[11px] font-semibold text-slate-500">
                      <th className="px-5 py-3">Applicant</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Vacancy</th>
                      <th className="px-4 py-3">Applied</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentApplicants.map((application) => {
                      const candidate = relation(application.candidate);
                      const vacancy = relation(application.vacancy);
                      const name = candidate?.full_name || "Unknown applicant";
                      const initials = name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase();

                      return (
                        <tr key={application.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                                {initials}
                              </span>
                              <span className="text-sm font-semibold text-slate-900">{name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {candidate?.major || vacancy?.major || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{vacancy?.title || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {formatDate(application.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle(application.status)}`}>
                              {statusLabel(application.status)}
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

          <section className="rounded-[21px] border border-slate-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.035)] sm:p-5">
            <h2 className="text-base font-bold tracking-tight">Applicants by category</h2>
            <p className="mt-1 text-xs text-slate-500">Grouped by candidate major</p>

            {loading && (
              <div className="mt-5 space-y-4" aria-label="Loading applicant categories">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            )}

            {!loading && !error && categoryEntries.length === 0 && (
              <p className="mt-5 text-sm text-slate-500">No applicant categories yet.</p>
            )}

            {!loading && categoryEntries.length > 0 && (
              <ul className="mt-5 space-y-4">
                {categoryEntries.slice(0, 8).map(([category, count]) => (
                  <li key={category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700">{category}</span>
                      <span className="shrink-0 font-semibold text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
