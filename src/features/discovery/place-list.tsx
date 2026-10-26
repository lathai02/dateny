import { memo, useState } from "react";
import type { Place } from "@/lib/places/types";
import PlaceCard from "./place-card";

const PAGE_SIZE = 12;

export const PlaceList = memo(function PlaceList({
  places,
  selectedId,
  favorites,
  onSelect,
  onOpen,
  onDirections,
  onToggleFavorite,
  onReset,
}: {
  places: Place[];
  selectedId?: string;
  favorites: string[];
  onSelect: (place: Place) => void;
  onOpen: (place: Place) => void;
  onDirections: (place: Place) => void;
  onToggleFavorite: (id: string) => void;
  onReset: () => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return (
    <>
      <div className="place-grid">
        {places.slice(0, limit).map((place, index) => (
          <PlaceCard
            key={place.id}
            place={place}
            selected={place.id === selectedId}
            favorite={favorites.includes(place.id)}
            entranceDelay={Math.min(index, 8) * 40}
            onSelect={onSelect}
            onOpen={onOpen}
            onDirections={onDirections}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
        {places.length === 0 && (
          <div className="empty-state">
            <strong>Chưa tìm thấy quán.</strong>
            <button onClick={onReset}>Đặt lại bộ lọc</button>
          </div>
        )}
      </div>
      {limit < places.length && (
        <button
          className="load-more"
          onClick={() => setLimit((value) => value + PAGE_SIZE)}
        >
          Xem thêm quán ({Math.min(limit, places.length)}/{places.length})
        </button>
      )}
    </>
  );
});
