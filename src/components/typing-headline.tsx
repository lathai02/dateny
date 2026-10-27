"use client";
import { useEffect, useState } from "react";
import { modeData, type Mode } from "@/features/discovery/config";
import { welcomeMessages } from "@/features/welcome/messages";
import { randomItem } from "@/lib/format";
function TypingHeadline({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (visibleLength >= text.length) return;
    const delay = reduceMotion ? 0 : visibleLength === 0 ? 280 : 48;

    const timer = window.setTimeout(() => {
      setVisibleLength(
        reduceMotion
          ? text.length
          : (length) => Math.min(text.length, length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [text, visibleLength]);

  useEffect(() => {
    if (visibleLength >= text.length) onComplete?.();
  }, [onComplete, text.length, visibleLength]);

  return (
    <h1 className="hero-title-typing" aria-label={text}>
      <span aria-hidden="true" style={{ visibility: "hidden" }}>
        {text}
      </span>
      <span
        className="typing-visible"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0 }}
      >
        {text.slice(0, visibleLength)}
        {visibleLength < text.length && <i className="typing-cursor" />}
      </span>
    </h1>
  );
}

export function RandomModeHeadline({
  mode,
  onComplete,
}: {
  mode: Mode;
  onComplete?: () => void;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setText(randomItem(modeData[mode].titles)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [mode]);

  if (!text) {
    return (
      <h1 className="hero-title-typing" aria-hidden="true">
        <span style={{ visibility: "hidden" }}>{modeData[mode].titles[0]}</span>
      </h1>
    );
  }

  return <TypingHeadline key={text} text={text} onComplete={onComplete} />;
}

const heroSlogan = "Khỏi nghĩ lâu.\nĐể Dateny chọn giúp.";

export function TypingHeroSlogan({
  placeCount,
  start,
}: {
  placeCount: number;
  start: boolean;
}) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (!start || visibleLength >= heroSlogan.length) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const delay = reduceMotion ? 0 : visibleLength === 0 ? 160 : 42;
    const timer = window.setTimeout(() => {
      setVisibleLength(
        reduceMotion
          ? heroSlogan.length
          : (length) => Math.min(heroSlogan.length, length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [start, visibleLength]);

  return (
    <aside
      className="hero-slogan"
      aria-label={`${placeCount} quán gần bạn. Để Dateny chọn giúp.`}
    >
      <p className="hero-slogan-count">
        <strong>{placeCount}</strong>
        <span>quán gần bạn</span>
      </p>
      <h2 className="hero-slogan-typing">
        <span className="hero-slogan-placeholder" aria-hidden="true">
          {heroSlogan}
        </span>
        {start && (
          <span className="typing-visible" aria-hidden="true">
            {heroSlogan.slice(0, visibleLength)}
            {visibleLength < heroSlogan.length && (
              <i className="typing-cursor" />
            )}
          </span>
        )}
      </h2>
    </aside>
  );
}

export function TypingWelcomeMessage() {
  const [text, setText] = useState("");
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setText(randomItem(welcomeMessages)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!text || visibleLength >= text.length) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const delay = reduceMotion ? 0 : visibleLength === 0 ? 240 : 38;
    const timer = window.setTimeout(() => {
      setVisibleLength(
        reduceMotion
          ? text.length
          : (length) => Math.min(text.length, length + 1),
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [text, visibleLength]);

  return (
    <h1 id="welcome-title" className="welcome-typing-message" aria-label={text}>
      <span className="welcome-message-placeholder" aria-hidden="true">
        {text || "\u00a0"}
      </span>
      {text && (
        <span className="typing-visible" aria-hidden="true">
          {text.slice(0, visibleLength)}
          {visibleLength < text.length && <i className="typing-cursor" />}
        </span>
      )}
    </h1>
  );
}
