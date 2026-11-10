import { Sparkles } from "lucide-react";

/** Quiet placeholder mark (was a Lottie animation; the name and props are kept for the call sites). */
export default function SectionAnimation({
  className,
}: {
  className: string;
}) {
  return (
    <span aria-hidden="true" className={`grid place-items-center ${className}`}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-zinc-400 ring-1 ring-zinc-200">
        <Sparkles size={20} strokeWidth={1.5} />
      </span>
    </span>
  );
}
