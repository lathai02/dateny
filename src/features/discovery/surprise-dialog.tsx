"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Coffee, Gift, Store, X } from "lucide-react";
import { SegmentedControl } from "@/components/design-system";
import { DirectionsButton } from "@/components/directions-button";
import { useDialog } from "@/hooks/use-dialog";
import { formatDistance, randomItem } from "@/lib/format";
import type { Place, PlaceCategoryFilter } from "@/lib/places/types";
import { categories, categoryLabels } from "./config";
type SurpriseState =
  | { phase: "choosing"; category: PlaceCategoryFilter }
  | {
      phase: "spinning" | "revealed";
      category: PlaceCategoryFilter;
      place: Place;
      previewPlace: Place;
      step: number;
      total: number;
      poolSize: number;
    };

export default function SurpriseDialog({
  places,
  initialCategory,
  previousPickId,
  onClose: closeSurprise,
  onCategoryChange,
  onSelect,
  onDirections,
}: {
  places: Place[];
  initialCategory: PlaceCategoryFilter;
  previousPickId: string | null;
  onClose: () => void;
  onCategoryChange: (category: PlaceCategoryFilter) => void;
  onSelect: (place: Place) => void;
  onDirections: (place: Place) => void;
}) {
  const [surprise, setSurprise] = useState<SurpriseState>({
    phase: "choosing",
    category: initialCategory,
  });
  const lastSurpriseIdRef = useRef<string | null>(previousPickId);
  const revealTimerRef = useRef<number | null>(null);
  const dialogRef = useDialog<HTMLElement>(closeSurprise);
  useEffect(
    () => () => {
      if (revealTimerRef.current !== null)
        window.clearTimeout(revealTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (surprise.phase === "revealed")
      dialogRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [surprise.phase, dialogRef]);
  const choosingPlaces = places.filter(
    (place) =>
      surprise.category === "all" || place.category === surprise.category,
  );
  function startSurprise(chosenCategory: PlaceCategoryFilter) {
    const pool = places.filter(
      (candidate) =>
        chosenCategory === "all" || candidate.category === chosenCategory,
    );
    if (pool.length === 0) return;
    onCategoryChange(chosenCategory);
    const choices =
      pool.length > 1
        ? pool.filter((place) => place.id !== lastSurpriseIdRef.current)
        : pool;
    const place = randomItem(choices);
    lastSurpriseIdRef.current = place.id;
    if (revealTimerRef.current !== null)
      window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setSurprise({
        place,
        previewPlace: place,
        phase: "revealed",
        category: chosenCategory,
        step: 0,
        total: 1,
        poolSize: pool.length,
      });
      onSelect(place);
      return;
    }

    const total = pool.length === 1 ? 1 : 14;
    const frames: Place[] = [];
    let previousId = place.id;
    for (let index = 0; index < total - 1; index++) {
      const candidates = pool.filter(
        (candidate) => candidate.id !== previousId,
      );
      const preview = randomItem(candidates);
      frames.push(preview);
      previousId = preview.id;
    }
    frames.push(place);
    setSurprise({
      place,
      previewPlace: frames[0],
      phase: "spinning",
      category: chosenCategory,
      step: 0,
      total,
      poolSize: pool.length,
    });

    const advance = (step: number) => {
      if (step === total - 1) {
        revealTimerRef.current = window.setTimeout(
          () => {
            setSurprise({
              place,
              previewPlace: place,
              phase: "revealed",
              category: chosenCategory,
              step,
              total,
              poolSize: pool.length,
            });
            onSelect(place);
            revealTimerRef.current = null;
          },
          total === 1 ? 650 : 480,
        );
        return;
      }
      const progress = (step + 1) / (total - 1);
      const delay = 65 + Math.round(progress ** 2.4 * 360);
      revealTimerRef.current = window.setTimeout(() => {
        const nextStep = step + 1;
        setSurprise({
          place,
          previewPlace: frames[nextStep],
          phase: "spinning",
          category: chosenCategory,
          step: nextStep,
          total,
          poolSize: pool.length,
        });
        advance(nextStep);
      }, delay);
    };
    advance(0);
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSurprise();
      }}
    >
      <section
        ref={dialogRef}
        className="result-modal surprise-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="surprise-title"
      >
        <button
          className="modal-close"
          onClick={closeSurprise}
          aria-label="Đóng túi mù"
        >
          <X size={20} aria-hidden="true" />
        </button>
        {surprise.phase === "choosing" ? (
          <div className="surprise-choosing">
            <span className="surprise-reveal-icon" aria-hidden="true">
              <Gift size={27} />
            </span>
            <h2 id="surprise-title">Bốc túi mù</h2>
            <SegmentedControl
              label="Loại quán cho túi mù"
              options={categories.map((item) => ({
                value: item,
                label: categoryLabels[item],
              }))}
              value={surprise.category}
              onChange={(value) =>
                setSurprise({ phase: "choosing", category: value })
              }
            />
            <p role="status">
              {choosingPlaces.length > 0
                ? `${choosingPlaces.length} quán phù hợp`
                : "Chưa có quán thuộc loại này"}
            </p>
            <div className="modal-actions">
              <button
                className="primary"
                disabled={choosingPlaces.length === 0}
                onClick={() => startSurprise(surprise.category)}
              >
                Bốc quán <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : surprise.phase === "spinning" ? (
          <div
            className="surprise-spinning"
            role="status"
            aria-label="Đang quay chọn quán"
          >
            <span className="overline">Túi mù Dateny</span>
            <h2 id="surprise-title">Đang chọn quán…</h2>
            <div className="spin-window" aria-hidden="true">
              <div
                className="spin-place"
                key={`${surprise.step}-${surprise.previewPlace.id}`}
              >
                <span>{categoryLabels[surprise.previewPlace.category]}</span>
                <strong>{surprise.previewPlace.name}</strong>
              </div>
            </div>
            <div className="spin-track" aria-hidden="true">
              <span
                style={{
                  width: `${((surprise.step + 1) / surprise.total) * 100}%`,
                }}
              />
            </div>
            <p>Đang quay qua {surprise.poolSize} quán</p>
          </div>
        ) : (
          <div className="surprise-revealed" aria-live="polite">
            <span className="surprise-reveal-icon" aria-hidden="true">
              {surprise.place.category === "cafe" ? (
                <Coffee size={28} />
              ) : (
                <Store size={28} />
              )}
            </span>
            <span className="overline">Túi mù đã mở</span>
            <h2 id="surprise-title" tabIndex={-1}>
              {surprise.place.name}
            </h2>
            <p className="surprise-place-meta">
              {categoryLabels[surprise.place.category]} ·{" "}
              {formatDistance(surprise.place.distanceMeters)}
            </p>
            {surprise.place.address && (
              <p className="surprise-place-address">{surprise.place.address}</p>
            )}
            <div className="modal-actions">
              {
                <DirectionsButton
                  place={surprise.place}
                  onClick={() => onDirections(surprise.place)}
                  className="primary modal-directions"
                  label="Xem đường đi"
                />
              }
              <button onClick={() => startSurprise(surprise.category)}>
                <Gift size={17} aria-hidden="true" /> Bốc lại
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
