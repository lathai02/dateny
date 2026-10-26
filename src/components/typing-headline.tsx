"use client";
import { useEffect, useState } from "react";
import { modeData, type Mode } from "@/features/discovery/config";
import { welcomeMessages } from "@/features/welcome/messages";
import { randomItem } from "@/lib/format";
function TypingHeadline({ text }: { text: string }) {
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

export function RandomModeHeadline({ mode }: { mode: Mode }) {
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

  return <TypingHeadline key={text} text={text} />;
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
