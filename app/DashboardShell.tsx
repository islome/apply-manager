"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  ChartColumn,
  Settings,
  PanelLeft,
  Menu,
  LogOut,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";

const navigation = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Vacancies",
    href: "/vacancies",
    icon: BriefcaseBusiness,
  },
  {
    label: "Job Applicants",
    href: "/applicants",
    icon: Users,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: ChartColumn,
  },
];

function DashboardHeader({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="relative z-30 flex h-[60px] items-center justify-between rounded-full border border-slate-200/80 bg-white px-3 shadow-[0_4px_16px_rgba(15,23,42,0.055)] sm:px-5">
      {/* Left: toggle + logo */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={sidebarOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {sidebarOpen ? (
            <PanelLeft size={19} strokeWidth={1.8} />
          ) : (
            <Menu size={20} strokeWidth={1.8} />
          )}
        </button>

        <Link href="/" className="flex min-w-0 items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <Image src="/logo.png" alt="Logo" width={25} height={25} />
          </div>

          <span className="truncate text-[17px] font-bold tracking-tight text-[#171923]">
            JobBor
          </span>
        </Link>
      </div>

      {/* Right: company + logout */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="flex h-9 max-w-[155px] items-center gap-2 rounded-full bg-slate-100 px-2.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200 sm:px-3"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-rose-500">
            C
          </span>

          <span className="hidden truncate sm:inline">Canon Group</span>

          <span className="sm:hidden">Canon</span>
        </button>

        <button
          type="button"
          onClick={() => {
            // Keyingi bosqichda Supabase Auth signOut() ulanadi.
            console.log("Logout clicked");
          }}
          className="flex h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:px-4"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
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
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-[26px] border border-slate-200/80 bg-white p-3 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="px-2 pb-3 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
          Menu
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`
                flex h-10 w-full items-center gap-3
                rounded-xl px-3 text-sm font-semibold
                transition-colors duration-200
                ${
                  active
                    ? "bg-indigo-50 text-blue-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }
              `}
            >
              <Icon size={19} strokeWidth={1.8} />

              <span className="flex-1 whitespace-nowrap">{item.label}</span>

              {item.href === "/applicants" && applicantCountError && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white">
                  !
                </span>
              )}
              {item.href === "/applicants" && applicantCount !== null && (
                <span
                  aria-label={`${applicantCount} applicants`}
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white"
                >
                  {applicantCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 pt-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`
            flex h-10 w-full items-center gap-3
            rounded-xl px-3 text-sm font-semibold
            transition-colors
            ${
              isActive("/settings")
                ? "bg-indigo-50 text-blue-600"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }
          `}
        >
          <Settings size={19} strokeWidth={1.8} />
          <span>Settings</span>
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
  const pathname = usePathname();
  const [applicantCount, setApplicantCount] = useState<number | null>(null);
  const [applicantCountError, setApplicantCountError] = useState(false);

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

  if (pathname === "/login") return children;

  return (
    <div className="min-h-screen bg-[#f3f4f8]">
      <div className="mx-auto min-h-screen max-w-[1600px] px-3 py-3 sm:px-5 sm:py-4 lg:px-7">
        {/* Global header */}
        <DashboardHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((previous) => !previous)}
        />

        <div className="relative mt-4 flex items-start gap-[15px]">
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
            aria-hidden={!sidebarOpen}
            className={`
              fixed inset-0 z-40 lg:hidden
              ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}
            `}
          >
            {/* Overlay */}
            <button
              type="button"
              aria-label="Close navigation"
              tabIndex={sidebarOpen ? 0 : -1}
              onClick={() => setSidebarOpen(false)}
              className={`
                absolute inset-0 bg-slate-950/30
                transition-opacity duration-300
                ${sidebarOpen ? "opacity-100" : "opacity-0"}
              `}
            />

            {/* Drawer */}
            <div
              className={`
                absolute bottom-3 left-3 top-3
                w-[min(290px,calc(100vw-24px))]
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? "translate-x-0" : "-translate-x-[110%]"}
              `}
            >
              <div className="mb-3 flex h-12 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                <span className="text-sm font-bold text-slate-900">
                  Navigation
                </span>

                <button
                  type="button"
                  aria-label="Close sidebar"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="h-[calc(100%-60px)]">
                <DashboardSidebar
                  onNavigate={() => setSidebarOpen(false)}
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
