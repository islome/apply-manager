"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  ChartColumn,
  Settings,
  PanelLeft,
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
    labelKey: "shell.nav.analytics" as MessageKey,
    href: "/analytics",
    icon: ChartColumn,
  },
];

/**
 * Company shown in the header. `unset` = the profile loaded but has no company name yet,
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
    <span className="relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-zinc-100 text-xs font-semibold text-zinc-600">
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

const ghostButton =
  "flex h-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";

function DashboardHeader({
  sidebarOpen,
  mobileSidebarOpen,
  onToggleSidebar,
  onToggleMobileSidebar,
  company,
  onLogout,
  loggingOut,
}: {
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  company: CompanyState;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const t = useT();
  return (
    <header className="relative z-30 flex h-14 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 sm:px-4">
      {/* Left: toggle + logo */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label={mobileSidebarOpen ? t("shell.sidebar.close") : t("shell.sidebar.open")}
          aria-expanded={mobileSidebarOpen}
          className={`${ghostButton} w-9 shrink-0 lg:hidden`}
        >
          {mobileSidebarOpen ? (
            <PanelLeft size={18} strokeWidth={1.5} />
          ) : (
            <Menu size={18} strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? t("shell.sidebar.close") : t("shell.sidebar.open")}
          aria-expanded={sidebarOpen}
          className={`${ghostButton} hidden w-9 shrink-0 lg:flex`}
        >
          {sidebarOpen ? (
            <PanelLeft size={18} strokeWidth={1.5} />
          ) : (
            <Menu size={18} strokeWidth={1.5} />
          )}
        </button>

        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Image src="/logo.png" alt="" width={24} height={24} />
          <span className="truncate text-base font-semibold tracking-tight text-zinc-900">
            JobBor
          </span>
        </Link>
      </div>

      {/* Right: company + logout */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {company.status === "loading" && (
          <span
            aria-hidden="true"
            className="h-9 w-28 animate-pulse rounded-lg bg-black/5"
          />
        )}

        {company.status === "ok" && (
          <Link
            href="/settings"
            title={t("shell.companyProfile")}
            className="flex h-9 max-w-[200px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <CompanyAvatar key={company.logoUrl ?? company.name} name={company.name} logoUrl={company.logoUrl} />
            <span className="hidden truncate sm:inline">{company.name}</span>
          </Link>
        )}

        {company.status === "unset" && (
          <Link
            href="/settings"
            className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span className="hidden sm:inline">{t("shell.completeProfile")}</span>
            <span className="sm:hidden">{t("shell.profileShort")}</span>
          </Link>
        )}

        <LanguageSwitcher />

        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span className="hidden sm:inline">{loggingOut ? t("shell.loggingOut") : t("shell.logout")}</span>
        </button>
      </div>
    </header>
  );
}

function DashboardSidebar({
  onNavigate,
  applicantCount,
  applicantCountError,
}: {
  onNavigate?: () => void;
  applicantCount: number | null;
  applicantCountError: boolean;
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
    `flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
      active
        ? "bg-zinc-100 text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
    }`;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-xl border border-zinc-200 bg-white p-3">
      <div className="px-3 pb-2 pt-1">
        <p className="text-xs font-medium text-zinc-500">{t("shell.menu")}</p>
      </div>

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
              <Icon
                size={18}
                strokeWidth={1.5}
                className={active ? "text-blue-600" : "text-zinc-500"}
              />

              <span className="flex-1 whitespace-nowrap">{t(item.labelKey)}</span>

              {item.href === "/applicants" && applicantCountError && (
                <span
                  title={t("shell.countError")}
                  className="flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-50 px-1.5 text-xs font-medium text-amber-700"
                >
                  !
                </span>
              )}
              {item.href === "/applicants" && applicantCount !== null && (
                <span
                  aria-label={t("shell.countLabel", { n: applicantCount })}
                  className="flex h-5 min-w-5 items-center justify-center rounded-md bg-blue-50 px-1.5 text-xs font-medium tabular-nums text-blue-700"
                >
                  {applicantCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-100 pt-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={isActive("/settings") ? "page" : undefined}
          className={linkClass(isActive("/settings"))}
        >
          <Settings
            size={18}
            strokeWidth={1.5}
            className={isActive("/settings") ? "text-blue-600" : "text-zinc-500"}
          />
          <span>{t("shell.settings")}</span>
        </Link>
      </div>
    </aside>
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

  return (
    <div className="min-h-screen bg-[#f3f4f8]">
      <div className="mx-auto min-h-screen max-w-[1600px] px-3 py-4 sm:px-5 lg:px-7">
        {/* Global header */}
        <DashboardHeader
          sidebarOpen={sidebarOpen}
          mobileSidebarOpen={mobileSidebarOpen}
          onToggleSidebar={() => setSidebarOpen((previous) => !previous)}
          onToggleMobileSidebar={() => setMobileSidebarOpen((previous) => !previous)}
          company={company}
          onLogout={() => void handleLogout()}
          loggingOut={loggingOut}
        />

        {logoutError && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            {logoutError}
          </p>
        )}

        <div className="relative mt-4 flex items-start gap-4">
          {/* Desktop sidebar */}
          <div
            aria-hidden={!sidebarOpen}
            className={`
              hidden shrink-0 self-stretch lg:block
              transition-[width,opacity,margin] duration-300 ease-in-out
              ${
                sidebarOpen
                  ? "w-[228px] opacity-100"
                  : "pointer-events-none -ml-4 w-0 opacity-0"
              }
            `}
          >
            <div
              className={`
                sticky top-4 h-[calc(100vh-104px)] min-h-[400px]
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? "translate-x-0" : "-translate-x-4"}
              `}
            >
              <DashboardSidebar
                applicantCount={applicantCount}
                applicantCountError={applicantCountError}
              />
            </div>
          </div>

          {/* Mobile and tablet sidebar */}
          <div
            aria-hidden={!mobileSidebarOpen}
            inert={!mobileSidebarOpen}
            className={`
              fixed inset-0 z-40 lg:hidden
              ${mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"}
            `}
          >
            {/* Overlay */}
            <button
              type="button"
              aria-label={t("shell.nav.close")}
              tabIndex={mobileSidebarOpen ? 0 : -1}
              onClick={() => setMobileSidebarOpen(false)}
              className={`
                absolute inset-0 bg-zinc-900/30
                transition-opacity duration-300
                ${mobileSidebarOpen ? "opacity-100" : "opacity-0"}
              `}
            />

            {/* Drawer */}
            <div
              className={`
                absolute bottom-3 left-3 top-3
                w-[min(290px,calc(100vw-24px))]
                transition-transform duration-300 ease-in-out
                ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-[110%]"}
              `}
            >
              <div className="mb-3 flex h-12 items-center justify-between rounded-xl border border-zinc-200 bg-white px-4">
                <span className="text-sm font-semibold text-zinc-900">
                  Navigatsiya
                </span>

                <button
                  type="button"
                  aria-label={t("shell.sidebar.close")}
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="h-[calc(100%-60px)]">
                <DashboardSidebar
                  onNavigate={() => setMobileSidebarOpen(false)}
                  applicantCount={applicantCount}
                  applicantCountError={applicantCountError}
                />
              </div>
            </div>
          </div>

          {/* Current page */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
