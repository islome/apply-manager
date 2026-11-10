import { Inbox } from "lucide-react";

/** Quiet empty-state mark (was a Lottie animation; the name is kept so call sites stay the same). */
export default function EmptyBoxAnimation() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-white text-zinc-400 ring-1 ring-zinc-200"
    >
      <Inbox size={20} strokeWidth={1.5} />
    </span>
  );
}
