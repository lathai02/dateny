export type ReviewImage = {
  id: string;
  publicUrl: string;
};

export type PlaceReview = {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
  images: ReviewImage[];
};

export type ReviewsResponse = {
  enabled: boolean;
  setupIssue?: "public_config_missing" | "server_secret_missing";
  averageRating: number | null;
  reviewCount: number;
  reviews: PlaceReview[];
};

