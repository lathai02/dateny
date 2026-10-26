"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft, ArrowRight, Coffee, Gift, Heart, MapPin, Navigation, RotateCcw,
  Search, Sparkles, Store, UserRound, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { GlassButton, GlassPanel, SegmentedControl } from "@/components/design-system";
import { AuthControl } from "@/components/auth-control";
import { ModeSelector } from "@/components/mode-selector";
import { PlaceReviews } from "@/components/place-reviews";
import type { NearbyMapProps } from "@/components/nearby-map";
import type { TravelMode, TravelRoute } from "@/lib/places/route-types";
import type { DateSpot } from "@/lib/places/date-plan";
import type { Coordinates, NearbyPlacesResponse, Place, PlaceCategoryFilter } from "@/lib/places/types";

const NearbyMap = dynamic<NearbyMapProps>(() => import("@/components/nearby-map"), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Đang mở bản đồ…</div>,
});
const RoutePreview = dynamic(() => import("@/components/route-preview"), { ssr: false });
const DateJackpot = dynamic(() => import("@/components/date-jackpot"), { ssr: false });

export type Mode = "solo" | "couple" | "friends";

const modeData: Record<Mode, { label: string; optionLabel: string; titles: string[]; icon: LucideIcon }> = {
  solo: {
    label: "Một mình",
    optionLabel: "Cho riêng mình",
    icon: UserRound,
    titles: [
      "Một góc riêng, đúng mood hôm nay.",
      "Đi một mình, vui theo cách mình.",
      "Một chỗ yên để thở chậm lại.",
      "Hôm nay cứ chiều mình một chút.",
      "Một chiếc bàn dành riêng cho bạn.",
      "Chậm một nhịp, tận hưởng theo ý mình.",
      "Quán hợp gu, thời gian thuộc về bạn.",
      "Một mình, nhưng chẳng hề buồn.",
      "Ghé một nơi khiến mình thấy dễ chịu.",
      "Tự thưởng mình một buổi thật ngon.",
    ],
  },
  couple: {
    label: "Hẹn hò",
    optionLabel: "Cho hai người",
    icon: Heart,
    titles: [
      "Một nơi cho hai người, thêm chuyện để nhớ.",
      "Hai người, một quán vừa xinh.",
      "Chọn một chỗ để câu chuyện dài thêm.",
      "Hẹn nhau ở một nơi thật hợp.",
      "Một chiếc bàn, hai người, nhiều điều để kể.",
      "Để buổi hẹn bắt đầu bằng một quán hay.",
      "Có nhau rồi, để Dateny chọn chỗ.",
      "Một nơi vừa đủ riêng cho hai người.",
      "Hôm nay mình cùng đi đâu đó nhé.",
      "Chọn đúng quán, giữ trọn mood hẹn hò.",
    ],
  },
  friends: {
    label: "Bạn bè",
    optionLabel: "Cho cả hội",
    icon: UsersRound,
    titles: [
      "Một kèo cho cả hội, vui từ lúc chọn quán.",
      "Cả hội đã đủ, giờ chỉ thiếu quán.",
      "Chốt kèo nhanh, vui lâu hơn.",
      "Một chỗ rộng mood cho cả nhóm.",
      "Hội mình đi đâu cũng vui, miễn đúng quán.",
      "Gọi đủ bạn, để Dateny gọi tên quán.",
      "Tụ họp thôi, quán xịn để Dateny lo.",
      "Một chiếc bàn cho mọi câu chuyện.",
      "Kèo này nhất định phải đi.",
      "Bạn bè đông đủ, cuộc vui bắt đầu.",
    ],
  },
};

const categoryLabels: Record<PlaceCategoryFilter, string> = {
  all: "Tất cả",
  restaurant: "Nhà hàng",
  cafe: "Cà phê",
  fast_food: "Ăn nhanh",
};
const categories = Object.keys(categoryLabels) as PlaceCategoryFilter[];
const radiusOptions = [1_000, 2_000, 3_000, 5_000];
const EMPTY_PLACES: Place[] = [];
const DESKTOP_MEDIA_QUERY = "(min-width: 720px)";
const welcomeMessages = [
  "Hôm nay bạn đi với ai?",
  "Dateny biết một vài quán hay ho đó!",
  "Quán ngon quanh đây, Dateny biết kha khá.",
  "Để Dateny tìm một chỗ thật vừa ý nhé.",
  "Có một quán rất hợp với hôm nay đấy.",
  "Một chỗ ngon và đúng mood đang chờ bạn.",
  "Dateny có vài địa chỉ rất đáng để ghé.",
  "Chọn người đi cùng, quán hay để Dateny lo.",
  "Hôm nay mình thử một quán mới nhé?",
  "Gần đây có vài chỗ thú vị lắm.",
  "Đi đâu khó, có Dateny lo!",
  "Chọn quán khó, để Dateny lo.",
  "Ăn gì, đi đâu? Dateny biết.",
  "Kèo đã lên, quán để Dateny chọn.",
  "Chưa biết ghé đâu? Có Dateny đây.",
  "Muốn đổi gió? Để Dateny tìm chỗ.",
  "Bạn chọn cuộc vui, Dateny chọn quán.",
  "Không cần nghĩ lâu, mở Dateny thôi.",
];

function subscribeDesktopViewport(callback: () => void) {
  const query = window.matchMedia(DESKTOP_MEDIA_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getDesktopViewport() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerDesktopViewport() {
  return false;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

type LocationState =
  | { status: "idle" | "loading" | "denied" | "error"; coordinates: null; message?: string }
  | { status: "ready"; coordinates: Coordinates };

type ResultsState = {
  centerKey: string;
  radiusMeters: number;
  places: Place[];
  source: NearbyPlacesResponse["source"];
};

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

function TypingHeadline({ text }: { text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (visibleLength >= text.length) return;
    const delay = reduceMotion ? 0 : visibleLength === 0 ? 280 : 48;

    const timer = window.setTimeout(() => {
      setVisibleLength(reduceMotion ? text.length : (length) => Math.min(text.length, length + 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [text, visibleLength]);

  return <h1 className="hero-title-typing" aria-label={text}>
      <span aria-hidden="true" style={{ visibility: "hidden" }}>{text}</span>
      <span className="typing-visible" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>{text.slice(0, visibleLength)}{visibleLength < text.length && <i className="typing-cursor" />}</span>
    </h1>
}

function RandomModeHeadline({ mode }: { mode: Mode }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setText(randomItem(modeData[mode].titles)), 0);
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

function TypingWelcomeMessage() {
  const [text, setText] = useState("");
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setText(randomItem(welcomeMessages)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!text || visibleLength >= text.length) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduceMotion ? 0 : visibleLength === 0 ? 240 : 38;
    const timer = window.setTimeout(() => {
      setVisibleLength(reduceMotion ? text.length : (length) => Math.min(text.length, length + 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [text, visibleLength]);

  return (
    <h1 id="welcome-title" className="welcome-typing-message" aria-label={text}>
      <span className="welcome-message-placeholder" aria-hidden="true">{text || "\u00a0"}</span>
      {text && (
        <span className="typing-visible" aria-hidden="true">
          {text.slice(0, visibleLength)}
          {visibleLength < text.length && <i className="typing-cursor" />}
        </span>
      )}
    </h1>
  );
}

function ModeWelcome({ location, onRetryLocation }: { location: LocationState; onRetryLocation: () => void }) {
  const modes = Object.entries(modeData) as [Mode, (typeof modeData)[Mode]][];
  const [previewMode, setPreviewMode] = useState<Mode>("solo");
  return (
    <main className={`welcome-page theme-${previewMode}`}>
      <div className="welcome-ambient" aria-hidden="true"><span /><span /><span /></div>
      <header className="welcome-nav"><span className="logo-mark">D</span><span className="logo-word">Dateny</span></header>
      <section className="welcome-main" aria-labelledby="welcome-title">
        {(location.status === "denied" || location.status === "error") && (
          <GlassPanel className="welcome-location-alert" role="alert">
            <MapPin size={20} aria-hidden="true" />
            <span><strong>{location.status === "denied" ? "Bật vị trí" : "Chưa lấy được vị trí"}</strong><small>{location.status === "denied" ? "Cho phép Vị trí trong quyền của trang, rồi thử lại." : location.message}</small></span>
            <GlassButton variant="soft" onClick={onRetryLocation}>Thử lại</GlassButton>
          </GlassPanel>
        )}
        <div className="welcome-heading">
          <TypingWelcomeMessage />
        </div>
        <div className="mode-stage">
          <ModeSelector options={modes.map(([id, item]) => ({ id, label: item.optionLabel, icon: item.icon }))} selected={previewMode} onSelect={setPreviewMode} />
        </div>
      </section>
    </main>
  );
}

function formatDistance(meters: number) {
  return meters < 1_000 ? `${meters} m` : `${(meters / 1_000).toFixed(1)} km`;
}

function DirectionsButton({ place, onClick, className = "", label = "Chỉ đường" }: {
  place: Place;
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      className={className}
      onClick={onClick}
      aria-label={`Chỉ đường đi bộ từ vị trí của bạn đến ${place.name} trong Dateny`}
    >
      <Navigation size={17} aria-hidden="true" /> {label}
    </button>
  );
}

function PlaceCard({
  place, selected, favorite, entranceDelay, onSelect, onOpen, onDirections, onToggleFavorite,
}: {
  place: Place;
  selected: boolean;
  favorite: boolean;
  entranceDelay: number;
  onSelect: () => void;
  onOpen: () => void;
  onDirections: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <article className={`place-card real-place-card ${selected ? "is-selected" : ""}`} style={{ animationDelay: `${entranceDelay}ms` }}>
      <button className="place-main" onClick={onSelect} aria-label={`Hiện ${place.name} trên bản đồ`}>
        <span className="place-category-icon">{place.category === "cafe" ? <Coffee size={22} aria-hidden="true" /> : <Store size={22} aria-hidden="true" />}</span>
        <span className="place-copy">
          <span className="place-type"><span>{categoryLabels[place.category]}</span><span>{formatDistance(place.distanceMeters)}</span></span>
          <strong>{place.name}</strong>
          {place.address && <span className="place-address">{place.address}</span>}
          {place.cuisine && <span className="place-cuisine">{place.cuisine.replaceAll(";", ", ")}</span>}
        </span>
      </button>
      <div className="place-footer">
        <button className={`heart-button ${favorite ? "saved" : ""}`} onClick={onToggleFavorite} aria-pressed={favorite} aria-label={favorite ? `Bỏ yêu thích ${place.name}` : `Thêm yêu thích ${place.name}`}><Heart size={19} aria-hidden="true" /></button>
        <div className="place-footer-actions">
          <button className="detail-button" onClick={onOpen}>Chi tiết <ArrowRight size={17} aria-hidden="true" /></button>
          <DirectionsButton place={place} onClick={onDirections} className="direction-link" />
        </div>
      </div>
    </article>
  );
}

export default function Home({ initialMode = null }: { initialMode?: Mode | null }) {
  const isDesktopViewport = useSyncExternalStore(subscribeDesktopViewport, getDesktopViewport, getServerDesktopViewport);
  const [location, setLocation] = useState<LocationState>({ status: "idle", coordinates: null });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategoryFilter>("all");
  const [radiusMeters, setRadiusMeters] = useState(2_000);
  const [results, setResults] = useState<ResultsState | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [requestError, setRequestError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routePlace, setRoutePlace] = useState<Place | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [routeData, setRouteData] = useState<TravelRoute | null>(null);
  const [routeMode, setRouteMode] = useState<TravelMode>("walking");
  const [routeOrigin, setRouteOrigin] = useState<Coordinates | null>(null);
  const [routeError, setRouteError] = useState("");
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [surprise, setSurprise] = useState<SurpriseState | null>(null);
  const [dateJackpotOpen, setDateJackpotOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hasEnteredDiscovery, setHasEnteredDiscovery] = useState(false);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const autoLocationRequestedRef = useRef(false);
  const lastSurpriseIdRef = useRef<string | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const routeControllerRef = useRef<AbortController | null>(null);

  const coordinates = location.coordinates;
  const centerKey = coordinates
    ? `${coordinates.latitude.toFixed(4)}:${coordinates.longitude.toFixed(4)}`
    : "";
  const hasCoverage = Boolean(results && results.centerKey === centerKey && results.radiusMeters >= radiusMeters);

  const requestLocation = useCallback(() => {
    routeControllerRef.current?.abort();
    setRoutePlace(null);
    setRouteData(null);
    setRouteOrigin(null);
    setRouteStatus("idle");
    if (!window.isSecureContext) {
      setLocation({ status: "error", coordinates: null, message: "Mở Dateny bằng HTTPS để dùng vị trí." });
      return;
    }
    if (!navigator.geolocation) {
      setLocation({ status: "error", coordinates: null, message: "Trình duyệt không hỗ trợ vị trí." });
      return;
    }
    setLocation({ status: "loading", coordinates: null });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({
        status: "ready",
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
      }),
      (error) => setLocation({
        status: error.code === 1 ? "denied" : "error",
        coordinates: null,
        message: error.code === 1
          ? "Bạn đã từ chối vị trí. Hãy bật quyền trong trình duyệt rồi thử lại."
          : error.code === 3 ? "Hết thời gian lấy vị trí. Thử lại nhé." : "Không lấy được vị trí. Thử lại nhé.",
      }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  useEffect(() => {
    if (autoLocationRequestedRef.current) return;
    autoLocationRequestedRef.current = true;
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (initialMode === null || !coordinates || hasCoverage) return;
    const controller = new AbortController();
    const loadPlaces = async () => {
      setRequestState("loading");
      setRequestError("");
      const params = new URLSearchParams({
        lat: coordinates.latitude.toFixed(6),
        lon: coordinates.longitude.toFixed(6),
        radius: String(radiusMeters),
        category: "all",
      });
      try {
        let response = await fetch(`/api/places/nearby?${params}`, { signal: controller.signal });
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delay = Math.min(5, Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 2)) * 1_000;
          await new Promise((resolve) => window.setTimeout(resolve, delay));
          if (controller.signal.aborted) return;
          response = await fetch(`/api/places/nearby?${params}`, { signal: controller.signal });
        }
        const data: unknown = await response.json();
        if (!response.ok) {
          const message = data && typeof data === "object" && "error" in data
            ? String(data.error) : "Chưa tải được địa điểm.";
          throw new Error(message);
        }
        if (!data || typeof data !== "object" || !("places" in data) || !Array.isArray(data.places)) {
          throw new Error("Dữ liệu địa điểm không hợp lệ.");
        }
        const nearby = data as NearbyPlacesResponse;
        setResults({ centerKey, radiusMeters, places: nearby.places, source: nearby.source });
        setHasEnteredDiscovery(true);
        setRequestState("success");
      } catch (error) {
        if (controller.signal.aborted) return;
        setRequestError(error instanceof Error ? error.message : "Chưa tải được địa điểm.");
        setRequestState("error");
      }
    };
    void loadPlaces();
    return () => controller.abort();
  }, [centerKey, coordinates, hasCoverage, initialMode, radiusMeters, retryKey]);

  useEffect(() => {
    if (!detailPlace) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLButtonElement>(".result-modal .modal-close")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDetailPlace(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailPlace]);

  const surpriseOpen = surprise !== null;
  useEffect(() => {
    if (!surpriseOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLButtonElement>(".surprise-modal .modal-close")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
        setSurprise(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [surpriseOpen]);

  useEffect(() => () => {
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    routeControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (surprise?.phase === "revealed") {
      document.querySelector<HTMLElement>(".surprise-revealed h2")?.focus();
    }
  }, [surprise?.phase]);

  const availablePlaces = hasCoverage ? results?.places ?? EMPTY_PLACES : EMPTY_PLACES;
  const surpriseBasePlaces = useMemo(() => availablePlaces.filter((place) => {
    const searchText = [place.name, place.address, place.cuisine].filter(Boolean).join(" ").toLocaleLowerCase("vi");
    return place.distanceMeters <= radiusMeters
      && searchText.includes(query.trim().toLocaleLowerCase("vi"));
  }), [availablePlaces, query, radiusMeters]);
  const filteredPlaces = useMemo(() => surpriseBasePlaces.filter((place) =>
    category === "all" || place.category === category,
  ), [surpriseBasePlaces, category]);
  const choosingPlaces = surprise?.phase === "choosing"
    ? surpriseBasePlaces.filter((place) => surprise.category === "all" || place.category === surprise.category)
    : EMPTY_PLACES;

  const visibleSelectedPlace = selectedPlace
    ? filteredPlaces.find((place) => place.id === selectedPlace.id) ?? null
    : null;

  if (initialMode === null) return <ModeWelcome location={location} onRetryLocation={requestLocation} />;
  const activeMode = modeData[initialMode];
  const ActiveIcon = activeMode.icon;

  if (!hasEnteredDiscovery) {
    const locationFailed = location.status === "denied" || location.status === "error";
    const loadFailed = requestState === "error";
    const hasError = locationFailed || loadFailed;
    const findingLocation = location.status === "idle" || location.status === "loading";
    return (
      <main className={`discovery-gate theme-${initialMode}`}>
        <header className="app-nav">
          <Link className="app-logo" href="/" aria-label="Về trang chọn chế độ"><span className="logo-mark">D</span><span className="logo-word">Dateny</span></Link>
          <div className="nav-actions"><AuthControl /><Link className="mode-pill" href="/" aria-label="Đổi kiểu đi chơi"><ArrowLeft size={17} aria-hidden="true" /><span>{activeMode.label}</span></Link></div>
        </header>
        <section className="gate-content" role={hasError ? "alert" : "status"}>
          <span className="gate-indicator" aria-hidden="true">{hasError ? <MapPin size={28} /> : <span className="loading-dot" />}</span>
          <span className="overline">{activeMode.label}</span>
          <h1>{hasError ? "Chưa tìm được quán" : findingLocation ? "Đang lấy vị trí…" : "Đang tìm quán…"}</h1>
          <p>{locationFailed ? location.message : loadFailed ? requestError : findingLocation ? "Cho phép vị trí để xem quán gần bạn." : "Một chút nhé, Dateny đang tìm quanh bạn."}</p>
          {hasError && (
            <GlassButton variant="primary" className="gate-retry" onClick={locationFailed ? requestLocation : () => { setRequestState("loading"); setRetryKey((current) => current + 1); }}>
              <RotateCcw size={17} aria-hidden="true" /> Thử lại
            </GlassButton>
          )}
        </section>
      </main>
    );
  }

  function focusPlace(place: Place, scrollToMap = false) {
    if (routePlace?.id !== place.id) {
      routeControllerRef.current?.abort();
      setRoutePlace(null);
      setRouteData(null);
      setRouteOrigin(null);
      setRouteStatus("idle");
    }
    setSelectedPlace(place);
    if (scrollToMap) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => mapSectionRef.current?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "center" }));
    }
  }

  async function startDirections(destination: Place | DateSpot, mode: TravelMode = "walking") {
    if (!coordinates) return;
    // Routing only needs name and coordinates. Keep the existing map's Place shape internally.
    const place: Place = "category" in destination ? destination : { ...destination, category: "restaurant" };
    routeControllerRef.current?.abort();
    const controller = new AbortController();
    routeControllerRef.current = controller;
    setRoutePlace(place);
    setRouteData(null);
    setRouteMode(mode);
    setRouteError("");
    setRouteStatus("loading");
    setSelectedPlace(place);
    setDetailPlace(null);
    closeSurprise();
    setDateJackpotOpen(false);
    try {
      const existingOrigin = routePlace?.id === place.id ? routeOrigin : null;
      let origin = existingOrigin ?? coordinates;
      if (!existingOrigin && navigator.geolocation) {
        try {
          const latest = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(
            resolve, reject, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 7_000 },
          ));
          origin = { latitude: latest.coords.latitude, longitude: latest.coords.longitude };
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === 1) throw new Error("Hãy bật quyền vị trí để dẫn đường.");
          // A slow GPS fix may still arrive in the live watch; use the last known position meanwhile.
        }
      }
      if (controller.signal.aborted) return;
      setRouteOrigin(origin);
      const params = new URLSearchParams({
        fromLat: origin.latitude.toFixed(6), fromLon: origin.longitude.toFixed(6),
        toLat: place.latitude.toFixed(6), toLon: place.longitude.toFixed(6),
        mode,
      });
      const response = await fetch(`/api/places/route?${params}`, { signal: controller.signal });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(data && typeof data === "object" && "error" in data ? String(data.error) : "Chưa thể tìm tuyến đường.");
      if (!data || typeof data !== "object" || !("coordinates" in data) || !Array.isArray(data.coordinates)) throw new Error("Dữ liệu chỉ đường không hợp lệ.");
      if (controller.signal.aborted) return;
      setRouteData(data as TravelRoute);
      setRouteStatus("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      setRouteError(error instanceof Error ? error.message : "Chưa thể tìm tuyến đường.");
      setRouteStatus("error");
    }
  }

  function closeDirections() {
    routeControllerRef.current?.abort();
    setRoutePlace(null);
    setRouteData(null);
    setRouteOrigin(null);
    setRouteMode("walking");
    setRouteStatus("idle");
  }

  function openSurprise() {
    if (surpriseBasePlaces.length === 0) return;
    const initialCategory = category !== "all" && !surpriseBasePlaces.some((place) => place.category === category)
      ? "all" : category;
    setDetailPlace(null);
    setSurprise({ phase: "choosing", category: initialCategory });
  }

  function startSurprise(chosenCategory: PlaceCategoryFilter) {
    const pool = surpriseBasePlaces.filter((candidate) =>
      chosenCategory === "all" || candidate.category === chosenCategory,
    );
    if (pool.length === 0) return;
    closeDirections();
    setCategory(chosenCategory);
    const choices = pool.length > 1
      ? pool.filter((place) => place.id !== lastSurpriseIdRef.current)
      : pool;
    const place = randomItem(choices);
    lastSurpriseIdRef.current = place.id;
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
    setSelectedPlace(null);
    setDetailPlace(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setSurprise({ place, previewPlace: place, phase: "revealed", category: chosenCategory, step: 0, total: 1, poolSize: pool.length });
      setSelectedPlace(place);
      return;
    }

    const total = pool.length === 1 ? 1 : 14;
    const frames: Place[] = [];
    let previousId = place.id;
    for (let index = 0; index < total - 1; index++) {
      const candidates = pool.filter((candidate) => candidate.id !== previousId);
      const preview = randomItem(candidates);
      frames.push(preview);
      previousId = preview.id;
    }
    frames.push(place);
    setSurprise({ place, previewPlace: frames[0], phase: "spinning", category: chosenCategory, step: 0, total, poolSize: pool.length });

    const advance = (step: number) => {
      if (step === total - 1) {
        revealTimerRef.current = window.setTimeout(() => {
          setSurprise({ place, previewPlace: place, phase: "revealed", category: chosenCategory, step, total, poolSize: pool.length });
          setSelectedPlace(place);
          revealTimerRef.current = null;
        }, total === 1 ? 650 : 480);
        return;
      }
      const progress = (step + 1) / (total - 1);
      const delay = 65 + Math.round(progress ** 2.4 * 360);
      revealTimerRef.current = window.setTimeout(() => {
        const nextStep = step + 1;
        setSurprise({ place, previewPlace: frames[nextStep], phase: "spinning", category: chosenCategory, step: nextStep, total, poolSize: pool.length });
        advance(nextStep);
      }, delay);
    };
    advance(0);
  }

  function closeSurprise() {
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
    setSurprise(null);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className={`discovery-page theme-${initialMode}`}>
      <header className="app-nav">
        <Link className="app-logo" href="/" aria-label="Về trang chọn chế độ"><span className="logo-mark">D</span><span className="logo-word">Dateny</span></Link>
        <div className="nav-actions"><AuthControl /><Link className="mode-pill" href="/" aria-label="Đổi kiểu đi chơi"><ArrowLeft size={17} aria-hidden="true" /><span>{activeMode.label}</span></Link></div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-copy-main">
            <span className="hero-mode"><ActiveIcon size={18} aria-hidden="true" />{activeMode.label}</span>
            <RandomModeHeadline key={initialMode} mode={initialMode} />
          </div>
          {isDesktopViewport && <aside className="hero-slogan" aria-label={`${surpriseBasePlaces.length} quán gần bạn. Để Dateny chọn giúp.`}>
            <p className="hero-slogan-count"><strong>{surpriseBasePlaces.length}</strong><span>quán gần bạn</span></p>
            <h2>Khỏi nghĩ lâu.<br />Để Dateny chọn giúp.</h2>
          </aside>}
          <div className="hero-actions">
            <button className="pick-button pick-button--desktop" onClick={openSurprise} disabled={surpriseBasePlaces.length === 0}><Gift size={19} aria-hidden="true" /><span>Bốc một quán</span><ArrowRight size={19} aria-hidden="true" /></button>
            {initialMode === "couple" && <button className="date-action date-action--desktop" onClick={() => setDateJackpotOpen(true)} disabled={!coordinates || !hasCoverage}><Sparkles size={19} aria-hidden="true" /><span>Bốc cả buổi hẹn</span><ArrowRight size={19} aria-hidden="true" /></button>}
          </div>
        </div>
      </section>

      <section className="explore-section" aria-labelledby="explore-title">
        <div className="explore-head">
          <div><h2 id="explore-title">Quanh đây</h2></div>
        </div>
        {(location.status === "denied" || location.status === "error") && (
          <p className="location-alert" role="alert">{location.message}</p>
        )}

        {coordinates && (
          <>
            <div className="map-section" ref={mapSectionRef}>
              <div className="map-shell">
                {!routePlace && <NearbyMap center={coordinates} places={filteredPlaces} selectedPlace={visibleSelectedPlace} route={null} onSelectPlace={(place) => focusPlace(place)} />}
                <div className="map-floating-toolbar">
                  <span className="map-heading"><strong>Bản đồ</strong><small>{hasCoverage ? `${filteredPlaces.length} địa điểm` : "Đang tìm địa điểm"}</small></span>
                  <GlassButton className="map-locate-button" onClick={requestLocation} aria-label="Cập nhật vị trí của tôi">
                    <MapPin size={18} aria-hidden="true" /><span>Vị trí</span>
                  </GlassButton>
                </div>
              </div>
              {!routePlace && visibleSelectedPlace && (
                <GlassPanel className="map-selection" role="status">
                  <span><strong>{visibleSelectedPlace.name}</strong><small>{formatDistance(visibleSelectedPlace.distanceMeters)} · {categoryLabels[visibleSelectedPlace.category]}</small></span>
                  <div className="map-selection-actions">
                    <button onClick={() => setDetailPlace(visibleSelectedPlace)}>Chi tiết <ArrowRight size={16} aria-hidden="true" /></button>
                    <DirectionsButton place={visibleSelectedPlace} onClick={() => startDirections(visibleSelectedPlace)} className="direction-link" />
                  </div>
                </GlassPanel>
              )}
            </div>

            <GlassPanel className="filters">
              <label className="search-field"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedPlace(null); closeDirections(); }} placeholder="Tìm quán" aria-label="Tìm quán" /></label>
              <SegmentedControl label="Bán kính" className="radius-control" options={radiusOptions.map((value) => ({ value, label: `${value / 1_000} km` }))} value={radiusMeters}
                onChange={(value) => { setRadiusMeters(value); setSelectedPlace(null); closeDirections(); }} />
              <SegmentedControl label="Loại quán" className="category-control" options={categories.map((item) => ({ value: item, label: categoryLabels[item] }))} value={category}
                onChange={(value) => { setCategory(value); setSelectedPlace(null); closeDirections(); }} />
            </GlassPanel>

            {!hasCoverage && requestState !== "error" && <div className="data-state" role="status"><span className="loading-dot" />Đang tìm quán gần bạn…</div>}
            {requestState === "error" && !hasCoverage && (
              <div className="data-state data-error" role="alert">
                <span>{requestError}</span>
                <button onClick={() => setRetryKey((current) => current + 1)}><RotateCcw size={16} aria-hidden="true" /> Thử lại</button>
              </div>
            )}

            {hasCoverage && (
              <div className="place-grid">
                {filteredPlaces.map((place, index) => (
                  <PlaceCard
                    key={place.id}
                    entranceDelay={Math.min(index, 8) * 40}
                    place={place}
                    selected={visibleSelectedPlace?.id === place.id}
                    favorite={favorites.includes(place.id)}
                    onSelect={() => focusPlace(place, true)}
                    onOpen={() => { focusPlace(place); setDetailPlace(place); }}
                    onDirections={() => startDirections(place)}
                    onToggleFavorite={() => toggleFavorite(place.id)}
                  />
                ))}
                {filteredPlaces.length === 0 && (
                  <div className="empty-state"><strong>Chưa tìm thấy quán.</strong><button onClick={() => { setQuery(""); setCategory("all"); setRadiusMeters(2_000); closeDirections(); }}>Đặt lại bộ lọc</button></div>
                )}
              </div>
            )}
            <p className="data-credit">Dữ liệu địa điểm: © OpenStreetMap contributors{hasCoverage && results?.source !== "overpass" ? ` · qua ${results?.source === "geoapify" ? "Geoapify" : "Photon"}` : ""}.</p>
          </>
        )}
        {!coordinates && location.status !== "loading" && (
          <div className="location-empty"><Navigation size={28} aria-hidden="true" /><p>Cho phép vị trí để xem quán thật gần bạn.</p><button onClick={requestLocation}>Tìm quán quanh tôi</button></div>
        )}
        {location.status === "loading" && <div className="location-empty" role="status"><span className="loading-dot" /><p>Đang xác định vị trí của bạn…</p></div>}
      </section>

      {detailPlace && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailPlace(null); }}>
          <section className="result-modal place-detail-modal" role="dialog" aria-modal="true" aria-labelledby="result-title" key={detailPlace.id}>
            <button className="modal-close" onClick={() => setDetailPlace(null)} aria-label="Đóng"><X size={20} aria-hidden="true" /></button>
            <header className="place-detail-hero">
              <span className="overline">{categoryLabels[detailPlace.category]}</span>
              <h2 id="result-title">{detailPlace.name}</h2>
              <div className="modal-meta"><span><MapPin size={14} aria-hidden="true" />{formatDistance(detailPlace.distanceMeters)}</span></div>
            </header>
            {(detailPlace.address || detailPlace.cuisine || detailPlace.openingHours || detailPlace.website) && (
              <div className="place-facts">
                {detailPlace.address && <p><strong>Địa chỉ</strong><span>{detailPlace.address}</span></p>}
                {detailPlace.cuisine && <p><strong>Ẩm thực</strong><span>{detailPlace.cuisine.replaceAll(";", ", ")}</span></p>}
                {detailPlace.openingHours && <p><strong>Giờ mở cửa</strong><span>{detailPlace.openingHours}</span></p>}
                {detailPlace.website && <p><strong>Website</strong><a href={detailPlace.website} target="_blank" rel="noopener noreferrer">{detailPlace.website}</a></p>}
              </div>
            )}
            <div className="modal-actions">
              {coordinates && <DirectionsButton place={detailPlace} onClick={() => startDirections(detailPlace)} className="primary modal-directions" label="Xem đường đi" />}
            </div>
            <PlaceReviews place={detailPlace} />
          </section>
        </div>
      )}

      {surprise && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSurprise(); }}>
          <section className="result-modal surprise-modal" role="dialog" aria-modal="true" aria-labelledby="surprise-title">
            <button className="modal-close" onClick={closeSurprise} aria-label="Đóng túi mù"><X size={20} aria-hidden="true" /></button>
            {surprise.phase === "choosing" ? (
              <div className="surprise-choosing">
                <span className="surprise-reveal-icon" aria-hidden="true"><Gift size={27} /></span>
                <h2 id="surprise-title">Bốc túi mù</h2>
                <SegmentedControl label="Loại quán cho túi mù" options={categories.map((item) => ({ value: item, label: categoryLabels[item] }))}
                  value={surprise.category} onChange={(value) => setSurprise({ phase: "choosing", category: value })} />
                <p role="status">{choosingPlaces.length > 0 ? `${choosingPlaces.length} quán phù hợp` : "Chưa có quán thuộc loại này"}</p>
                <div className="modal-actions">
                  <button className="primary" disabled={choosingPlaces.length === 0} onClick={() => startSurprise(surprise.category)}>Bốc quán <ArrowRight size={18} aria-hidden="true" /></button>
                </div>
              </div>
            ) : surprise.phase === "spinning" ? (
              <div className="surprise-spinning" role="status" aria-label="Đang quay chọn quán">
                <span className="overline">Túi mù Dateny</span>
                <h2 id="surprise-title">Đang chọn quán…</h2>
                <div className="spin-window" aria-hidden="true">
                  <div className="spin-place" key={`${surprise.step}-${surprise.previewPlace.id}`}>
                    <span>{categoryLabels[surprise.previewPlace.category]}</span>
                    <strong>{surprise.previewPlace.name}</strong>
                  </div>
                </div>
                <div className="spin-track" aria-hidden="true"><span style={{ width: `${((surprise.step + 1) / surprise.total) * 100}%` }} /></div>
                <p>Đang quay qua {surprise.poolSize} quán</p>
              </div>
            ) : (
              <div className="surprise-revealed" aria-live="polite">
                <span className="surprise-reveal-icon" aria-hidden="true">{surprise.place.category === "cafe" ? <Coffee size={28} /> : <Store size={28} />}</span>
                <span className="overline">Túi mù đã mở</span>
                <h2 id="surprise-title" tabIndex={-1}>{surprise.place.name}</h2>
                <p className="surprise-place-meta">{categoryLabels[surprise.place.category]} · {formatDistance(surprise.place.distanceMeters)}</p>
                {surprise.place.address && <p className="surprise-place-address">{surprise.place.address}</p>}
                <div className="modal-actions">
                  {coordinates && <DirectionsButton place={surprise.place} onClick={() => startDirections(surprise.place)} className="primary modal-directions" label="Xem đường đi" />}
                  <button onClick={() => startSurprise(surprise.category)}><Gift size={17} aria-hidden="true" /> Bốc lại</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {routePlace && coordinates && <RoutePreview origin={routeOrigin ?? coordinates} destination={routePlace} route={routeData} mode={routeMode} status={routeStatus} error={routeError} onModeChange={(mode) => startDirections(routePlace, mode)} onRetry={() => startDirections(routePlace, routeMode)} onClose={closeDirections} />}
      {dateJackpotOpen && coordinates && <DateJackpot origin={coordinates} foodPlaces={availablePlaces.filter((place) => place.distanceMeters <= radiusMeters)} radiusMeters={radiusMeters} onClose={() => setDateJackpotOpen(false)} onDirections={startDirections} />}
      <div className={`mobile-pick-dock ${initialMode === "couple" ? "mobile-pick-dock--couple" : ""}`}>
        <button className="pick-button pick-button--mobile" onClick={openSurprise} disabled={surpriseBasePlaces.length === 0}><Gift size={19} aria-hidden="true" /><span>{initialMode === "couple" ? "Bốc một quán" : "Bốc túi mù"}</span><ArrowRight size={19} aria-hidden="true" /></button>
        {initialMode === "couple" && <button className="date-action date-action--mobile" onClick={() => setDateJackpotOpen(true)} disabled={!coordinates || !hasCoverage}><Sparkles size={19} aria-hidden="true" /><span>Cả buổi hẹn</span></button>}
      </div>
    </main>
  );
}
