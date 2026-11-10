import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionAnimation from "../SectionAnimation";
import SectionText from "../SectionText";

const sections = {
  applicants: { title: "dash.section.applicants" },
  analytics: { title: "dash.section.analytics" },
  settings: { title: "dash.section.settings" },
} as const;

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

async function SectionContent({
  params,
}: PageProps<"/[section]">) {
  const { section } = await params;
  const page = sections[section as keyof typeof sections];

  if (!page) notFound();

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-zinc-900">
      <section className="w-full max-w-sm text-center">
        <SectionAnimation className="mb-5" />
        <h1 className="text-lg font-semibold tracking-tight"><SectionText k={page.title} /></h1>
        <p className="mt-2 text-sm text-zinc-500">
          <SectionText k="dash.section.wip" />
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

function SectionLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-zinc-900">
      <div className="animate-pulse text-center">
        <SectionAnimation className="mb-3" />
        <p className="mt-2 text-sm text-zinc-500"><SectionText k="dash.section.loading" /></p>
      </div>
    </div>
  );
}

export default function SectionPage(props: PageProps<"/[section]">) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <SectionContent {...props} />
    </Suspense>
  );
}
