"use client";
import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
type BrowserGeolocationElement = HTMLElement & {
  position?: GeolocationPosition | null;
  error?: GeolocationPositionError | null;
};

export function GeolocationPermissionControl({
  onPosition,
  onError,
  onFallback,
}: {
  onPosition: (position: GeolocationPosition) => void;
  onError: (error: GeolocationPositionError) => void;
  onFallback: () => void;
}) {
  const controlRef = useRef<BrowserGeolocationElement | null>(null);

  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    const handleLocation = () => {
      if (control.position) onPosition(control.position);
      else if (control.error) onError(control.error);
    };
    control.addEventListener("location", handleLocation);
    if (control.position || control.error) handleLocation();
    return () => control.removeEventListener("location", handleLocation);
  }, [onError, onPosition]);

  return (
    <geolocation
      ref={controlRef}
      lang="vi"
      className="native-geolocation-control"
      autolocate="true"
      accuracymode="approximate"
    >
      <button type="button" onClick={onFallback}>
        <MapPin size={17} aria-hidden="true" /> Cấp quyền vị trí
      </button>
    </geolocation>
  );
}
