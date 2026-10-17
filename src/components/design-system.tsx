"use client";

import { useLayoutEffect, useRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes("glass-panel", className)} {...props} />;
}

export function GlassButton({ className, variant = "glass", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "glass" | "primary" | "soft";
}) {
  return <button className={classes("ui-button", `ui-button--${variant}`, className)} {...props} />;
}

export function FilterChip({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return <button className={classes("filter-chip", active && "is-active", className)} aria-pressed={active} {...props} />;
}

export function SegmentedControl<T extends string | number>({ label, options, value, onChange, className }: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const indicator = indicatorRef.current;
    if (!track || !indicator) return;
    const positionIndicator = () => {
      const active = track.querySelector<HTMLButtonElement>(".filter-chip.is-active");
      if (!active) return;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translate3d(${active.offsetLeft}px, 0, 0)`;
      indicator.style.opacity = "1";
    };
    positionIndicator();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(positionIndicator);
    observer?.observe(track);
    window.addEventListener("resize", positionIndicator);
    return () => { observer?.disconnect(); window.removeEventListener("resize", positionIndicator); };
  }, [value, options.length]);

  return (
    <div className={classes("segmented-control", className)} role="group" aria-label={label}>
      <div className="segmented-scroll">
        <div className="segmented-track" ref={trackRef}>
          <span className="segmented-indicator" ref={indicatorRef} aria-hidden="true" />
          {options.map((option) => <FilterChip className="segmented-option" active={value === option.value} onClick={() => onChange(option.value)} key={option.value}>{option.label}</FilterChip>)}
        </div>
      </div>
    </div>
  );
}
