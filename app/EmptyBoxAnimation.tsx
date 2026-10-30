"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function EmptyBoxAnimation() {
  return (
    <DotLottieReact
      src="/EmptyBox.json"
      loop
      autoplay
      className="mx-auto h-80 w-80"
      aria-hidden="true"
    />
  );
}
