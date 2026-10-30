"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function SectionAnimation({
  className,
}: {
  className: string;
}) {
  return (
    <DotLottieReact
      src="/loading-animation.json"
      loop
      autoplay
      className={className}
      aria-hidden="true"
    />
  );
}
