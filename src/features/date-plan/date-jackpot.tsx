"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clapperboard,
  Coffee,
  Footprints,
  Gift,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useDialog } from "@/hooks/use-dialog";
import { getJson } from "@/lib/http/client";
import { SegmentedControl } from "@/components/design-system";
import {
  createDatePlan,
  type DateBudget,
  type DateDuration,
  type DatePlan,
  type DateSpot,
} from "@/lib/places/date-plan";
import type { Coordinates, Place } from "@/lib/places/types";

type Props = {
  origin: Coordinates;
  foodPlaces: Place[];
  radiusMeters: number;
  onClose: () => void;
  onDirections: (place: Place | DateSpot) => void;
};

type DurationChoice = DateDuration | "custom";
type BudgetChoice = DateBudget | "custom";

const durationOptions: Array<{ value: DurationChoice; label: string }> = [
  { value: "short", label: "3 giờ" },
  { value: "long", label: "5 giờ" },
  { value: "overnight", label: "Qua đêm" },
  { value: "custom", label: "Tự nhập" },
];
const budgetOptions: Array<{ value: BudgetChoice; label: string }> = [
  { value: "light", label: "Tiết kiệm" },
  { value: "balanced", label: "Vừa phải" },
  { value: "flexible", label: "Linh hoạt" },
  { value: "custom", label: "Tự nhập" },
];
const reelLabels = ["ĂN", "CHƠI", "KẾT"] as const;

export default function DateJackpot({
  origin,
  foodPlaces,
  radiusMeters,
  onClose,
  onDirections,
}: Props) {
  const [durationChoice, setDurationChoice] = useState<DurationChoice>("long");
  const [budgetChoice, setBudgetChoice] = useState<BudgetChoice>("balanced");
  const [customHours, setCustomHours] = useState(6);
  const [customBudgetThousands, setCustomBudgetThousands] = useState(500);
  const [spots, setSpots] = useState<DateSpot[] | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [phase, setPhase] = useState<"setup" | "spinning" | "result">("setup");
  const [plan, setPlan] = useState<DatePlan | null>(null);
  const [reelPlaces, setReelPlaces] = useState<Array<Place | DateSpot | null>>([
    null,
    null,
    null,
  ]);
  const [stopped, setStopped] = useState(0);
  const timerRef = useRef<number[]>([]);
  const lastPlanIdsRef = useRef<string | undefined>(undefined);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useDialog<HTMLElement>(onClose);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(origin.latitude),
      lon: String(origin.longitude),
      radius: String(Math.max(3_000, radiusMeters)),
    });
    const load = async () => {
      setLoadState("loading");
      setLoadError("");
      try {
        const data = await getJson<{ spots: DateSpot[] }>(
          `/api/places/date-spots?${params}`,
          { signal: controller.signal },
        );
        if (
          !data ||
          typeof data !== "object" ||
          !("spots" in data) ||
          !Array.isArray(data.spots)
        )
          throw new Error("Dữ liệu điểm hẹn không hợp lệ.");
        if (!controller.signal.aborted) {
          setSpots(data.spots as DateSpot[]);
          setLoadState("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : "Không tải được điểm hẹn.",
          );
          setLoadState("error");
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [origin.latitude, origin.longitude, radiusMeters, retry]);

  useEffect(
    () => () => {
      timerRef.current.forEach(window.clearTimeout);
      timerRef.current = [];
    },
    [],
  );
  useEffect(() => {
    if (phase === "result") titleRef.current?.focus();
  }, [phase]);

  const customHoursValid =
    Number.isFinite(customHours) && customHours >= 1 && customHours <= 48;
  const customBudgetValid =
    Number.isFinite(customBudgetThousands) &&
    customBudgetThousands >= 50 &&
    customBudgetThousands <= 20_000;
  const duration: DateDuration =
    durationChoice === "custom"
      ? customHours >= 12
        ? "overnight"
        : customHours <= 4
          ? "short"
          : "long"
      : durationChoice;
  const budget: DateBudget =
    budgetChoice === "custom"
      ? customBudgetThousands <= 300
        ? "light"
        : customBudgetThousands <= 800
          ? "balanced"
          : "flexible"
      : budgetChoice;
  const customValuesValid =
    (durationChoice !== "custom" || customHoursValid) &&
    (budgetChoice !== "custom" || customBudgetValid);
  const samplePlan = useMemo(
    () =>
      spots && customValuesValid
        ? createDatePlan(foodPlaces, spots, origin, duration, budget, () => 0)
        : null,
    [foodPlaces, spots, origin, duration, budget, customValuesValid],
  );
  const canSpin =
    loadState === "ready" && customValuesValid && samplePlan !== null;

  function spin() {
    if (!spots || !canSpin) return;
    timerRef.current.forEach(window.clearTimeout);
    timerRef.current = [];
    const next = createDatePlan(
      foodPlaces,
      spots,
      origin,
      duration,
      budget,
      Math.random,
      lastPlanIdsRef.current,
    );
    if (!next) return;
    lastPlanIdsRef.current = next.stops.map((stop) => stop.place.id).join("|");
    setPlan(next);
    setPhase("spinning");
    setStopped(0);
    setReelPlaces([null, null, null]);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setReelPlaces(next.stops.map((stop) => stop.place));
      setStopped(3);
      setPhase("result");
      return;
    }
    const pools: Array<Array<Place | DateSpot>> = [
      foodPlaces.filter((place) => place.category !== "cafe"),
      spots.filter((spot) => spot.kind !== "guest_house"),
      duration === "overnight"
        ? spots.filter((spot) => spot.kind === "guest_house")
        : foodPlaces.filter((place) => place.category === "cafe"),
    ];
    let tick = 0;
    const interval = window.setInterval(() => {
      tick++;
      setReelPlaces((current) =>
        current.map((place, index) =>
          index < Math.floor(tick / 8)
            ? next.stops[index].place
            : (pools[index][Math.floor(Math.random() * pools[index].length)] ??
              place),
        ),
      );
      const nowStopped = Math.min(3, Math.floor(tick / 8));
      setStopped(nowStopped);
      if (nowStopped === 3) {
        window.clearInterval(interval);
        setReelPlaces(next.stops.map((stop) => stop.place));
        setPhase("result");
      }
    }, 95);
    // Store the interval with the same browser timer API for close/unmount cleanup.
    timerRef.current.push(interval);
  }

  const unavailable = !samplePlan && loadState === "ready";
  const lackOvernight =
    duration === "overnight" &&
    !spots?.some((spot) => spot.kind === "guest_house");

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="result-modal date-jackpot"
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-jackpot-title"
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Đóng kế hoạch hẹn"
        >
          <X size={20} />
        </button>
        <span className="date-jackpot-eyebrow">
          <Sparkles size={15} /> Hẹn hò cùng Dateny
        </span>
        <h2 id="date-jackpot-title" ref={titleRef} tabIndex={-1}>
          {phase === "result" ? "Kèo hẹn của hai bạn" : "Bốc cả buổi hẹn"}
        </h2>
        {phase === "setup" && (
          <>
            <p className="date-jackpot-intro">
              Ba ô quay. Một buổi hẹn bất ngờ.
            </p>
            <div className="date-jackpot-options">
              <label>Thời gian</label>
              <SegmentedControl
                label="Thời gian buổi hẹn"
                options={durationOptions}
                value={durationChoice}
                onChange={setDurationChoice}
              />
              {durationChoice === "custom" && (
                <label className="date-custom-input">
                  <span>Số giờ</span>
                  <span>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      step="1"
                      inputMode="numeric"
                      value={Number.isFinite(customHours) ? customHours : ""}
                      onChange={(event) =>
                        setCustomHours(event.target.valueAsNumber)
                      }
                      aria-describedby="custom-time-hint"
                    />
                    <em>giờ</em>
                  </span>
                  <small id="custom-time-hint">
                    Từ 12 giờ trở lên sẽ bao gồm chặng lưu trú.
                  </small>
                </label>
              )}
              <label>Ngân sách dự kiến</label>
              <SegmentedControl
                label="Mức ngân sách dự kiến"
                options={budgetOptions}
                value={budgetChoice}
                onChange={setBudgetChoice}
              />
              {budgetChoice === "custom" && (
                <label className="date-custom-input">
                  <span>Mức chi</span>
                  <span>
                    <input
                      type="number"
                      min="50"
                      max="20000"
                      step="50"
                      inputMode="numeric"
                      value={
                        Number.isFinite(customBudgetThousands)
                          ? customBudgetThousands
                          : ""
                      }
                      onChange={(event) =>
                        setCustomBudgetThousands(event.target.valueAsNumber)
                      }
                      aria-describedby="custom-budget-hint"
                    />
                    <em>nghìn đồng</em>
                  </span>
                  <small id="custom-budget-hint">
                    Nhập từ 50 đến 20.000 nghìn đồng.
                  </small>
                </label>
              )}
            </div>
            <p className="date-jackpot-note">
              Ngân sách là sở thích lựa chọn, không phải báo giá. Hãy kiểm tra
              giá và giờ mở cửa trước khi đi.
            </p>
          </>
        )}
        <div
          className={`jackpot-machine ${phase === "spinning" ? "is-spinning" : ""}`}
          aria-label="Ba chặng của buổi hẹn"
        >
          <span className="jackpot-lever" aria-hidden="true" />
          <div className="jackpot-light-row" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="jackpot-reels">
            {reelLabels.map((label, index) => {
              const display =
                phase === "result"
                  ? plan?.stops[index].place
                  : reelPlaces[index];
              return (
                <div
                  className={`jackpot-reel ${phase === "spinning" && index >= stopped ? "is-rolling" : "is-locked"}`}
                  key={label}
                >
                  <span className="jackpot-reel-label">{label}</span>
                  <strong key={`${index}-${display?.id ?? "empty"}`}>
                    {display?.name ??
                      (index === 0
                        ? "Ăn uống"
                        : index === 1
                          ? "Vui chơi"
                          : duration === "overnight"
                            ? "Lưu trú"
                            : "Cà phê")}
                  </strong>
                  <span className="jackpot-reel-number">0{index + 1}</span>
                </div>
              );
            })}
          </div>
          <div className="jackpot-light-row" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        {phase === "setup" && (
          <>
            {loadState === "loading" && (
              <p className="date-jackpot-status" role="status">
                <span className="loading-dot" /> Đang tìm điểm hẹn quanh bạn…
              </p>
            )}
            {loadState === "error" && (
              <p className="date-jackpot-status is-error" role="alert">
                {loadError}{" "}
                <button onClick={() => setRetry((value) => value + 1)}>
                  <RotateCcw size={15} /> Thử lại
                </button>
              </p>
            )}
            {unavailable && (
              <p className="date-jackpot-status" role="status">
                {lackOvernight
                  ? "Chưa có điểm lưu trú gần bạn. Thử chọn 3 hoặc 5 giờ."
                  : "Chưa đủ điểm ăn, chơi và cà phê gần bạn. Thử tăng bán kính ở trang khám phá."}
              </p>
            )}
            <button
              className="date-jackpot-primary"
              disabled={!canSpin}
              onClick={spin}
            >
              <Gift size={19} /> Quay jackpot <ArrowRight size={19} />
            </button>
          </>
        )}
        {phase === "spinning" && (
          <p className="date-jackpot-status" role="status">
            Đang mở kèo hẹn…
          </p>
        )}
        {phase === "result" && plan && (
          <>
            <div className="date-plan-stops">
              {plan.stops.map((stop, index) => (
                <article
                  className="date-plan-stop"
                  key={`${stop.place.id}-${index}`}
                >
                  <span className="date-plan-stop-icon">
                    {index === 0 ? (
                      <Footprints size={19} />
                    ) : index === 1 ? (
                      <Clapperboard size={19} />
                    ) : (
                      <Coffee size={19} />
                    )}
                  </span>
                  <div>
                    <small>
                      0{index + 1} · {stop.label}
                    </small>
                    <strong>{stop.place.name}</strong>
                    {stop.place.address && <span>{stop.place.address}</span>}
                  </div>
                  <button
                    onClick={() => onDirections(stop.place)}
                    aria-label={`Chỉ đường đến ${stop.place.name}`}
                  >
                    <MapPin size={18} />
                  </button>
                </article>
              ))}
            </div>
            <p className="date-jackpot-note">
              Giá, giờ chiếu và phòng trống chưa được xác minh. Kiểm tra trước
              khi đi. Chạm biểu tượng vị trí để dẫn đường từng chặng.
            </p>
            <div className="date-jackpot-result-actions">
              <button
                onClick={() => {
                  setPhase("setup");
                  setPlan(null);
                  setReelPlaces([null, null, null]);
                }}
              >
                Đổi lựa chọn
              </button>
              <button className="date-jackpot-primary" onClick={spin}>
                <RotateCcw size={18} /> Bốc lại
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
