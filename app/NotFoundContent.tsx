import Link from "next/link";
import NotFoundAnimation from "./NotFoundAnimation";
import SectionText from "./SectionText";

export default function NotFoundContent() {
  return (
    <main className="flex h-full items-center justify-center px-4 text-slate-900">
      <section className="w-full max-w-md text-center p-4">
        <NotFoundAnimation />
        <p className="mt-2 text-sm text-slate-500">
          <SectionText k="dash.section.notFound" />
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
        >
          <SectionText k="dash.section.back" />
        </Link>
      </section>
    </main>
  );
}
