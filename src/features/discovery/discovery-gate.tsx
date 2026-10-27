import { MapPin, RotateCcw } from "lucide-react";
import { GlassButton } from "@/components/design-system";
import { GeolocationPermissionControl } from "@/features/location/geolocation-control";
import type { LocationState } from "@/features/location/types";
import { AppNav } from "./app-nav";
import { modeData, type Mode } from "./config";
export function DiscoveryGate({
  mode,
  location,
  requestState,
  requestError,
  requestLocation,
  acceptBrowserLocation,
  rejectBrowserLocation,
  retry,
}: {
  mode: Mode;
  location: LocationState;
  requestState: string;
  requestError: string;
  requestLocation: () => void;
  retry: () => void;
  acceptBrowserLocation: (position: GeolocationPosition) => void;
  rejectBrowserLocation: (error: GeolocationPositionError) => void;
}) {
  const initialMode = mode;
  const activeMode = modeData[mode];
  const ActiveModeIcon = activeMode.icon;

  const locationFailed =
    location.status === "denied" || location.status === "error";
  const loadFailed = requestState === "error";
  const hasError = locationFailed || loadFailed;
  const needsLocationPermission =
    location.status === "idle" || location.status === "denied";
  const findingLocation = location.status === "loading";
  return (
    <>
      <main className={`discovery-gate theme-${initialMode}`}>
        <AppNav mode={mode} />
        <section className="gate-content" role={hasError ? "alert" : "status"}>
          <span className="gate-indicator" aria-hidden="true">
            {hasError || needsLocationPermission ? (
              <MapPin size={28} />
            ) : (
              <span className="loading-dot" />
            )}
          </span>
          <span className="hero-mode gate-mode">
            <ActiveModeIcon size={18} aria-hidden="true" />
            {activeMode.label}
          </span>
          <h1>
            {needsLocationPermission
              ? "Cần quyền vị trí"
              : hasError
                ? "Chưa tìm được quán"
                : findingLocation
                  ? "Đang lấy vị trí…"
                  : "Đang tìm quán…"}
          </h1>
          <p>
            {location.status === "idle"
              ? "Bấm nút bên dưới để chọn cấp quyền vị trí cho Dateny."
              : locationFailed
                ? location.message
                : loadFailed
                  ? requestError
                  : findingLocation
                    ? "Đang chờ vị trí từ thiết bị của bạn."
                    : "Một chút nhé, Dateny đang tìm quanh bạn."}
          </p>
          {needsLocationPermission ? (
            <GeolocationPermissionControl
              onPosition={acceptBrowserLocation}
              onError={rejectBrowserLocation}
              onFallback={requestLocation}
            />
          ) : (
            hasError && (
              <GlassButton
                variant="primary"
                className="gate-retry"
                onClick={() => {
                  if (locationFailed) requestLocation();
                  else retry();
                }}
              >
                <RotateCcw size={17} aria-hidden="true" /> Thử lại
              </GlassButton>
            )
          )}
        </section>
      </main>
    </>
  );
}
