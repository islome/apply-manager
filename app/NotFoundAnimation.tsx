"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function NotFoundAnimation() {
  return (
    <DotLottieReact
      src="/404-animation.json"
      loop
      autoplay
      className="mx-auto h-56 w-56"
      aria-hidden="true"
    />
  );
}
