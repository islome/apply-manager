import Link from "next/link";
import NotFoundAnimation from "./NotFoundAnimation";
import SectionText from "./SectionText";

export default function NotFoundContent() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center px-4 text-zinc-900">
      <section className="w-full max-w-sm text-center">
        <NotFoundAnimation />
        <p className="mt-2 text-sm text-zinc-500">
          <SectionText k="dash.section.notFound" />
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          <SectionText k="dash.section.back" />
        </Link>
      </section>
    </div>
  );
}
