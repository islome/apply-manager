/** Typographic 404 mark (was a Lottie animation; the name is kept so call sites stay the same). */
export default function NotFoundAnimation() {
  return (
    <p
      aria-hidden="true"
      className="mx-auto mb-2 select-none text-7xl font-semibold tracking-tighter text-zinc-200 tabular-nums"
    >
      404
    </p>
  );
}
