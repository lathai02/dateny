"use client";
import { Coffee, MapPin, Store, Utensils, X } from "lucide-react";
import { DirectionsButton } from "@/components/directions-button";
import { PlaceReviews } from "@/features/reviews/place-reviews";
import { useDialog } from "@/hooks/use-dialog";
import { formatDistance } from "@/lib/format";
import { categoryLabels } from "./config";
import type { Place } from "@/lib/places/types";
export default function PlaceDetails({
  place: detailPlace,
  onClose,
  onDirections,
}: {
  place: Place;
  onClose: () => void;
  onDirections: (place: Place) => void;
}) {
  const dialogRef = useDialog<HTMLElement>(onClose);
  const CategoryIcon =
    detailPlace.category === "cafe"
      ? Coffee
      : detailPlace.category === "fast_food"
        ? Utensils
        : Store;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="result-modal place-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        key={detailPlace.id}
      >
        <button
          className="modal-close"
          onClick={() => onClose()}
          aria-label="Đóng"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <header className="place-detail-hero">
          <div className="place-detail-identity">
            <span
              className="place-detail-category-icon"
              aria-label={categoryLabels[detailPlace.category]}
              title={categoryLabels[detailPlace.category]}
            >
              <CategoryIcon size={21} aria-hidden="true" />
            </span>
            <h2 id="result-title" title={detailPlace.name}>
              {detailPlace.name}
            </h2>
            <div className="modal-meta">
              <span>
                <MapPin size={14} aria-hidden="true" />
                {formatDistance(detailPlace.distanceMeters)}
              </span>
            </div>
          </div>
        </header>
        {(detailPlace.address ||
          detailPlace.cuisine ||
          detailPlace.openingHours ||
          detailPlace.website) && (
          <div className="place-facts">
            {detailPlace.address && (
              <p>
                <strong>Địa chỉ</strong>
                <span>{detailPlace.address}</span>
              </p>
            )}
            {detailPlace.cuisine && (
              <p>
                <strong>Ẩm thực</strong>
                <span>{detailPlace.cuisine.replaceAll(";", ", ")}</span>
              </p>
            )}
            {detailPlace.openingHours && (
              <p>
                <strong>Giờ mở cửa</strong>
                <span>{detailPlace.openingHours}</span>
              </p>
            )}
            {detailPlace.website && (
              <p>
                <strong>Website</strong>
                <a
                  href={detailPlace.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {detailPlace.website}
                </a>
              </p>
            )}
          </div>
        )}
        <div className="modal-actions">
          {
            <DirectionsButton
              place={detailPlace}
              onClick={() => onDirections(detailPlace)}
              className="primary modal-directions"
              label="Xem đường đi"
            />
          }
        </div>
        <PlaceReviews place={detailPlace} />
      </section>
    </div>
  );
}
