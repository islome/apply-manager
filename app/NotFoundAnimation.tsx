"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

/** Animated 404 illustration (public/404-animation.json). */
export default function NotFoundAnimation() {
  return (
    <DotLottieReact
      src="/404-animation.json"
      loop
      autoplay
      className="mx-auto h-56 w-56 max-w-full"
      aria-hidden="true"
    />
  );
}
