"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { useApplications } from "@/hooks/useApplications";
import { useT } from "@/i18n/LanguageProvider";
import {
  STAGES,
  applicationsToCsv,
  matchesSearch,
  personName,
  stageLabel,
  type Application,
  type StageId,
} from "@/lib/applications";
import ApplicantCard from "./ApplicantCard";
import ApplicantDetails from "./ApplicantDetails";
import ApplicantList from "./ApplicantList";
import { DownloadIcon, SearchIcon } from "./icons";
import EmptyBoxAnimation from "@/app/EmptyBoxAnimation";

const PAGE = 20; // cards shown per column before "Show more"

type StageFilter = "all" | StageId;
type View = "board" | "list";

export default function ApplicantsBoard() {
  const t = useT();
  const { applications, state, error, move, retry } = useApplications();

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [vacancyId, setVacancyId] = useState("all");
  const [view, setView] = useState<View>("board");
  const [openId, setOpenId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Partial<Record<StageId, number>>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  /* ---------------------------------------------------------- derived data */
  const vacancies = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of applications)
      if (a.vacancy) map.set(a.vacancy.id, a.vacancy.title);
    return Array.from(map, ([id, title]) => ({ id, title })).sort((x, y) =>
      x.title.localeCompare(y.title),
    );
  }, [applications]);

  // search + vacancy applied; the stage chips show counts for exactly this set
  const base = useMemo(
    () =>
      applications.filter(
        (a) =>
          (vacancyId === "all" || a.vacancy_id === vacancyId) &&
          matchesSearch(a, search),
      ),
    [applications, vacancyId, search],
  );

  const byStage = useMemo(() => {
    const groups: Record<StageId, Application[]> = {
      new: [],
      confirmed: [],
      interview: [],
      hired: [],
      cancel: [],
    };
    for (const a of base) groups[a.status].push(a);
    for (const id of Object.keys(groups) as StageId[]) {
      groups[id].sort(
        (x, y) =>
          new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime(),
      );
    }
    return groups;
  }, [base]);

  const listRows = useMemo(
    () => (stage === "all" ? base : byStage[stage]),
    [base, byStage, stage],
  );

  const opened = openId
    ? (applications.find((a) => a.id === openId) ?? null)
    : null;

  /* --------------------------------------------------------------- actions */
  async function moveTo(id: string, target: StageId) {
    const a = applications.find((x) => x.id === id);
    if (!a) return;
    const res = await move(id, target);
    if (res.ok) notify(t("app.movedTo", { name: personName(a), stage: stageLabel(target, t) }));
    else if (res.message) notify(res.message);
  }

  function onDragStart(e: DragEvent<HTMLElement>, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
  }
  function onDragEnd() {
    setDragId(null);
    setOverStage(null);
  }
  function onDrop(e: DragEvent<HTMLElement>, target: StageId) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverStage(null);
    if (id) void moveTo(id, target);
  }

  function exportCsv() {
    const blob = new Blob([applicationsToCsv(listRows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `job-appliers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(t("app.csvDone", { n: listRows.length }));
  }

  /* ---------------------------------------------------------------- render */
  const shownStages =
    stage === "all" ? STAGES : STAGES.filter((s) => s.id === stage);

  return (
    <div className="w-full">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {t("app.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("app.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={state !== "ok" || listRows.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DownloadIcon className="h-4 w-4" />
          {t("app.csv")}
        </button>
      </header>

      {state === "ok" && error && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
        >
          <span>
            {t("app.refreshFailed", { error: error ?? "" })}
          </span>
          <button
            type="button"
            onClick={retry}
            className="rounded-md px-2.5 py-1 font-medium hover:bg-amber-100"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-55 flex-1">
          <span className="sr-only">{t("app.searchLabel")}</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("app.searchPh")}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
          />
        </label>

        <select
          value={vacancyId}
          onChange={(e) => setVacancyId(e.target.value)}
          aria-label={t("app.filterVacancy")}
          className="h-10 max-w-65 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
        >
          <option value="all">{t("app.allVacancies")}</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>

        <div
          className="flex h-10 items-center gap-0.5 rounded-lg bg-zinc-100 p-1"
          role="group"
          aria-label={t("app.view")}
        >
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`h-8 min-w-16 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                view === v
                  ? "bg-white text-zinc-900 ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {v === "board" ? t("app.viewBoard") : t("app.viewList")}
            </button>
          ))}
        </div>
      </div>

      {/* stage filter chips with counts */}
      <div
        className="mb-5 flex flex-wrap gap-1"
        role="group"
        aria-label={t("app.filterStage")}
      >
        <button
          type="button"
          onClick={() => setStage("all")}
          aria-pressed={stage === "all"}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            stage === "all"
              ? "bg-white text-zinc-900 ring-1 ring-zinc-200"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          {t("common.all")}
          <span className="text-xs tabular-nums text-zinc-500">
            {base.length}
          </span>
        </button>
        {STAGES.map((s) => {
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(active ? "all" : s.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-zinc-900 ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {stageLabel(s.id, t)}
              <span className="text-xs tabular-nums text-zinc-500">
                {byStage[s.id].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* body */}
      {state === "loading" && (
        <div
          className="grid grid-flow-col auto-cols-[minmax(248px,1fr)] gap-3 overflow-x-auto"
          aria-busy="true"
        >
          {STAGES.map((s) => (
            <div
              key={s.id}
              className="h-55 animate-pulse rounded-xl bg-zinc-100"
            />
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <h2 className="text-base font-semibold text-zinc-900">
            {t("app.loadFailed")}
          </h2>
          <p className="max-w-sm text-sm text-zinc-500">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t("app.tryAgain")}
          </button>
        </div>
      )}

      {state === "ok" && applications.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <EmptyBoxAnimation />
          <h2 className="text-base font-semibold text-zinc-900">
            {t("app.noneTitle")}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {t("app.noneText")}
          </p>
        </div>
      )}

      {state === "ok" && applications.length > 0 && view === "list" && (
        <ApplicantList
          rows={listRows}
          onOpen={setOpenId}
          onMove={(id, s) => void moveTo(id, s)}
        />
      )}

      {state === "ok" && applications.length > 0 && view === "board" && (
        <div
          className={
            stage === "all"
              ? "grid grid-flow-col auto-cols-[minmax(248px,1fr)] gap-3 overflow-x-auto pb-3"
              : "grid max-w-md grid-cols-1 gap-3 pb-3"
          }
        >
          {shownStages.map((s) => {
            const items = byStage[s.id];
            const limit = limits[s.id] ?? PAGE;
            const over = overStage === s.id;
            return (
              <section
                key={s.id}
                aria-labelledby={`stage-${s.id}`}
                className={`flex min-h-40 flex-col rounded-xl p-2 transition-colors ${
                  over ? "bg-zinc-100 ring-1 ring-zinc-300" : "bg-zinc-100/70"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overStage !== s.id) setOverStage(s.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setOverStage(null);
                }}
                onDrop={(e) => onDrop(e, s.id)}
              >
                <div className="flex items-center justify-between px-2 pb-2.5 pt-1.5">
                  <h2
                    id={`stage-${s.id}`}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-900"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {stageLabel(s.id, t)}
                  </h2>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {items.length}
                  </span>
                </div>

                <div className="flex min-h-0 max-h-[calc(100vh-20rem)] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
                  {items.slice(0, limit).map((a) => (
                    <ApplicantCard
                      key={a.id}
                      a={a}
                      dragging={dragId === a.id}
                      onOpen={setOpenId}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}

                  {items.length === 0 && (
                    <p className="grid flex-1 place-items-center rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
                      {base.length === applications.length
                        ? t("app.dropHere")
                        : t("app.noMatches")}
                    </p>
                  )}

                  {items.length > limit && (
                    <button
                      type="button"
                      onClick={() =>
                        setLimits((l) => ({ ...l, [s.id]: limit + PAGE }))
                      }
                      className="shrink-0 rounded-lg py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                    >
                      {t("app.showMore", { n: items.length - limit })}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ApplicantDetails
        a={opened}
        onClose={() => setOpenId(null)}
        onMove={(id, s) => void moveTo(id, s)}
        onNotify={notify}
      />

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white transition ${
          toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toast}
      </div>
    </div>
  );
}
