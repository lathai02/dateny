export const PLACE_CATEGORIES = ["restaurant", "cafe", "fast_food"] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
export type PlaceCategoryFilter = PlaceCategory | "all";
export type OsmElementType = "node" | "way" | "relation";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

// The UI depends on this model, not on Overpass response fields.
export type Place = Coordinates & {
  id: string;
  osmType?: OsmElementType;
  name: string;
  category: PlaceCategory;
  distanceMeters: number;
  address?: string;
  cuisine?: string;
  openingHours?: string;
  website?: string;
};

export type NearbyPlacesResponse = {
  places: Place[];
  center: Coordinates;
  radiusMeters: number;
  category: PlaceCategoryFilter;
  source: "overpass" | "photon";
  fetchedAt: string;
};
