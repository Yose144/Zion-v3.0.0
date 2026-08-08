"use client";

import Image from "next/image";
import { ReactNode } from "react";

export default function HeroImage({
  src,
  alt,
  children,
  className = "",
  overlayClassName = "bg-gradient-to-br from-black/85 to-[rgba(6,20,12,0.8)]",
  priority = true,
}: {
  src: string;
  alt: string;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  priority?: boolean;
}) {
  return (
    <section
      className={`relative flex w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-28 text-center ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="-z-10 object-cover"
        quality={80}
        decoding="async"
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center gap-6 px-4">
        {children}
      </div>
    </section>
  );
}
