"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinates } from "@/lib/places/types";
import type { LocationState } from "./types";

const SESSION_LOCATION_KEY = "dateny:last-location";
const SESSION_LOCATION_TTL_MS = 60 * 60_000;

type CachedLocation = Coordinates & { savedAt: number };

function readSessionLocation(): Coordinates | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_LOCATION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CachedLocation>;
    if (
      typeof value.latitude !== "number" ||
      typeof value.longitude !== "number" ||
      typeof value.savedAt !== "number" ||
      !Number.isFinite(value.latitude) ||
      !Number.isFinite(value.longitude) ||
      Math.abs(value.latitude) > 90 ||
      Math.abs(value.longitude) > 180 ||
      Date.now() - value.savedAt > SESSION_LOCATION_TTL_MS
    ) {
      window.sessionStorage.removeItem(SESSION_LOCATION_KEY);
      return null;
    }
    return { latitude: value.latitude, longitude: value.longitude };
  } catch {
    return null;
  }
}

function writeSessionLocation(coordinates: Coordinates) {
  try {
    window.sessionStorage.setItem(
      SESSION_LOCATION_KEY,
      JSON.stringify({ ...coordinates, savedAt: Date.now() }),
    );
  } catch {
    // Storage can be disabled; geolocation still works for the current render.
  }
}

function clearSessionLocation() {
  try {
    window.sessionStorage.removeItem(SESSION_LOCATION_KEY);
  } catch {
    // Storage can be disabled.
  }
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    status: "loading",
    coordinates: null,
  });
  const requestState = useRef({ id: 0 });
  const accept = useCallback((position: GeolocationPosition) => {
    const coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    writeSessionLocation(coordinates);
    setLocation({
      status: "ready",
      coordinates,
    });
  }, []);
  const reject = useCallback((error: GeolocationPositionError) => {
    if (error.code === 1) clearSessionLocation();
    setLocation({
      status: error.code === 1 ? "denied" : "error",
      coordinates: null,
      message:
        error.code === 1
          ? "Quyền vị trí chưa được bật. Hãy cấp quyền vị trí để tìm quán."
          : error.code === 3
            ? "Hết thời gian lấy vị trí. Thử lại nhé."
            : "Không lấy được vị trí. Thử lại nhé.",
    });
  }, []);
  const request = useCallback(() => {
    const id = ++requestState.current.id;
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocation({
        status: "error",
        coordinates: null,
        message: !window.isSecureContext
          ? "Mở Dateny bằng HTTPS để dùng vị trí."
          : "Trình duyệt không hỗ trợ vị trí.",
      });
      return;
    }
    setLocation({ status: "loading", coordinates: null });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id === requestState.current.id) accept(position);
      },
      (error) => {
        if (id === requestState.current.id) reject(error);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [accept, reject]);

  useEffect(() => {
    let active = true;
    const pending = requestState.current;
    const cached = readSessionLocation();
    // Reloads must reuse a granted permission, including browsers that expose
    // the experimental native control but do not reliably autolocate.
    // A session cache also covers one-time browser grants across a reload.
    if (navigator.permissions) {
      void navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (!active) return;
          if (permission.state === "granted") {
            request();
            return;
          }
          if (permission.state === "denied") {
            clearSessionLocation();
            setLocation({
              status: "denied",
              coordinates: null,
              message:
                "Quyền vị trí chưa được bật. Hãy cấp quyền vị trí để tìm quán.",
            });
            return;
          }
          setLocation(
            cached
              ? { status: "ready", coordinates: cached }
              : { status: "idle", coordinates: null },
          );
        })
        .catch(() => {
          if (!active) return;
          setLocation(
            cached
              ? { status: "ready", coordinates: cached }
              : { status: "idle", coordinates: null },
          );
        });
    } else {
      queueMicrotask(() => {
        if (!active) return;
        setLocation(
          cached
            ? { status: "ready", coordinates: cached }
            : { status: "idle", coordinates: null },
        );
      });
    }
    return () => {
      active = false;
      pending.id++;
    };
  }, [request]);

  return { location, request, accept, reject };
}
