import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionAnimation from "../SectionAnimation";

const sections = {
  applicants: { title: "Job Applicants" },
  analytics: { title: "Analytics" },
  settings: { title: "Settings" },
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
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f8] px-4 text-slate-900">
      <section className="w-full max-w-md rounded-[21px] border border-slate-200/80 bg-white p-8 text-center shadow-[0_4px_12px_rgba(15,23,42,0.035)]">
        <SectionAnimation className="mx-auto h-64 w-64 max-w-full" />
        <h1 className="text-xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;re still working on this section. Please check back soon.
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

function SectionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f8] px-4 text-slate-900">
      <div className="text-center">
        <SectionAnimation className="mx-auto h-80 w-80 max-w-full" />
        <p className="mt-2 text-sm text-slate-500">Loading section...</p>
      </div>
    </main>
  );
}

export default function SectionPage(props: PageProps<"/[section]">) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <SectionContent {...props} />
    </Suspense>
  );
}
