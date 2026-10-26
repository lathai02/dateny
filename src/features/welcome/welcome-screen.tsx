"use client";
import { useState } from "react";
import { ModeSelector } from "@/components/mode-selector";
import { TypingWelcomeMessage } from "@/components/typing-headline";
import { modeData, type Mode } from "@/features/discovery/config";
export default function WelcomeScreen() {
  const modes = Object.entries(modeData) as [Mode, (typeof modeData)[Mode]][];
  const [previewMode, setPreviewMode] = useState<Mode>("solo");
  return (
    <main className={`welcome-page theme-${previewMode}`}>
      <div className="welcome-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <header className="welcome-nav">
        <span className="logo-mark">D</span>
        <span className="logo-word">Dateny</span>
      </header>
      <section className="welcome-main" aria-labelledby="welcome-title">
        <div className="welcome-heading">
          <TypingWelcomeMessage />
        </div>
        <div className="mode-stage">
          <ModeSelector
            options={modes.map(([id, item]) => ({
              id,
              label: item.optionLabel,
              icon: item.icon,
            }))}
            selected={previewMode}
            onSelect={setPreviewMode}
          />
        </div>
      </section>
    </main>
  );
}
