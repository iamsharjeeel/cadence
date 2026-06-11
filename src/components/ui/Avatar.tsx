"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  email,
  src,
  size = 36,
  className,
}: {
  name: string | null;
  email: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(!src);
  const dimension = { width: size, height: size };

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--line)] text-[var(--accent-strong)] font-display text-xs font-semibold",
        className,
      )}
      style={dimension}
    >
      {src ? (
        <>
          {!loaded && (
            <span className="absolute inset-0 animate-pulse bg-[var(--line)]" />
          )}
          <img
            src={src}
            alt={name ?? email}
            width={size}
            height={size}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity",
              loaded ? "opacity-100" : "opacity-0",
            )}
            referrerPolicy="no-referrer"
          />
        </>
      ) : (
        <span className="bg-[var(--accent-soft)]">{initials(name, email)}</span>
      )}
    </span>
  );
}
