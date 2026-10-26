import { Navigation } from "lucide-react";
import type { Place } from "@/lib/places/types";
export function DirectionsButton({
  place,
  onClick,
  className = "",
  label = "Chỉ đường",
}: {
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
