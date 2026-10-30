import Link from "next/link";
import NotFoundAnimation from "../NotFoundAnimation";

export default function SectionNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-slate-900">
      <section className="w-full max-w-md rounded-[21px] border border-slate-200/80 bg-white p-8 text-center shadow-[0_4px_12px_rgba(15,23,42,0.035)]">
        <NotFoundAnimation />
        <p className="mt-2 text-sm text-slate-500">
          This section could not be found.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
        >
          Return to overview
        </Link>
      </section>
    </main>
  );
}
