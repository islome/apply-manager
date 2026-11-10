"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  ChartColumn,
  UserRoundCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  X,
} from "lucide-react";
import Image from "next/image";

import { safeHttpUrl } from "@/lib/applications";
import { useT } from "@/i18n/LanguageProvider";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import type { MessageKey } from "@/i18n/messages";

const navigation = [
  {
    labelKey: "shell.nav.home" as MessageKey,
    href: "/",
    icon: LayoutDashboard,
  },
  {
    labelKey: "shell.nav.vacancies" as MessageKey,
    href: "/vacancies",
    icon: BriefcaseBusiness,
  },
  {
    labelKey: "shell.nav.applicants" as MessageKey,
    href: "/applicants",
    icon: Users,
  },
  {
    labelKey: "shell.nav.employees" as MessageKey,
    href: "/employees",
    icon: UserRoundCheck,
  },
  {
    labelKey: "shell.nav.analytics" as MessageKey,
    href: "/analytics",
    icon: ChartColumn,
  },
];

/**
 * Company shown in the sidebar. `unset` = the profile loaded but has no company name yet,
 * `error` = the request failed (we show nothing rather than a made-up name).
 */
type CompanyState =
  | { status: "loading" }
  | { status: "ok"; name: string; logoUrl: string | null }
  | { status: "unset" }
  | { status: "error" };

function readCompany(data: unknown): { name: string; logoUrl: string | null } {
  const d = data as {
    company_name?: unknown;
    logo_url?: unknown;
  } | null;
  const name = typeof d?.company_name === "string" ? d.company_name.trim() : "";
  const logoUrl = typeof d?.logo_url === "string" && d.logo_url.trim() ? d.logo_url.trim() : null;
  return { name, logoUrl };
}

/** Company logo from `hr_profiles.logo_url`, initial letter if there is none or it fails to load. */
function CompanyAvatar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const src = safeHttpUrl(logoUrl);
  const [failed, setFailed] = useState(false);

  return (
    <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-white text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
      {name.charAt(0).toUpperCase()}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- user-provided URL
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full bg-white object-cover"
        />
      )}
    </span>
  );
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400";

const iconButton = `grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 disabled:opacity-50 ${focusRing}`;

function Brand() {
  return (
    <Link href="/" className={`flex min-w-0 items-center gap-2 rounded-md ${focusRing}`}>
      <Image src="/logo.png" alt="" width={22} height={22} />
      <span className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">JobBor</span>
    </Link>
  );
}

/** Company, language and logout: everything that used to live in the top header. */
function AccountPanel({
  company,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  company: CompanyState;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const t = useT();
  return (
    <div className="border-t border-zinc-200/70 pt-3">
      {company.status === "loading" && (
        <span aria-hidden="true" className="mx-2 block h-9 animate-pulse rounded-md bg-zinc-200/60" />
      )}

      {company.status === "ok" && (
        <Link
          href="/settings"
          onClick={onNavigate}
          title={t("shell.companyProfile")}
          className={`flex h-10 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200/50 ${focusRing}`}
        >
          <CompanyAvatar key={company.logoUrl ?? company.name} name={company.name} logoUrl={company.logoUrl} />
          <span className="truncate">{company.name}</span>
        </Link>
      )}

      {company.status === "unset" && (
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 ${focusRing}`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          <span className="truncate">{t("shell.completeProfile")}</span>
        </Link>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          aria-label={loggingOut ? t("shell.loggingOut") : t("shell.logout")}
          title={loggingOut ? t("shell.loggingOut") : t("shell.logout")}
          className={iconButton}
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function DashboardSidebar({
  headerAction,
  onNavigate,
  applicantCount,
  applicantCountError,
  company,
  onLogout,
  loggingOut,
}: {
  headerAction: ReactNode;
  onNavigate?: () => void;
  applicantCount: number | null;
  applicantCountError: boolean;
  company: CompanyState;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const t = useT();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClass = (active: boolean) =>
    `flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors ${focusRing} ${
      active
        ? "bg-zinc-200/60 font-medium text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-200/40 hover:text-zinc-900"
    }`;

  const iconClass = (active: boolean) => (active ? "text-zinc-900" : "text-zinc-400");

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-3 py-4">
      <div className="flex h-8 items-center justify-between gap-2 pl-2">
        <Brand />
        {headerAction}
      </div>

      <p className="mt-8 px-2.5 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {t("shell.menu")}
      </p>

      <nav className="flex flex-col gap-0.5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={linkClass(active)}
            >
              <Icon size={17} strokeWidth={1.75} className={iconClass(active)} />

              <span className="flex-1 whitespace-nowrap">{t(item.labelKey)}</span>

              {item.href === "/applicants" && applicantCountError && (
                <span
                  title={t("shell.countError")}
                  aria-label={t("shell.countError")}
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                />
              )}
              {item.href === "/applicants" && applicantCount !== null && (
                <span
                  aria-label={t("shell.countLabel", { n: applicantCount })}
                  className="text-xs tabular-nums text-zinc-500"
                >
                  {applicantCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={isActive("/settings") ? "page" : undefined}
          className={linkClass(isActive("/settings"))}
        >
          <Settings size={17} strokeWidth={1.75} className={iconClass(isActive("/settings"))} />
          <span>{t("shell.settings")}</span>
        </Link>

        <AccountPanel company={company} onNavigate={onNavigate} onLogout={onLogout} loggingOut={loggingOut} />
      </div>
    </div>
  );
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [applicantCount, setApplicantCount] = useState<number | null>(null);
  const [applicantCountError, setApplicantCountError] = useState(false);
  const [company, setCompany] = useState<CompanyState>({ status: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);
  const t = useT();
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (pathname === "/login") return;

    let active = true;
    const loadApplicantCount = () => {
      void fetch("/api/hr/applicants/count", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Applicant count request failed (${response.status})`);
          }
          return (await response.json()) as { count: number };
        })
        .then(({ count }) => {
          if (!Number.isInteger(count) || count < 0) {
            throw new Error("Applicant count response was invalid");
          }
          if (active) {
            setApplicantCount(count);
            setApplicantCountError(false);
          }
        })
        .catch((error: unknown) => {
          if (!active) return;
          console.error("[dashboard] Could not load applicant count", error);
          setApplicantCountError(true);
        });
    };

    loadApplicantCount();
    window.addEventListener("focus", loadApplicantCount);
    return () => {
      active = false;
      window.removeEventListener("focus", loadApplicantCount);
    };
  }, [pathname]);

  // Company comes from the HR profile in the database (hr_profiles), never hardcoded.
  // GET /api/hr/profile returns the profile, or null while this HR has none yet.
  // Reloaded on navigation and when Settings saves the profile ("company:updated").
  useEffect(() => {
    if (pathname === "/login") return;

    let active = true;
    const loadCompany = () => {
      void fetch("/api/hr/profile", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Company request failed (${response.status})`);
          }
          return (await response.json()) as unknown;
        })
        .then((data) => {
          if (!active) return;
          const { name, logoUrl } = readCompany(data);
          setCompany(name ? { status: "ok", name, logoUrl } : { status: "unset" });
        })
        .catch((error: unknown) => {
          if (!active) return;
          console.error("[dashboard] Could not load company profile", error);
          setCompany({ status: "error" });
        });
    };

    loadCompany();
    window.addEventListener("company:updated", loadCompany);
    return () => {
      active = false;
      window.removeEventListener("company:updated", loadCompany);
    };
  }, [pathname]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      // The session cookie is HttpOnly, so only the server can clear it.
      const response = await fetch("/api/hr/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(`Logout request failed (${response.status})`);
      }

      // Only after the server session is gone: wipe everything stored in this browser.
      try {
        const savedLang = window.localStorage.getItem("jobbor.lang");
        window.localStorage.clear();
        window.sessionStorage.clear();
        if (savedLang) window.localStorage.setItem("jobbor.lang", savedLang);
      } catch {
        // storage can be blocked (private mode); the server session is already closed
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("[dashboard] Logout failed", error);
      setLogoutError(t("shell.logoutError"));
      setLoggingOut(false);
    }
  }

  if (pathname === "/login") return children;

  const sidebarProps = {
    applicantCount,
    applicantCountError,
    company,
    onLogout: () => void handleLogout(),
    loggingOut,
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile and tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200/70 bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((previous) => !previous)}
            aria-label={mobileSidebarOpen ? t("shell.sidebar.close") : t("shell.sidebar.open")}
            aria-expanded={mobileSidebarOpen}
            className={`${iconButton} -ml-1.5`}
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
          <Brand />
        </div>

        {company.status === "ok" && (
          <Link
            href="/settings"
            title={t("shell.companyProfile")}
            className={`flex min-w-0 items-center gap-2 rounded-md text-sm font-medium text-zinc-700 ${focusRing}`}
          >
            <span className="hidden truncate sm:inline">{company.name}</span>
            <CompanyAvatar key={company.logoUrl ?? company.name} name={company.name} logoUrl={company.logoUrl} />
          </Link>
        )}
        {company.status === "unset" && (
          <Link
            href="/settings"
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50 ${focusRing}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            {t("shell.profileShort")}
          </Link>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-zinc-200/70 bg-canvas transition-transform duration-300 ease-out lg:block ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <DashboardSidebar
          {...sidebarProps}
          headerAction={
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label={t("shell.sidebar.close")}
              aria-expanded={sidebarOpen}
              className={iconButton}
            >
              <PanelLeftClose size={16} strokeWidth={1.75} />
            </button>
          }
        />
      </aside>

      {/* Desktop: reopen the collapsed sidebar */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label={t("shell.sidebar.open")}
        aria-expanded={sidebarOpen}
        tabIndex={sidebarOpen ? -1 : 0}
        className={`fixed left-4 top-4 z-20 hidden h-9 w-9 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-opacity duration-300 hover:text-zinc-900 lg:grid ${focusRing} ${
          sidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <PanelLeftOpen size={16} strokeWidth={1.75} />
      </button>

      {/* Mobile and tablet drawer */}
      <div
        aria-hidden={!mobileSidebarOpen}
        inert={!mobileSidebarOpen}
        className={`fixed inset-0 z-40 lg:hidden ${mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          type="button"
          aria-label={t("shell.nav.close")}
          tabIndex={mobileSidebarOpen ? 0 : -1}
          onClick={() => setMobileSidebarOpen(false)}
          className={`absolute inset-0 bg-zinc-950/25 backdrop-blur-[2px] transition-opacity duration-300 ${
            mobileSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`absolute inset-y-0 left-0 w-[min(288px,85vw)] border-r border-zinc-200 bg-canvas shadow-overlay transition-transform duration-300 ease-out ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <DashboardSidebar
            {...sidebarProps}
            onNavigate={() => setMobileSidebarOpen(false)}
            headerAction={
              <button
                type="button"
                aria-label={t("shell.sidebar.close")}
                onClick={() => setMobileSidebarOpen(false)}
                className={iconButton}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            }
          />
        </div>
      </div>

      {/* Current page */}
      <div className={`transition-[padding] duration-300 ease-out ${sidebarOpen ? "lg:pl-60" : "lg:pl-14"}`}>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {logoutError && (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
            >
              {logoutError}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
