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

The route validates inputs and queries Overpass server-side. If Overpass is unavailable, it makes one bounded request to Photon, which also indexes OpenStreetMap data. It returns named places with distance and only the metadata actually present. `src/lib/places/types.ts` defines the provider-independent `Place` model; `src/lib/places/overpass.ts` and `src/lib/places/photon.ts` contain the provider adapters.

Copy `.env.example` to `.env.local` only if you need to change the Overpass endpoint or tile provider. A replacement tile provider may require its own attribution in addition to the mandatory OpenStreetMap data attribution.

## Walking route preview

Choose a place and tap **Chỉ đường**. Dateny opens a compact walking-route preview. Tap **Bắt đầu dẫn đường** to navigate inside Dateny with live GPS position, upcoming turns, remaining walking time/distance, map recentering, optional voice prompts, and bounded automatic rerouting when reliably off-route. **Mở Google Maps** remains an optional fallback. No Google Cloud key or billing is required. The route API is `GET /api/places/route?fromLat=21.0285&fromLon=105.8542&toLat=21.0295&toLon=105.8552`.

Live navigation requires the page to remain open on HTTPS (or localhost) with location permission. GPS accuracy and browser voice support vary by device; this web app does not offer traffic data or reliable background navigation. Route requests send start/end coordinates to the configured OSRM provider. The default FOSSGIS OSRM service is suitable for development and light, non-commercial use; set `OSRM_FOOT_BASE_URL` to a suitable routing deployment for production.

Overpass/OSM is not a restaurant review service. Nearby place cards do not claim photos or ratings that the provider has not supplied. The large hero photo is decorative, not a photo of a returned place.

## Checks

```bash
npm run lint
npm run build
```

Public Overpass, Photon and OpenStreetMap tile services are best-effort resources for development and light traffic. Photon may return fewer places or omit fields available in Overpass. Before a larger production launch, arrange a tile provider and a hosted places data source with suitable capacity. The current server cache and request spacing are per process, not shared across deployments.
