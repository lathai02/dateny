"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Bike,
  CarFront,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NearbyMapProps } from "@/features/map/nearby-map";
import { useDialog } from "@/hooks/use-dialog";
import { googleMapsDirectionsUrl } from "@/lib/places/directions";
import { navigationProgress, walkingStepText } from "@/lib/places/navigation";
import type { TravelMode, TravelRoute } from "@/lib/places/route-types";
import type { Coordinates, Place } from "@/lib/places/types";

const NearbyMap = dynamic<NearbyMapProps>(
  () => import("@/features/map/nearby-map"),
  { ssr: false },
);

function distanceLabel(meters: number): string {
  return meters < 1_000
    ? `${Math.round(meters)} m`
    : `${(meters / 1_000).toFixed(1)} km`;
}

type LocationFix = {
  position: Coordinates;
  accuracy: number;
  heading: number | null;
  timestamp: number;
};

const MAX_NAVIGATION_ACCURACY_METERS = 200;
const MAX_LOCATION_AGE_MS = 120_000;
const ignoreSelection = () => {};

const travelModes: Array<{ id: TravelMode; label: string; icon: LucideIcon }> =
  [
    { id: "walking", label: "Đi bộ", icon: Footprints },
    { id: "motorcycle", label: "Xe máy", icon: Bike },
    { id: "driving", label: "Ô tô", icon: CarFront },
  ];

export default function DirectionsPanel({
  origin,
  destination,
  route,
  mode,
  status,
  error,
  onModeChange,
  onRetry,
  onClose,
}: {
  origin: Coordinates;
  destination: Place;
  route: TravelRoute | null;
  mode: TravelMode;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  onModeChange: (mode: TravelMode) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [navigating, setNavigating] = useState(false);
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [now, setNow] = useState(0);
  const [followUser, setFollowUser] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [liveRoute, setLiveRoute] = useState<TravelRoute | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [rerouteError, setRerouteError] = useState("");
  const offRouteCount = useRef(0);
  const lastRerouteAt = useRef(0);
  const lastExaminedFix = useRef(0);
  const rerouteAbort = useRef<AbortController | null>(null);
  const spokenCue = useRef("");
  const mapPlaces = useMemo(() => [destination], [destination]);
  const stopFollowing = useCallback(() => setFollowUser(false), []);

  const dialogRef = useDialog<HTMLElement>(onClose);

  useEffect(() => {
    if (!navigating) return;
    if (!navigator.geolocation || !window.isSecureContext) return;
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        setFix({
          position: {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          },
          accuracy: result.coords.accuracy,
          heading: Number.isFinite(result.coords.heading)
            ? result.coords.heading
            : null,
          timestamp: result.timestamp,
        });
        setNow(Date.now());
        setGpsError("");
      },
      (failure) =>
        setGpsError(
          failure.code === 1
            ? "Bạn đã từ chối vị trí. Hãy bật quyền GPS trong trình duyệt."
            : "Đang mất tín hiệu GPS. Hãy kiểm tra vị trí và thử lại.",
        ),
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
  const gpsFresh = Boolean(fix && now - fix.timestamp < MAX_LOCATION_AGE_MS);
  const gpsUsable = Boolean(
    fix && gpsFresh && fix.accuracy <= MAX_NAVIGATION_ACCURACY_METERS,
  );
  const progress = useMemo(
    () =>
      activeRoute && fix && gpsUsable
        ? navigationProgress(activeRoute, fix.position)
        : null,
    [activeRoute, fix, gpsUsable],
  );

  useEffect(() => {
    if (!navigating || !progress || !fix || rerouting || progress.arrived)
      return;
    if (lastExaminedFix.current === fix.timestamp) return;
    lastExaminedFix.current = fix.timestamp;
    if (progress.offRouteMeters < 60) {
      offRouteCount.current = 0;
      return;
    }
    offRouteCount.current += 1;
    if (
      offRouteCount.current < 3 ||
      Date.now() - lastRerouteAt.current < 30_000
    )
      return;
    offRouteCount.current = 0;
    lastRerouteAt.current = Date.now();
    const controller = new AbortController();
    rerouteAbort.current = controller;
    setRerouting(true);
    setRerouteError("");
    const params = new URLSearchParams({
      fromLat: String(fix.position.latitude),
      fromLon: String(fix.position.longitude),
      toLat: String(destination.latitude),
      toLon: String(destination.longitude),
      mode,
    });
    fetch(`/api/places/route?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Chưa tìm lại được tuyến.");
        setLiveRoute(data as TravelRoute);
        spokenCue.current = "";
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setRerouteError(
            cause instanceof Error ? cause.message : "Chưa tìm lại được tuyến.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRerouting(false);
      });
  }, [
    destination.latitude,
    destination.longitude,
    fix,
    mode,
    navigating,
    progress,
    rerouting,
  ]);

  useEffect(() => {
    if (
      !voiceEnabled ||
      !progress?.nextStep ||
      !gpsUsable ||
      !window.speechSynthesis
    )
      return;
    const band =
      progress.metersToStep <= 20
        ? "now"
        : progress.metersToStep <= 80
          ? "soon"
          : "";
    if (!band) return;
    const cue = `${progress.nextStep.location.latitude}:${progress.nextStep.location.longitude}:${band}`;
    if (spokenCue.current === cue) return;
    spokenCue.current = cue;
    const utterance = new SpeechSynthesisUtterance(
      `${band === "soon" ? "Sắp tới, " : ""}${walkingStepText(progress.nextStep)}${progress.nextStep.street ? ` vào ${progress.nextStep.street}` : ""}`,
    );
    utterance.lang = "vi-VN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, progress, gpsUsable]);

  const ready = status === "ready" && route;
  const navigationReady = navigating && activeRoute;
  const activeMode =
    travelModes.find((item) => item.id === mode) ?? travelModes[0];
  const ActiveModeIcon = activeMode.icon;
  const instruction = progress?.arrived
    ? "Bạn đã đến nơi"
    : progress
      ? walkingStepText(progress.nextStep)
      : "Đang xác định vị trí";
  const gpsNotice =
    !navigator.geolocation || !window.isSecureContext
      ? "GPS cần kết nối HTTPS và quyền truy cập vị trí."
      : gpsError ||
        (fix && !gpsFresh
          ? "Vị trí GPS đã cũ, đang chờ tín hiệu mới."
          : fix && fix.accuracy > MAX_NAVIGATION_ACCURACY_METERS
            ? `GPS đang có sai số khoảng ${Math.round(fix.accuracy)} m.`
            : fix && fix.accuracy > 40
              ? `GPS đang dẫn đường với sai số khoảng ${Math.round(fix.accuracy)} m.`
              : "");

  return (
    <div
      className={`route-preview-backdrop${navigationReady ? " is-navigating" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`route-preview-card${navigationReady ? " is-navigating" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-preview-title"
      >
        <div className="route-preview-map">
          {activeRoute && status === "ready" ? (
            <NearbyMap
              center={origin}
              places={mapPlaces}
              selectedPlace={destination}
              route={activeRoute}
              onSelectPlace={ignoreSelection}
              navigationPosition={navigationReady ? fix?.position : undefined}
              navigationHeading={fix?.heading}
              followUser={Boolean(navigationReady && followUser)}
              onUserPan={stopFollowing}
            />
          ) : (
            <div
              className="route-preview-map-state"
              role={status === "error" ? "alert" : "status"}
            >
              {status === "loading" ? (
                <span className="loading-dot" aria-hidden="true" />
              ) : (
                <MapPin size={28} aria-hidden="true" />
              )}
              <span>
                {status === "error"
                  ? "Chưa tải được tuyến"
                  : `Đang tìm đường ${activeMode.label.toLocaleLowerCase("vi")}…`}
              </span>
            </div>
          )}
          {navigationReady ? (
            <div className="navigation-banner" aria-live="polite">
              <span className="navigation-banner-icon">
                {progress?.nextStep?.modifier?.includes("left") ? (
                  <CornerUpLeft size={29} aria-hidden="true" />
                ) : progress?.nextStep?.modifier?.includes("right") ? (
                  <CornerUpRight size={29} aria-hidden="true" />
                ) : (
                  <ArrowUp size={29} aria-hidden="true" />
                )}
              </span>
              <span className="navigation-banner-copy">
                <strong>{instruction}</strong>
                <small>
                  {progress?.arrived
                    ? destination.name
                    : progress
                      ? `${distanceLabel(progress.metersToStep)} nữa${progress.nextStep?.street ? ` · ${progress.nextStep.street}` : ""}`
                      : "Chờ GPS để bắt đầu dẫn đường"}
                </small>
              </span>
            </div>
          ) : (
            <div className="route-preview-header">
              <button
                className="route-preview-back"
                onClick={onClose}
                aria-label="Đóng chỉ đường"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <span>Chỉ đường</span>
            </div>
          )}
          {navigationReady && (
            <div className="navigation-map-actions">
              <button
                onClick={() => setFollowUser(true)}
                aria-label="Về vị trí của tôi"
                title="Về vị trí của tôi"
              >
                <LocateFixed size={21} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {navigationReady ? (
          <div className="navigation-footer">
            <p className="navigation-destination" id="route-preview-title">
              {destination.name}
            </p>
            <div className="navigation-summary">
              <ActiveModeIcon size={22} aria-hidden="true" />
              <strong>
                {progress
                  ? `${Math.max(1, Math.round(progress.remainingSeconds / 60))} phút`
                  : "— phút"}
              </strong>
              <span>
                {progress
                  ? distanceLabel(progress.remainingMeters)
                  : "Đang chờ GPS"}
              </span>
            </div>
            {(gpsNotice || rerouting || rerouteError) && (
              <p className="navigation-notice" role="status">
                {gpsNotice ||
                  (rerouting ? "Đang tìm lại tuyến…" : rerouteError)}
              </p>
            )}
            <div className="navigation-controls">
              <button
                className="navigation-voice"
                onClick={() => {
                  if (voiceEnabled) window.speechSynthesis?.cancel();
                  setVoiceEnabled(!voiceEnabled);
                }}
                disabled={!("speechSynthesis" in window)}
                aria-label={
                  voiceEnabled
                    ? "Tắt hướng dẫn bằng giọng nói"
                    : "Bật hướng dẫn bằng giọng nói"
                }
                title={voiceEnabled ? "Tắt giọng nói" : "Bật giọng nói"}
              >
                {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <button
                className="navigation-exit"
                onClick={() => {
                  setNavigating(false);
                  setVoiceEnabled(false);
                  setFix(null);
                  setGpsError("");
                  setLiveRoute(null);
                }}
              >
                <X size={18} aria-hidden="true" /> Thoát
              </button>
            </div>
            <p className="route-preview-credit">
              Tuyến: © OpenStreetMap contributors · FOSSGIS/OSRM ·{" "}
              <a
                href={googleMapsDirectionsUrl(destination, mode)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở Google Maps <ExternalLink size={11} aria-hidden="true" />
              </a>
            </p>
          </div>
        ) : (
          <div className="route-preview-details">
            <div className="route-preview-place" id="route-preview-title">
              <MapPin size={17} aria-hidden="true" />
              <span>{destination.name}</span>
            </div>
            <div
              className="route-mode-selector"
              data-mode={mode}
              role="group"
              aria-label="Chọn cách di chuyển"
            >
              {travelModes.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  className={mode === id ? "is-active" : ""}
                  aria-pressed={mode === id}
                  disabled={status === "loading"}
                  onClick={() => {
                    if (id !== mode) onModeChange(id);
                  }}
                  key={id}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {ready ? (
              <div
                className="route-preview-summary"
                aria-label={`Tuyến ${activeMode.label.toLocaleLowerCase("vi")}`}
              >
                <span className="route-preview-mode-icon">
                  <ActiveModeIcon size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>
                    {Math.max(1, Math.round(route.durationSeconds / 60))} phút
                  </strong>
                  <small>{activeMode.label}</small>
                </span>
                <span className="route-preview-distance">
                  {distanceLabel(route.distanceMeters)}
                </span>
              </div>
            ) : status === "error" ? (
              <div className="route-preview-error" role="alert">
                <span>{error}</span>
                <button onClick={onRetry}>
                  <RotateCcw size={16} aria-hidden="true" /> Thử lại
                </button>
              </div>
            ) : (
              <div className="route-preview-summary route-preview-summary-loading">
                <span className="loading-dot" aria-hidden="true" /> Đang tính
                quãng đường…
              </div>
            )}
            <button
              className="route-preview-open"
              disabled={!ready}
              onClick={() => {
                setNavigating(true);
                setFollowUser(true);
              }}
            >
              Bắt đầu dẫn đường <Navigation size={17} aria-hidden="true" />
            </button>
            <p className="route-preview-credit">
              Tuyến: © OpenStreetMap contributors · FOSSGIS/OSRM ·{" "}
              <a
                href={googleMapsDirectionsUrl(destination, mode)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở Google Maps <ExternalLink size={11} aria-hidden="true" />
              </a>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
