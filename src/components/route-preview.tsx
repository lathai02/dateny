"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, CornerUpLeft, CornerUpRight, ExternalLink, Footprints, LocateFixed, MapPin, Navigation, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { NearbyMapProps } from "@/components/nearby-map";
import { googleMapsWalkingUrl } from "@/lib/places/directions";
import { navigationProgress, walkingStepText } from "@/lib/places/navigation";
import type { WalkingRoute } from "@/lib/places/route-types";
import type { Coordinates, Place } from "@/lib/places/types";

const NearbyMap = dynamic<NearbyMapProps>(() => import("@/components/nearby-map"), { ssr: false });

function distanceLabel(meters: number): string {
  return meters < 1_000 ? `${Math.round(meters)} m` : `${(meters / 1_000).toFixed(1)} km`;
}

type LocationFix = { position: Coordinates; accuracy: number; heading: number | null; timestamp: number };

export default function DirectionsPanel({ origin, destination, route, status, error, onRetry, onClose }: {
  origin: Coordinates;
  destination: Place;
  route: WalkingRoute | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [navigating, setNavigating] = useState(false);
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [now, setNow] = useState(0);
  const [followUser, setFollowUser] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [liveRoute, setLiveRoute] = useState<WalkingRoute | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [rerouteError, setRerouteError] = useState("");
  const offRouteCount = useRef(0);
  const lastRerouteAt = useRef(0);
  const lastExaminedFix = useRef(0);
  const rerouteAbort = useRef<AbortController | null>(null);
  const spokenCue = useRef("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLButtonElement>(".route-preview-back")?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  useEffect(() => {
    if (!navigating) return;
    if (!navigator.geolocation || !window.isSecureContext) return;
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        setFix({
          position: { latitude: result.coords.latitude, longitude: result.coords.longitude },
          accuracy: result.coords.accuracy,
          heading: Number.isFinite(result.coords.heading) ? result.coords.heading : null,
          timestamp: result.timestamp,
        });
        setNow(Date.now());
        setGpsError("");
      },
      (failure) => setGpsError(failure.code === 1
        ? "Bạn đã từ chối vị trí. Hãy bật quyền GPS trong trình duyệt."
        : "Đang mất tín hiệu GPS. Hãy kiểm tra vị trí và thử lại."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    const clock = window.setInterval(() => setNow(Date.now()), 3_000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(clock);
      rerouteAbort.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, [navigating]);

  const activeRoute = liveRoute ?? route;
  const gpsReliable = Boolean(fix && fix.accuracy <= 40 && now - fix.timestamp < 20_000);
  const progress = useMemo(() => activeRoute && fix && gpsReliable ? navigationProgress(activeRoute, fix.position) : null, [activeRoute, fix, gpsReliable]);

  useEffect(() => {
    if (!navigating || !progress || !fix || rerouting || progress.arrived) return;
    if (lastExaminedFix.current === fix.timestamp) return;
    lastExaminedFix.current = fix.timestamp;
    if (progress.offRouteMeters < 60) { offRouteCount.current = 0; return; }
    offRouteCount.current += 1;
    if (offRouteCount.current < 3 || Date.now() - lastRerouteAt.current < 30_000) return;
    offRouteCount.current = 0;
    lastRerouteAt.current = Date.now();
    const controller = new AbortController();
    rerouteAbort.current = controller;
    setRerouting(true);
    setRerouteError("");
    const params = new URLSearchParams({
      fromLat: String(fix.position.latitude), fromLon: String(fix.position.longitude),
      toLat: String(destination.latitude), toLon: String(destination.longitude),
    });
    fetch(`/api/places/route?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Chưa tìm lại được tuyến.");
        setLiveRoute(data as WalkingRoute);
        spokenCue.current = "";
      })
      .catch((cause) => { if (!controller.signal.aborted) setRerouteError(cause instanceof Error ? cause.message : "Chưa tìm lại được tuyến."); })
      .finally(() => { if (!controller.signal.aborted) setRerouting(false); });
  }, [destination.latitude, destination.longitude, fix, navigating, progress, rerouting]);

  useEffect(() => {
    if (!voiceEnabled || !progress?.nextStep || !gpsReliable || !window.speechSynthesis) return;
    const band = progress.metersToStep <= 20 ? "now" : progress.metersToStep <= 80 ? "soon" : "";
    if (!band) return;
    const cue = `${progress.nextStep.location.latitude}:${progress.nextStep.location.longitude}:${band}`;
    if (spokenCue.current === cue) return;
    spokenCue.current = cue;
    const utterance = new SpeechSynthesisUtterance(`${band === "soon" ? "Sắp tới, " : ""}${walkingStepText(progress.nextStep)}${progress.nextStep.street ? ` vào ${progress.nextStep.street}` : ""}`);
    utterance.lang = "vi-VN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, progress, gpsReliable]);

  const ready = status === "ready" && route;
  const navigationReady = navigating && activeRoute;
  const instruction = progress?.arrived ? "Bạn đã đến nơi" : progress ? walkingStepText(progress.nextStep) : "Đang xác định vị trí";
  const gpsNotice = !navigator.geolocation || !window.isSecureContext
    ? "GPS cần kết nối HTTPS và quyền truy cập vị trí."
    : gpsError || (fix && !gpsReliable ? "GPS chưa đủ chính xác hoặc đã mất tín hiệu." : "");

  return (
    <div className={`route-preview-backdrop${navigationReady ? " is-navigating" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`route-preview-card${navigationReady ? " is-navigating" : ""}`} role="dialog" aria-modal="true" aria-labelledby="route-preview-title">
        <div className="route-preview-map">
          {activeRoute && status === "ready" ? (
            <NearbyMap center={origin} places={[destination]} selectedPlace={destination} route={activeRoute} onSelectPlace={() => undefined}
              navigationPosition={navigationReady ? fix?.position : undefined} navigationHeading={fix?.heading}
              followUser={Boolean(navigationReady && followUser)} onUserPan={() => setFollowUser(false)} />
          ) : (
            <div className="route-preview-map-state" role={status === "error" ? "alert" : "status"}>
              {status === "loading" ? <span className="loading-dot" aria-hidden="true" /> : <MapPin size={28} aria-hidden="true" />}
              <span>{status === "error" ? "Chưa tải được tuyến" : "Đang tìm đường đi bộ…"}</span>
            </div>
          )}
          {navigationReady ? (
            <div className="navigation-banner" aria-live="polite">
              <span className="navigation-banner-icon">{progress?.nextStep?.modifier?.includes("left")
                ? <CornerUpLeft size={29} aria-hidden="true" />
                : progress?.nextStep?.modifier?.includes("right")
                  ? <CornerUpRight size={29} aria-hidden="true" />
                  : <ArrowUp size={29} aria-hidden="true" />}</span>
              <span className="navigation-banner-copy"><strong>{instruction}</strong><small>{progress?.arrived ? destination.name : progress ? `${distanceLabel(progress.metersToStep)} nữa${progress.nextStep?.street ? ` · ${progress.nextStep.street}` : ""}` : "Chờ GPS để bắt đầu dẫn đường"}</small></span>
            </div>
          ) : (
            <div className="route-preview-header">
              <button className="route-preview-back" onClick={onClose} aria-label="Đóng chỉ đường"><ArrowLeft size={18} aria-hidden="true" /></button>
              <span>Chỉ đường</span>
            </div>
          )}
          {navigationReady && <div className="navigation-map-actions">
            <button onClick={() => setFollowUser(true)} aria-label="Về vị trí của tôi" title="Về vị trí của tôi"><LocateFixed size={21} aria-hidden="true" /></button>
          </div>}
        </div>

        {navigationReady ? (
          <div className="navigation-footer">
            <p className="navigation-destination" id="route-preview-title">{destination.name}</p>
            <div className="navigation-summary"><Footprints size={22} aria-hidden="true" /><strong>{progress ? `${Math.max(1, Math.round(progress.remainingSeconds / 60))} phút` : "— phút"}</strong><span>{progress ? distanceLabel(progress.remainingMeters) : "Đang chờ GPS"}</span></div>
            {(gpsNotice || rerouting || rerouteError) && <p className="navigation-notice" role="status">{gpsNotice || (rerouting ? "Đang tìm lại tuyến…" : rerouteError)}</p>}
            <div className="navigation-controls">
              <button className="navigation-voice" onClick={() => { if (voiceEnabled) window.speechSynthesis?.cancel(); setVoiceEnabled(!voiceEnabled); }} disabled={!('speechSynthesis' in window)} aria-label={voiceEnabled ? "Tắt hướng dẫn bằng giọng nói" : "Bật hướng dẫn bằng giọng nói"} title={voiceEnabled ? "Tắt giọng nói" : "Bật giọng nói"}>{voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
              <button className="navigation-exit" onClick={() => { setNavigating(false); setVoiceEnabled(false); setFix(null); setGpsError(""); setLiveRoute(null); }}><X size={18} aria-hidden="true" /> Thoát</button>
            </div>
            <p className="route-preview-credit">Tuyến: © OpenStreetMap contributors · FOSSGIS/OSRM · <a href={googleMapsWalkingUrl(destination)} target="_blank" rel="noopener noreferrer">Mở Google Maps <ExternalLink size={11} aria-hidden="true" /></a></p>
          </div>
        ) : (
          <div className="route-preview-details">
            <p className="route-preview-destination" id="route-preview-title">{destination.name}</p>
            {ready && <div className="travel-mode-pill" aria-label="Chế độ di chuyển: đi bộ"><span className="travel-mode-indicator" aria-hidden="true" /><Footprints size={15} aria-hidden="true" /><span>Đi bộ</span></div>}
            {ready ? (
              <div className="route-preview-walk" aria-label="Tuyến đi bộ">
                <span className="route-preview-walk-icon"><Footprints size={20} aria-hidden="true" /></span>
                <span><strong>{Math.max(1, Math.round(route.durationSeconds / 60))} phút</strong><small>Đi bộ</small></span>
                <span className="route-preview-distance">{distanceLabel(route.distanceMeters)}</span>
              </div>
            ) : status === "error" ? (
              <div className="route-preview-error" role="alert"><span>{error}</span><button onClick={onRetry}><RotateCcw size={16} aria-hidden="true" /> Thử lại</button></div>
            ) : (
              <div className="route-preview-walk route-preview-walk-loading"><span className="loading-dot" aria-hidden="true" /> Đang tính quãng đường…</div>
            )}
            <button className="route-preview-open" disabled={!ready} onClick={() => { setNavigating(true); setFollowUser(true); }}>Bắt đầu dẫn đường <Navigation size={17} aria-hidden="true" /></button>
            <p className="route-preview-credit">Tuyến: © OpenStreetMap contributors · FOSSGIS/OSRM · <a href={googleMapsWalkingUrl(destination)} target="_blank" rel="noopener noreferrer">Mở Google Maps <ExternalLink size={11} aria-hidden="true" /></a></p>
          </div>
        )}
      </section>
    </div>
  );
}
