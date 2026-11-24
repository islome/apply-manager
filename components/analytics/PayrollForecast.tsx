"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
import { LOCALES } from "@/i18n/types";
import Avatar from "@/components/applicants/Avatar";
import { employeeSalary } from "@/lib/employees";
import type { CurrencyPayroll, PayrollStats } from "@/lib/analytics";

/** Next month's salary bill per currency, the recent-pace projection, and the 3 best-paid people. */
export default function PayrollForecast({
  payroll,
  notInPanel,
  loading,
  pct,
}: {
  payroll: PayrollStats | null;
  /** company headcount people the panel has no record of (no salary known) */
  notInPanel: number;
  loading: boolean;
  pct: (n: number | null) => string;
}) {
  const { lang, t } = useLanguage();
  const money = (n: number, c: CurrencyPayroll["currency"]) => employeeSalary({ salary: n, salary_currency: c }, t);
  const month = payroll?.month.toLocaleDateString(LOCALES[lang], { month: "long", year: "numeric" }) ?? "";
  const p = payroll;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white">
      <div className="px-5 pb-4 pt-5">
        <h2 className="text-sm font-medium text-zinc-900">{t("an.pay.title")}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{p ? t("an.pay.subtitle", { month }) : " "}</p>
      </div>

      <div className="px-5 pb-5">
        {loading || !p ? (
          <div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
            <div className="h-40 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ) : p.byCurrency.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {t("an.pay.empty")}{" "}
            <Link href="/employees/company" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2">
              {t("an.pay.openEmployees")}
            </Link>
          </p>
        ) : (
          <div className="space-y-6">
            {p.byCurrency.map((c, i) => {
              const change = c.addedPerMonth - c.removedPerMonth;
              return (
                <div
                  key={c.currency}
                  className={`grid gap-6 md:grid-cols-2 ${i > 0 ? "border-t border-zinc-100 pt-6" : ""}`}
                >
                  {/* the bill */}
                  <div>
                    <p className="text-xs text-zinc-500">
                      {t("an.pay.needed")}
                      {p.byCurrency.length > 1 && <span className="ml-1.5 font-medium text-zinc-700">{c.currency}</span>}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">
                      {money(c.committed, c.currency)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("an.pay.neededFoot", { n: c.people, year: money(c.committed * 12, c.currency) })}
                    </p>

                    <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3">
                      <p className="text-xs text-zinc-500">{t("an.pay.pace")}</p>
                      {change === 0 && c.addedPerMonth === 0 ? (
                        <p className="mt-1 text-sm text-zinc-700">{t("an.pay.paceNone")}</p>
                      ) : (
                        <>
                          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                            ≈ {money(c.projected, c.currency)}
                            <span className={`ml-2 text-xs font-medium ${change > 0 ? "text-amber-700" : change < 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                              {change > 0 ? "+" : change < 0 ? "−" : "±"}
                              {money(Math.abs(change), c.currency)}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {t("an.pay.paceFoot", {
                              added: money(c.addedPerMonth, c.currency),
                              removed: money(c.removedPerMonth, c.currency),
                            })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* who costs the most */}
                  <div>
                    <p className="mb-2 text-xs text-zinc-500">{t("an.pay.top")}</p>
                    {c.top.length === 0 ? (
                      <p className="text-sm text-zinc-500">{t("an.pay.topNone")}</p>
                    ) : (
                      <ol className="divide-y divide-zinc-100">
                        {c.top.map((e, rank) => (
                          <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                            <span className="w-3 shrink-0 text-xs tabular-nums text-zinc-400">{rank + 1}</span>
                            <Avatar name={e.full_name} url={e.photo_url} className="h-8 w-8 text-xs" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900">{e.full_name}</p>
                              <p className="truncate text-xs text-zinc-500">{e.position || "—"}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-medium tabular-nums text-zinc-900">{money(e.salary, e.salary_currency)}</p>
                              <p className="text-xs tabular-nums text-zinc-500">
                                {t("an.pay.share", { pct: pct(c.committed ? (e.salary / c.committed) * 100 : null) })}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              );
            })}

            {(p.noSalary > 0 || notInPanel > 0) && (
              <p className="border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                {p.noSalary > 0 && (
                  <>
                    {t("an.pay.noSalary", { n: p.noSalary })}{" "}
                    <Link href="/employees/company" className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">
                      {t("an.pay.openEmployees")}
                    </Link>
                    {notInPanel > 0 && " · "}
                  </>
                )}
                {notInPanel > 0 && t("an.pay.notInPanel", { n: notInPanel })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
