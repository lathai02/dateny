import { getRoute } from "@/server/places/routing";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return getRoute(request);
}
