import { getDateSpots } from "@/server/places/date-spots";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return getDateSpots(request);
}
