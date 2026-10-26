"use client";
import dynamic from "next/dynamic";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Gift,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  GlassButton,
  GlassPanel,
  SegmentedControl,
} from "@/components/design-system";
import { RandomModeHeadline } from "@/components/typing-headline";
import { DirectionsButton } from "@/components/directions-button";
import type { NearbyMapProps } from "@/features/map/nearby-map";
import { GeolocationPermissionControl } from "@/features/location/geolocation-control";
import { useLocation } from "@/features/location/use-location";
import type { TravelMode } from "@/lib/places/route-types";
import type { DateSpot } from "@/lib/places/date-plan";
import type { Place, PlaceCategoryFilter } from "@/lib/places/types";
import { formatDistance } from "@/lib/format";
import {
  modeData,
  categoryLabels,
  categories,
  radiusOptions,
  type Mode,
} from "./config";
import { useNearbyPlaces } from "./use-nearby-places";
import { useDirections } from "./use-directions";
import { DiscoveryGate } from "./discovery-gate";
import { AppNav } from "./app-nav";
import { PlaceList } from "./place-list";

const NearbyMap = dynamic<NearbyMapProps>(
  () => import("@/features/map/nearby-map"),
  {
    ssr: false,
    loading: () => (
      <div className="map-loading" role="status">
        Đang mở bản đồ…
      </div>
    ),
  },
);
const RoutePreview = dynamic(
  () => import("@/features/directions/directions-panel"),
  { ssr: false },
);
const DateJackpot = dynamic(() => import("@/features/date-plan/date-jackpot"), {
  ssr: false,
});
const PlaceDetails = dynamic(() => import("./place-details"), { ssr: false });
const SurpriseDialog = dynamic(() => import("./surprise-dialog"), {
  ssr: false,
});

export default function DiscoveryScreen({
  initialMode,
}: {
  initialMode: Mode;
}) {
  const {
    location,
    request,
    accept: acceptBrowserLocation,
    reject: rejectBrowserLocation,
  } = useLocation();
  const coordinates = location.coordinates;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("vi"));
  const [category, setCategory] = useState<PlaceCategoryFilter>("all");
  const [radiusMeters, setRadiusMeters] = useState(2_000);
  const {
    results,
    hasCoverage,
    requestState,
    requestError,
    retry,
    hasEnteredDiscovery,
    places: availablePlaces,
  } = useNearbyPlaces(coordinates, radiusMeters);
  const {
    place: routePlace,
    origin: routeOrigin,
    route: routeData,
    mode: routeMode,
    status: routeStatus,
    error: routeError,
    start,
    close: closeDirections,
  } = useDirections(coordinates);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [lastSurpriseId, setLastSurpriseId] = useState<string | null>(null);
  const acceptSurprise = useCallback((place: Place) => {
    setLastSurpriseId(place.id);
    setSelectedPlace(place);
  }, []);
  const [dateJackpotOpen, setDateJackpotOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const closeSurprise = useCallback(() => setSurpriseOpen(false), []);
  const requestLocation = useCallback(() => {
    closeDirections();
    request();
  }, [closeDirections, request]);
  const index = useMemo(
    () =>
      availablePlaces.map((place) => ({
        place,
        text: [place.name, place.address, place.cuisine]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("vi"),
      })),
    [availablePlaces],
  );
  const foodPlaces = useMemo(
    () =>
      availablePlaces.filter((place) => place.distanceMeters <= radiusMeters),
    [availablePlaces, radiusMeters],
  );
  const surpriseBasePlaces = useMemo(
    () =>
      index
        .filter(
          (item) =>
            item.place.distanceMeters <= radiusMeters &&
            item.text.includes(deferredQuery),
        )
        .map((item) => item.place),
    [index, radiusMeters, deferredQuery],
  );
  const filteredPlaces = useMemo(
    () =>
      surpriseBasePlaces.filter(
        (place) => category === "all" || place.category === category,
      ),
    [surpriseBasePlaces, category],
  );
  const visibleSelectedPlace = selectedPlace
    ? (filteredPlaces.find((place) => place.id === selectedPlace.id) ?? null)
    : null;
  const activeMode = modeData[initialMode];
  const ActiveIcon = activeMode.icon;
  const focusPlace = useCallback(
    (place: Place) => {
      closeDirections();
      setSelectedPlace(place);
    },
    [closeDirections],
  );
  const selectAndScroll = useCallback(
    (place: Place) => {
      focusPlace(place);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      mapSectionRef.current?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "center",
      });
    },
    [focusPlace],
  );
  const openDetails = useCallback(
    (place: Place) => {
      focusPlace(place);
      setDetailPlace(place);
    },
    [focusPlace],
  );
  const startDirections = useCallback(
    (destination: Place | DateSpot, mode: TravelMode = "walking") => {
      setDetailPlace(null);
      setSurpriseOpen(false);
      setDateJackpotOpen(false);
      void start(destination, mode);
    },
    [start],
  );
  const openSurprise = () => {
    if (surpriseBasePlaces.length) {
      closeDirections();
      setDetailPlace(null);
      setSurpriseOpen(true);
    }
  };
  const toggleFavorite = useCallback(
    (id: string) =>
      setFavorites((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      ),
    [],
  );
  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
    setRadiusMeters(2_000);
    closeDirections();
  }, [closeDirections]);
  if (!hasEnteredDiscovery)
    return (
      <DiscoveryGate
        mode={initialMode}
        location={location}
        requestState={requestState}
        requestError={requestError}
        requestLocation={requestLocation}
        acceptBrowserLocation={acceptBrowserLocation}
        rejectBrowserLocation={rejectBrowserLocation}
        retry={retry}
      />
    );

  return (
    <>
      <main className={`discovery-page theme-${initialMode}`}>
        <AppNav mode={initialMode} />

        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-copy-main">
              <span className="hero-mode">
                <ActiveIcon size={18} aria-hidden="true" />
                {activeMode.label}
              </span>
              <RandomModeHeadline key={initialMode} mode={initialMode} />
            </div>
            {
              <aside
                className="hero-slogan"
                aria-label={`${surpriseBasePlaces.length} quán gần bạn. Để Dateny chọn giúp.`}
              >
                <p className="hero-slogan-count">
                  <strong>{surpriseBasePlaces.length}</strong>
                  <span>quán gần bạn</span>
                </p>
                <h2>
                  Khỏi nghĩ lâu.
                  <br />
                  Để Dateny chọn giúp.
                </h2>
              </aside>
            }
            <div className="hero-actions">
              <button
                className="pick-button pick-button--desktop"
                onClick={openSurprise}
                disabled={surpriseBasePlaces.length === 0}
              >
                <Gift size={19} aria-hidden="true" />
                <span>Bốc một quán</span>
                <ArrowRight size={19} aria-hidden="true" />
              </button>
              {initialMode === "couple" && (
                <button
                  className="date-action date-action--desktop"
                  onClick={() => setDateJackpotOpen(true)}
                  disabled={!coordinates || !hasCoverage}
                >
                  <Sparkles size={19} aria-hidden="true" />
                  <span>Bốc cả buổi hẹn</span>
                  <ArrowRight size={19} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="explore-section" aria-labelledby="explore-title">
          <div className="explore-head">
            <div>
              <h2 id="explore-title">Quanh đây</h2>
            </div>
          </div>
          {(location.status === "denied" || location.status === "error") && (
            <p className="location-alert" role="alert">
              {location.message}
            </p>
          )}

          {coordinates && (
            <>
              <div className="map-section" ref={mapSectionRef}>
                <div className="map-shell">
                  {!routePlace && (
                    <NearbyMap
                      center={coordinates}
                      places={filteredPlaces}
                      selectedPlace={visibleSelectedPlace}
                      route={null}
                      onSelectPlace={focusPlace}
                    />
                  )}
                  <div className="map-floating-toolbar">
                    <span className="map-heading">
                      <strong>Bản đồ</strong>
                      <small>
                        {hasCoverage
                          ? `${filteredPlaces.length} địa điểm`
                          : "Đang tìm địa điểm"}
                      </small>
                    </span>
                    <GlassButton
                      className="map-locate-button"
                      onClick={requestLocation}
                      aria-label="Cập nhật vị trí của tôi"
                    >
                      <MapPin size={18} aria-hidden="true" />
                      <span>Vị trí</span>
                    </GlassButton>
                  </div>
                </div>
                {!routePlace && visibleSelectedPlace && (
                  <GlassPanel className="map-selection" role="status">
                    <span>
                      <strong>{visibleSelectedPlace.name}</strong>
                      <small>
                        {formatDistance(visibleSelectedPlace.distanceMeters)} ·{" "}
                        {categoryLabels[visibleSelectedPlace.category]}
                      </small>
                    </span>
                    <div className="map-selection-actions">
                      <button
                        onClick={() => setDetailPlace(visibleSelectedPlace)}
                      >
                        Chi tiết <ArrowRight size={16} aria-hidden="true" />
                      </button>
                      <DirectionsButton
                        place={visibleSelectedPlace}
                        onClick={() => startDirections(visibleSelectedPlace)}
                        className="direction-link"
                      />
                    </div>
                  </GlassPanel>
                )}
              </div>

              <GlassPanel className="filters">
                <label className="search-field">
                  <Search size={19} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSelectedPlace(null);
                      closeDirections();
                    }}
                    placeholder="Tìm quán"
                    aria-label="Tìm quán"
                  />
                </label>
                <SegmentedControl
                  label="Bán kính"
                  className="radius-control"
                  options={radiusOptions.map((value) => ({
                    value,
                    label: `${value / 1_000} km`,
                  }))}
                  value={radiusMeters}
                  onChange={(value) => {
                    setRadiusMeters(value);
                    setSelectedPlace(null);
                    closeDirections();
                  }}
                />
                <SegmentedControl
                  label="Loại quán"
                  className="category-control"
                  options={categories.map((item) => ({
                    value: item,
                    label: categoryLabels[item],
                  }))}
                  value={category}
                  onChange={(value) => {
                    setCategory(value);
                    setSelectedPlace(null);
                    closeDirections();
                  }}
                />
              </GlassPanel>

              {!hasCoverage && requestState !== "error" && (
                <div className="data-state" role="status">
                  <span className="loading-dot" />
                  Đang tìm quán gần bạn…
                </div>
              )}
              {requestState === "error" && !hasCoverage && (
                <div className="data-state data-error" role="alert">
                  <span>{requestError}</span>
                  <button onClick={() => retry()}>
                    <RotateCcw size={16} aria-hidden="true" /> Thử lại
                  </button>
                </div>
              )}

              {hasCoverage && (
                <PlaceList
                  key={deferredQuery + category + radiusMeters}
                  places={filteredPlaces}
                  selectedId={visibleSelectedPlace?.id}
                  favorites={favorites}
                  onSelect={selectAndScroll}
                  onOpen={openDetails}
                  onDirections={startDirections}
                  onToggleFavorite={toggleFavorite}
                  onReset={resetFilters}
                />
              )}
              <p className="data-credit">
                Dữ liệu địa điểm: © OpenStreetMap contributors
                {hasCoverage && results?.source !== "overpass"
                  ? ` · qua ${results?.source === "geoapify" ? "Geoapify" : "Photon"}`
                  : ""}
                .
              </p>
            </>
          )}
          {!coordinates && location.status !== "loading" && (
            <div className="location-empty">
              <Navigation size={28} aria-hidden="true" />
              <p>Cho phép vị trí để xem quán thật gần bạn.</p>
              <GeolocationPermissionControl
                onPosition={acceptBrowserLocation}
                onError={rejectBrowserLocation}
                onFallback={requestLocation}
              />
            </div>
          )}
          {location.status === "loading" && (
            <div className="location-empty" role="status">
              <span className="loading-dot" />
              <p>Đang xác định vị trí của bạn…</p>
            </div>
          )}
        </section>

        {detailPlace && (
          <PlaceDetails
            place={detailPlace}
            onClose={() => setDetailPlace(null)}
            onDirections={startDirections}
          />
        )}

        {surpriseOpen && (
          <SurpriseDialog
            places={surpriseBasePlaces}
            initialCategory={category}
            previousPickId={lastSurpriseId}
            onClose={closeSurprise}
            onCategoryChange={setCategory}
            onSelect={acceptSurprise}
            onDirections={startDirections}
          />
        )}
        {routePlace && coordinates && (
          <RoutePreview
            key={routePlace.id + routeMode}
            origin={routeOrigin ?? coordinates}
            destination={routePlace}
            route={routeData}
            mode={routeMode}
            status={routeStatus}
            error={routeError}
            onModeChange={(mode) => startDirections(routePlace, mode)}
            onRetry={() => startDirections(routePlace, routeMode)}
            onClose={closeDirections}
          />
        )}
        {dateJackpotOpen && coordinates && (
          <DateJackpot
            origin={coordinates}
            foodPlaces={foodPlaces}
            radiusMeters={radiusMeters}
            onClose={() => setDateJackpotOpen(false)}
            onDirections={startDirections}
          />
        )}
        <div
          className={`mobile-pick-dock ${initialMode === "couple" ? "mobile-pick-dock--couple" : ""}`}
        >
          <button
            className="pick-button pick-button--mobile"
            onClick={openSurprise}
            disabled={surpriseBasePlaces.length === 0}
          >
            <Gift size={19} aria-hidden="true" />
            <span>
              {initialMode === "couple" ? "Bốc một quán" : "Bốc túi mù"}
            </span>
            <ArrowRight size={19} aria-hidden="true" />
          </button>
          {initialMode === "couple" && (
            <button
              className="date-action date-action--mobile"
              onClick={() => setDateJackpotOpen(true)}
              disabled={!coordinates || !hasCoverage}
            >
              <Sparkles size={19} aria-hidden="true" />
              <span>Cả buổi hẹn</span>
            </button>
          )}
        </div>
      </main>
    </>
  );
}
