"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clapperboard, Coffee, Footprints, Gift, MapPin, RotateCcw, Sparkles, X } from "lucide-react";
import { SegmentedControl } from "@/components/design-system";
import { createDatePlan, type DateBudget, type DateDuration, type DatePlan, type DateSpot } from "@/lib/places/date-plan";
import type { Coordinates, Place } from "@/lib/places/types";

type Props = {
  origin: Coordinates;
  foodPlaces: Place[];
  radiusMeters: number;
  onClose: () => void;
  onDirections: (place: Place | DateSpot) => void;
};

const durationOptions: Array<{ value: DateDuration; label: string }> = [
  { value: "short", label: "3 giờ" }, { value: "long", label: "5 giờ" }, { value: "overnight", label: "Qua đêm" },
];
const budgetOptions: Array<{ value: DateBudget; label: string }> = [
  { value: "light", label: "Tiết kiệm" }, { value: "balanced", label: "Vừa phải" }, { value: "flexible", label: "Linh hoạt" },
];
const reelLabels = ["ĂN", "CHƠI", "KẾT"] as const;

export default function DateJackpot({ origin, foodPlaces, radiusMeters, onClose, onDirections }: Props) {
  const [duration, setDuration] = useState<DateDuration>("long");
  const [budget, setBudget] = useState<DateBudget>("balanced");
  const [spots, setSpots] = useState<DateSpot[] | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [phase, setPhase] = useState<"setup" | "spinning" | "result">("setup");
  const [plan, setPlan] = useState<DatePlan | null>(null);
  const [reelPlaces, setReelPlaces] = useState<Array<Place | DateSpot | null>>([null, null, null]);
  const [stopped, setStopped] = useState(0);
  const timerRef = useRef<number[]>([]);
  const lastPlanIdsRef = useRef<string | undefined>(undefined);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, [tabindex]:not([tabindex='-1'])") ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ lat: String(origin.latitude), lon: String(origin.longitude), radius: String(Math.max(3_000, radiusMeters)) });
    const load = async () => {
      setLoadState("loading");
      setLoadError("");
      try {
        let response = await fetch(`/api/places/date-spots?${params}`, { signal: controller.signal });
        if (response.status === 429) {
          const seconds = Math.min(5, Math.max(1, Number(response.headers.get("Retry-After")) || 2));
          await new Promise<void>((resolve) => { window.setTimeout(resolve, seconds * 1_000); });
          if (controller.signal.aborted) return;
          response = await fetch(`/api/places/date-spots?${params}`, { signal: controller.signal });
        }
        const data: unknown = await response.json();
        if (!response.ok) throw new Error(data && typeof data === "object" && "error" in data ? String(data.error) : "Không tải được điểm hẹn.");
        if (!data || typeof data !== "object" || !("spots" in data) || !Array.isArray(data.spots)) throw new Error("Dữ liệu điểm hẹn không hợp lệ.");
        if (!controller.signal.aborted) { setSpots(data.spots as DateSpot[]); setLoadState("ready"); }
      } catch (error) {
        if (!controller.signal.aborted) { setLoadError(error instanceof Error ? error.message : "Không tải được điểm hẹn."); setLoadState("error"); }
      }
    };
    void load();
    return () => controller.abort();
  }, [origin.latitude, origin.longitude, radiusMeters, retry]);

  useEffect(() => () => { timerRef.current.forEach(window.clearTimeout); timerRef.current = []; }, []);
  useEffect(() => { if (phase === "result") titleRef.current?.focus(); }, [phase]);

  const samplePlan = useMemo(() => spots ? createDatePlan(foodPlaces, spots, origin, duration, budget, () => 0) : null,
    [foodPlaces, spots, origin, duration, budget]);
  const canSpin = loadState === "ready" && samplePlan !== null;

  function spin() {
    if (!spots || !canSpin) return;
    timerRef.current.forEach(window.clearTimeout);
    timerRef.current = [];
    const next = createDatePlan(foodPlaces, spots, origin, duration, budget, Math.random, lastPlanIdsRef.current);
    if (!next) return;
    lastPlanIdsRef.current = next.stops.map((stop) => stop.place.id).join("|");
    setPlan(next);
    setPhase("spinning");
    setStopped(0);
    setReelPlaces([null, null, null]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setReelPlaces(next.stops.map((stop) => stop.place)); setStopped(3); setPhase("result"); return; }
    const pools: Array<Array<Place | DateSpot>> = [
      foodPlaces.filter((place) => place.category !== "cafe"),
      spots.filter((spot) => spot.kind !== "guest_house"),
      duration === "overnight" ? spots.filter((spot) => spot.kind === "guest_house") : foodPlaces.filter((place) => place.category === "cafe"),
    ];
    let tick = 0;
    const interval = window.setInterval(() => {
      tick++;
      setReelPlaces((current) => current.map((place, index) => index < Math.floor(tick / 8)
        ? next.stops[index].place : pools[index][Math.floor(Math.random() * pools[index].length)] ?? place));
      const nowStopped = Math.min(3, Math.floor(tick / 8));
      setStopped(nowStopped);
      if (nowStopped === 3) { window.clearInterval(interval); setReelPlaces(next.stops.map((stop) => stop.place)); setPhase("result"); }
    }, 95);
    // Store the interval with the same browser timer API for close/unmount cleanup.
    timerRef.current.push(interval);
  }

  const unavailable = !samplePlan && loadState === "ready";
  const lackOvernight = duration === "overnight" && !spots?.some((spot) => spot.kind === "guest_house");

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="result-modal date-jackpot" role="dialog" aria-modal="true" aria-labelledby="date-jackpot-title">
        <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Đóng kế hoạch hẹn"><X size={20} /></button>
        <span className="date-jackpot-eyebrow"><Sparkles size={15} /> DATENY DATE</span>
        <h2 id="date-jackpot-title" ref={titleRef} tabIndex={-1}>{phase === "result" ? "Kèo hẹn của hai bạn" : "Bốc cả buổi hẹn"}</h2>
        {phase === "setup" && <>
          <p className="date-jackpot-intro">Ba ô quay. Một buổi hẹn bất ngờ.</p>
          <div className="date-jackpot-options">
            <label>THỜI GIAN</label>
            <SegmentedControl label="Thời gian buổi hẹn" options={durationOptions} value={duration} onChange={setDuration} />
            <label>NGÂN SÁCH DỰ KIẾN</label>
            <SegmentedControl label="Mức ngân sách dự kiến" options={budgetOptions} value={budget} onChange={setBudget} />
          </div>
          <p className="date-jackpot-note">Ngân sách là sở thích lựa chọn, không phải báo giá. Hãy kiểm tra giá và giờ mở cửa trước khi đi.</p>
        </>}
        <div className={`jackpot-machine ${phase === "spinning" ? "is-spinning" : ""}`} aria-label="Ba chặng của buổi hẹn">
          <span className="jackpot-lever" aria-hidden="true" />
          <div className="jackpot-light-row" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="jackpot-reels">
            {reelLabels.map((label, index) => {
              const display = phase === "result" ? plan?.stops[index].place : reelPlaces[index];
              return <div className={`jackpot-reel ${phase === "spinning" && index >= stopped ? "is-rolling" : "is-locked"}`} key={label}>
                <span className="jackpot-reel-label">{label}</span>
                <strong key={`${index}-${display?.id ?? "empty"}`}>{display?.name ?? (index === 0 ? "Ăn uống" : index === 1 ? "Vui chơi" : duration === "overnight" ? "Lưu trú" : "Cà phê")}</strong>
                <span className="jackpot-reel-number">0{index + 1}</span>
              </div>;
            })}
          </div>
          <div className="jackpot-light-row" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
        {phase === "setup" && <>
          {loadState === "loading" && <p className="date-jackpot-status" role="status"><span className="loading-dot" /> Đang tìm điểm hẹn quanh bạn…</p>}
          {loadState === "error" && <p className="date-jackpot-status is-error" role="alert">{loadError} <button onClick={() => setRetry((value) => value + 1)}><RotateCcw size={15} /> Thử lại</button></p>}
          {unavailable && <p className="date-jackpot-status" role="status">{lackOvernight ? "Chưa có điểm lưu trú gần bạn. Thử chọn 3 hoặc 5 giờ." : "Chưa đủ điểm ăn, chơi và cà phê gần bạn. Thử tăng bán kính ở trang khám phá."}</p>}
          <button className="date-jackpot-primary" disabled={!canSpin} onClick={spin}><Gift size={19} /> Quay jackpot <ArrowRight size={19} /></button>
        </>}
        {phase === "spinning" && <p className="date-jackpot-status" role="status">Đang mở kèo hẹn…</p>}
        {phase === "result" && plan && <>
          <div className="date-plan-stops">
            {plan.stops.map((stop, index) => <article className="date-plan-stop" key={`${stop.place.id}-${index}`}>
              <span className="date-plan-stop-icon">{index === 0 ? <Footprints size={19} /> : index === 1 ? <Clapperboard size={19} /> : <Coffee size={19} />}</span>
              <div><small>0{index + 1} · {stop.label}</small><strong>{stop.place.name}</strong>{stop.place.address && <span>{stop.place.address}</span>}</div>
              <button onClick={() => onDirections(stop.place)} aria-label={`Chỉ đường đến ${stop.place.name}`}><MapPin size={18} /></button>
            </article>)}
          </div>
          <p className="date-jackpot-note">Giá, giờ chiếu và phòng trống chưa được xác minh. Kiểm tra trước khi đi. Chạm biểu tượng vị trí để dẫn đường từng chặng.</p>
          <div className="date-jackpot-result-actions"><button onClick={() => { setPhase("setup"); setPlan(null); setReelPlaces([null, null, null]); }}>Đổi lựa chọn</button><button className="date-jackpot-primary" onClick={spin}><RotateCcw size={18} /> Bốc lại</button></div>
        </>}
      </section>
    </div>
  );
}
