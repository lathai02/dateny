import { memo } from "react";
import { ArrowRight, Coffee, Heart, Store } from "lucide-react";
import { DirectionsButton } from "@/components/directions-button";
import { formatDistance } from "@/lib/format";
import { categoryLabels } from "./config";
import type { Place } from "@/lib/places/types";
function PlaceCard({
  place,
  selected,
  favorite,
  entranceDelay,
  onSelect,
  onOpen,
  onDirections,
  onToggleFavorite,
}: {
  place: Place;
  selected: boolean;
  favorite: boolean;
  entranceDelay: number;
  onSelect: (place: Place) => void;
  onOpen: (place: Place) => void;
  onDirections: (place: Place) => void;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <article
      className={`place-card real-place-card ${selected ? "is-selected" : ""}`}
      style={{ animationDelay: `${entranceDelay}ms` }}
    >
      <button
        className="place-main"
        onClick={() => onSelect(place)}
        aria-label={`Hiện ${place.name} trên bản đồ`}
      >
        <span className="place-category-icon">
          {place.category === "cafe" ? (
            <Coffee size={22} aria-hidden="true" />
          ) : (
            <Store size={22} aria-hidden="true" />
          )}
        </span>
        <span className="place-copy">
          <span className="place-type">
            <span>{categoryLabels[place.category]}</span>
            <span>{formatDistance(place.distanceMeters)}</span>
          </span>
          <strong>{place.name}</strong>
          {place.address && (
            <span className="place-address">{place.address}</span>
          )}
          {place.cuisine && (
            <span className="place-cuisine">
              {place.cuisine.replaceAll(";", ", ")}
            </span>
          )}
        </span>
      </button>
      <div className="place-footer">
        <button
          className={`heart-button ${favorite ? "saved" : ""}`}
          onClick={() => onToggleFavorite(place.id)}
          aria-pressed={favorite}
          aria-label={
            favorite
              ? `Bỏ yêu thích ${place.name}`
              : `Thêm yêu thích ${place.name}`
          }
        >
          <Heart size={19} aria-hidden="true" />
        </button>
        <div className="place-footer-actions">
          <button className="detail-button" onClick={() => onOpen(place)}>
            Chi tiết <ArrowRight size={17} aria-hidden="true" />
          </button>
          <DirectionsButton
            place={place}
            onClick={() => onDirections(place)}
            className="direction-link"
          />
        </div>
      </div>
    </article>
  );
}

export default memo(PlaceCard);
