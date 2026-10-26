# Dateny

Mobile-first nearby restaurant and cafe discovery with OpenStreetMap data.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, choose a mode, then allow browser location access. Geolocation requires HTTPS or `localhost`. No Google API key is needed.

## Nearby places

`GET /api/places/nearby?lat=21.0285&lon=105.8542&radius=2000&category=all`

- `lat` and `lon`: required coordinates.
- `radius`: optional integer meters, 250–5000; defaults to 2000.
- `category`: `all`, `restaurant`, `cafe`, or `fast_food`; defaults to `all`.

The route validates inputs and uses a latency-first provider chain: Geoapify (when `GEOAPIFY_API_KEY` is configured), Photon, then Overpass. Geoapify is the recommended production source; Photon and Overpass are keyless development fallbacks backed by OpenStreetMap. It returns named places with distance and only the metadata actually present. `src/lib/places/types.ts` defines the provider-independent `Place` model; provider adapters live in `src/lib/places/`. `GEOAPIFY_DAILY_REQUEST_LIMIT` provides a per-process safety cap and falls back to keyless sources after the cap; provider-side quotas remain authoritative.

Copy `.env.example` to `.env.local` and set `GEOAPIFY_API_KEY` for the fastest supported production lookup. The key stays server-side. A replacement tile or places provider may require its own attribution in addition to the mandatory OpenStreetMap data attribution.

## Walking route preview

Choose a place and tap **Chỉ đường**. Dateny opens a compact walking-route preview. Tap **Bắt đầu dẫn đường** to navigate inside Dateny with live GPS position, upcoming turns, remaining walking time/distance, map recentering, optional voice prompts, and bounded automatic rerouting when reliably off-route. **Mở Google Maps** remains an optional fallback. No Google Cloud key or billing is required. The route API is `GET /api/places/route?fromLat=21.0285&fromLon=105.8542&toLat=21.0295&toLon=105.8552`.

Live navigation requires the page to remain open on HTTPS (or localhost) with location permission. GPS accuracy and browser voice support vary by device; this web app does not offer traffic data or reliable background navigation. Route requests send start/end coordinates to the configured OSRM provider. The default FOSSGIS OSRM service is suitable for development and light, non-commercial use; set `OSRM_FOOT_BASE_URL` to a suitable routing deployment for production.

## Reviews, photos and social login

Dateny supports one 1–5 star review per user and place, review editing/deletion, and up to four JPEG/PNG/WebP photos (5 MB each). Authentication uses Google or Facebook through Supabase Auth. Review text is public. Photos live in a private bucket and are returned through 15-minute signed URLs. Writes and uploads only pass through the authenticated, rate-limited server route.

1. Create a Supabase project and run every SQL file in `supabase/migrations/` in filename order (or use the Supabase CLI).
2. Copy the Project URL and Publishable key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Copy a new Supabase Secret key into `.env.local` as `SUPABASE_SECRET_KEY`. This key is server-only, bypasses RLS, and must never use a `NEXT_PUBLIC_` prefix or be sent to a browser.
4. In Supabase Authentication, enable Google and Facebook. Add `http://localhost:3000/auth/callback` and the production callback to the redirect allow list.
5. In Google/Facebook developer settings, use the provider callback shown by Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.

Provider client secrets stay in the Supabase dashboard and must not be committed to this repository.

## Security and cost controls

- `.env.local` and all other real `.env*` files are ignored by Git; only the empty `.env.example` template is tracked.
- The browser receives only the Supabase publishable key. `SUPABASE_SECRET_KEY` and `GEOAPIFY_API_KEY` are server-only.
- Place, routing, review-read, review-write, and review-delete endpoints have bounded per-process rate limits. Add hosting-provider WAF/rate limits for distributed production traffic.
- The review bucket is private; direct browser uploads are disabled; file size, MIME type, and file signatures are checked server-side.
- Public reviews use a stable pseudonym instead of copying a person's OAuth name, email, or profile-photo URL.
- Set usage limits, alerts, and referrer/IP restrictions in each paid provider dashboard. Application rate limits are defense in depth, not a billing guarantee.
- Run Supabase Security Advisor after every schema or RLS change and rotate any secret immediately if it appears in source control, logs, screenshots, or chat.

Overpass/OSM is not a restaurant review service. Nearby place cards do not claim photos or ratings that the provider has not supplied. The large hero photo is decorative, not a photo of a returned place.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run measure
```

Public Photon, Overpass and OpenStreetMap tile services are best-effort resources for development and light traffic. Photon may return fewer fields than Overpass. Before a larger production launch, configure Geoapify (or another hosted places source) and a tile provider with suitable capacity. The current server cache and request spacing are per process, not shared across deployments.

## Structure and older devices

See [architecture and performance notes](docs/performance.md) for module boundaries, measurements, verification and limitations.

`/lite` is a separate, ES5/CSS3-compatible document for older devices. iOS below 16.4 is redirected there on homepage/discovery requests. It supports location-based search, filters, random picks and external directions, but does not include sign-in, reviews or the interactive map. No location is persisted in local storage. Use `/?view=full` to explicitly request the full interface.

Browser regression tests use installed Chrome by default, mock places/routes/tiles and do not call paid providers. Set `PLAYWRIGHT_CHANNEL` to another installed Playwright channel if needed. Set `PLAYWRIGHT_BASE_URL` to test an already-running local production build; otherwise Playwright starts port 3101. Screenshots/traces are ignored under `artifacts/` and `test-results/`.
