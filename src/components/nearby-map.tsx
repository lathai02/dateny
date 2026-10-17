"use client";

import { useEffect, useMemo, useRef } from "react";
import { divIcon, type Polyline as LeafletPolyline } from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import type { WalkingRoute } from "@/lib/places/route-types";
import type { Coordinates, Place } from "@/lib/places/types";

export type NearbyMapProps = {
  center: Coordinates;
  places: Place[];
  selectedPlace: Place | null;
  route: WalkingRoute | null;
  onSelectPlace: (place: Place) => void;
  navigationPosition?: Coordinates;
  navigationHeading?: number | null;
  followUser?: boolean;
  onUserPan?: () => void;
};

const tileUrl = process.env.NEXT_PUBLIC_OSM_TILE_URL?.trim()
  || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const additionalAttribution = process.env.NEXT_PUBLIC_OSM_TILE_ATTRIBUTION?.trim();
const tileAttribution = additionalAttribution
  ? `${osmAttribution} | ${additionalAttribution}`
  : osmAttribution;

function AnimatedWalkingRoute({ route }: { route: WalkingRoute }) {
  const polylineRef = useRef<LeafletPolyline>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let path: SVGPathElement | null = null;
    let revealFrame = 0;
    const setupFrame = window.requestAnimationFrame(() => {
      const element = polylineRef.current?.getElement();
      if (!(element instanceof SVGPathElement)) return;
      const length = element.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return;
      path = element;
      element.style.strokeDasharray = `${length}`;
      element.style.strokeDashoffset = `${length}`;
      revealFrame = window.requestAnimationFrame(() => {
        element.style.transition = "stroke-dashoffset 720ms cubic-bezier(.22,1,.36,1)";
        element.style.strokeDashoffset = "0";
      });
    });
    return () => {
      window.cancelAnimationFrame(setupFrame);
      window.cancelAnimationFrame(revealFrame);
      if (path) {
        path.style.transition = "";
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "";
      }
    };
  }, [route]);

  return <Polyline ref={polylineRef} positions={route.coordinates.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#3478f6", weight: 5, opacity: 0.94 }} />;
}

function MapFocus({ center, selectedPlace, route, navigationPosition, followUser, onUserPan }: Omit<NearbyMapProps, "places">) {
  const map = useMap();

  useMapEvents({ dragstart: () => { if (navigationPosition) onUserPan?.(); } });

  useEffect(() => { map.invalidateSize(); }, [map, followUser]);

  useEffect(() => {
    if (!navigationPosition || !followUser) return;
    map.invalidateSize();
    map.setView([navigationPosition.latitude, navigationPosition.longitude], Math.max(map.getZoom(), 17), { animate: false });
  }, [map, navigationPosition?.latitude, navigationPosition?.longitude, followUser, navigationPosition]);

  useEffect(() => {
    if (navigationPosition) return;
    map.invalidateSize();
    if (route && route.coordinates.length > 1) {
      map.fitBounds(route.coordinates.map((point) => [point.latitude, point.longitude]), { padding: [48, 48], maxZoom: 16, animate: false });
      return;
    }
    const target = selectedPlace ?? center;
    const position: [number, number] = [target.latitude, target.longitude];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (selectedPlace) {
      map.flyTo(position, Math.max(map.getZoom(), 16), { animate: !reducedMotion, duration: 0.65 });
    } else {
      map.setView(position, 14, { animate: !reducedMotion });
    }
  }, [center, map, selectedPlace, route, navigationPosition]);

  return null;
}

export default function NearbyMap({ center, places, selectedPlace, route, onSelectPlace, navigationPosition, navigationHeading, followUser, onUserPan }: NearbyMapProps) {
  const standardIcon = useMemo(() => divIcon({
    className: "dateny-marker",
    html: "<span></span>",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  }), []);
  const selectedIcon = useMemo(() => divIcon({
    className: "dateny-marker dateny-marker-selected",
    html: "<span></span>",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  }), []);
  const userIcon = useMemo(() => divIcon({
    className: "dateny-user-marker",
    html: `<span style="transform:rotate(${Number.isFinite(navigationHeading) ? navigationHeading : 0}deg)">▲</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  }), [navigationHeading]);

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={14}
      minZoom={11}
      maxZoom={19}
      zoomControl={false}
      scrollWheelZoom={Boolean(navigationPosition)}
      className="nearby-map"
      aria-label="Bản đồ quán ăn và cà phê gần bạn"
    >
      <TileLayer url={tileUrl} attribution={tileAttribution} maxZoom={19} />
      <ZoomControl position="bottomright" />
      {route && <AnimatedWalkingRoute route={route} />}
      {navigationPosition ? <Marker position={[navigationPosition.latitude, navigationPosition.longitude]} icon={userIcon}><Popup>Vị trí hiện tại</Popup></Marker> : <CircleMarker
        center={[center.latitude, center.longitude]}
        radius={19}
        pathOptions={{ color: "#fff", weight: 3, fillColor: "#3478f6", fillOpacity: 1 }}
      >
        <Popup>Vị trí của bạn</Popup>
      </CircleMarker>}
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={selectedPlace?.id === place.id ? selectedIcon : standardIcon}
          eventHandlers={{ click: () => onSelectPlace(place) }}
        >
          <Popup>
            <strong>{place.name}</strong>
            {place.address && <span className="map-popup-address">{place.address}</span>}
          </Popup>
        </Marker>
      ))}
      <MapFocus center={center} selectedPlace={selectedPlace} route={route} onSelectPlace={onSelectPlace} navigationPosition={navigationPosition} followUser={followUser} onUserPan={onUserPan} />
    </MapContainer>
  );
}
