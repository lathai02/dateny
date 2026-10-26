import { getNearbyPlaces } from "@/server/places/nearby";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return getNearbyPlaces(request);
}
