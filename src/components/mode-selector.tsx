"use client";

import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export type ModeOption = {
  id: "solo" | "couple" | "friends";
  label: string;
  icon: LucideIcon;
};

export function ModeSelector({
  options,
  selected,
  onSelect,
}: {
  options: ModeOption[];
  selected: ModeOption["id"];
  onSelect: (mode: ModeOption["id"]) => void;
}) {
  return (
    <div
      className={`mode-grid selected-${selected}`}
      aria-label="Chọn kiểu đi chơi"
    >
      <span className="mode-selection-lens" aria-hidden="true" />
      {options.map(({ id, label, icon: Icon }) => (
        <Link
          className={`mode-tile tile-${id}${selected === id ? " is-previewed" : ""}`}
          href={`/goi-y/${id}`}
          key={id}
          onMouseEnter={() => onSelect(id)}
          onFocus={() => onSelect(id)}
          onClick={() => onSelect(id)}
        >
          <span className="mode-icon">
            <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="mode-copy">
            <strong className="mode-label">{label}</strong>
          </span>
          <span className="mode-arrow">
            <ArrowUpRight size={20} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}
