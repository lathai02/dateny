# Dateny — Section 12 visual acceptance audit

Audit date: 2026-10-17. Scope: homepage, mode selection, discovery, map, and in-app directions.

**Overall result: FAIL (not ready for visual sign-off).** The implementation and non-visual checks have progressed, but the required rendered visual and interaction checks could not be run. The in-app Browser reported `No browser is available` and listed no browser sessions. No after screenshot was captured. CSS declarations are not treated as proof that an effect is perceptible.

Status meanings: **PASS** = verified with the stated evidence; **FAIL** = known unmet requirement; **NOT VERIFIED** = implemented or inspectable in source, but its required rendered behavior has not been observed.

| Section 12 criterion | Status | Evidence and remaining check |
| --- | --- | --- |
| A — 45–80% glass transparency, 16–32px blur, 130–180% saturation | NOT VERIFIED | Shared glass uses `rgba(255,255,255,.62)` and `blur(24px) saturate(155%)` in `globals.css`; the rendered opacity and backdrop readability on a photograph/map need inspection. |
| A — differentiated 1px edge, two depth cues, ambient/contact shadows | NOT VERIFIED | Shared tokens include different bottom border, two outer shadows and two inset reflections; no screenshot confirms perceptible depth. |
| A — readable glass over light and colorful backgrounds, perceptible backdrop | NOT VERIFIED | Map toolbar, photo badge and directions header use glass; the map/photo acceptance test has not been run. No true physical refraction is claimed. |
| B — background/content/floating-control depth, 8–16px mobile nav inset, soft elevation | NOT VERIFIED | Homepage has ambient/background, card stage, floating nav; discovery has map under floating toolbar. Nav CSS uses 16px horizontal inset. Perceptual layering still needs the three viewport checks. |
| B — no uninterrupted saturated blocks or obscured map interaction | NOT VERIFIED | Map toolbar passes pointer events through except on the locate button; its visual footprint and map usability require interaction testing. |
| C — button press 100–160ms, release 180–280ms | NOT VERIFIED | Shared/button active states use scale `.97` at `.13s`, release `.23s`; actual press and release were not exercised in a browser. |
| C — 350–550ms shared mode indicator and theme interpolation | NOT VERIFIED | One selection lens moves over `.45s`; theme ambient/accent transitions are `.45s`; linked navigation waits 460ms. Movement/perceptibility not observed. |
| C — 180–260ms card hover and 250–400ms selection | NOT VERIFIED | Mode tile hover `.24s` and selected result card `.32s` exist; hover/selection need rendered testing. |
| C — 350–500ms modal and 400–600ms bottom sheet | NOT VERIFIED | Dialog is `.42s`; bottom sheet is `.52s`; their appearance has not been observed. |
| C — 200–350ms filter indicator, 500–900ms route reveal, 250–450ms staggered results | NOT VERIFIED | Segmented indicator `.3s`; Leaflet route dash reveal `720ms`; result cards `.4s` with `40ms` stagger. Interaction/performance unobserved. |
| C — transform/opacity preference, reduced motion, no distracting continuous animation | NOT VERIFIED | Motion CSS prefers transform/opacity, reduced-motion media rule exists, route reveal and mode navigation check media preference. Loading spinner remains purpose-driven. Reduced-motion state was not tested. |
| D — Solo blue, Couple rose, Friends violet; distinct ambient and movement | NOT VERIFIED | Exact primary tokens `#2463E8`, `#DF5074`, `#7358D8`, separate ambient colors/imagery/easing are present. Same-screen screenshots for all three modes were not captured, so recognition without labels is unproven. |
| E — homepage structure, floating nav, spatial glass cards, ambient lighting | NOT VERIFIED | The homepage now has inset glass nav, an ambient layer, a stage and three interactive glass cards with a shared moving lens. No matched before/after viewport comparison exists. |
| E — segmented filters, tactile primary actions, restrained typography, overlap, responsiveness | NOT VERIFIED | Search/filter panel uses reusable `SegmentedControl`; buttons have press states; map toolbar and photo badge overlap content. Rendered hierarchy and responsive layout need QA. |
| F — map primary; shared glass map controls, elevated directions, animated travel indicator | NOT VERIFIED | Map appears before filters; locate/zoom controls share glass styling; route preview has elevated information panel and an animated walking-mode pill. Only walking directions exist. Visual consistency requires a side-by-side check. |
| F — route labels, Leaflet performance and attribution | NOT VERIFIED | Route is a 5px Polyline; attribution remains configured and controls are moved away from the toolbar. Map labels, frame rate and attribution visibility require browser testing. |
| G — 44px touch targets | NOT VERIFIED | Main controls and place/map markers have at least 44px boxes in source, including 44px Leaflet icon sizes; actual hit areas need touch/DOM inspection. |
| G — text contrast and keyboard focus | NOT VERIFIED | Sampled colors meet 4.5:1 mathematically (muted `#6b7280` on white: 4.83:1; placeholder `#70717a` on white: 4.85:1); glass compositing, imagery, all states and focus-ring visibility require rendered testing. |
| G — no overflow at 375/768/1440, no layout shifts, >=55 FPS | NOT VERIFIED | Discovery ambient overflow is clipped; expensive blur is static, and slow-update/reduced-transparency fallback exists. No viewport measurements or frame traces were available. |
| H — 375×812, 768×1024 and 1440×900 screens/states | NOT VERIFIED | The Browser returned `No browser is available`; no screenshots, interaction runs or viewport metrics were obtained. |
| I — all visual identities, coherent glass system, six verified interactions, accessible responsiveness, existing features, screenshot comparison | FAIL | These are not fully verified; in particular, six interactions and required rendered checks have not been observed. Source changes, passing build/lint, three navigation unit tests and HTTP 200 responses cannot satisfy visual sign-off. |

## Viewport matrix

Each cell below is **NOT VERIFIED**. The local route returned HTTP 200, but an HTTP response is not a rendered viewport test. Discovery also requires a browser geolocation decision and place data to reach its full state.

| Screen/state | 375×812 | 768×1024 | 1440×900 |
| --- | --- | --- | --- |
| Homepage mode selection | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Solo discovery | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Couple discovery | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Friends discovery | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Nearby places/map | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| In-app directions | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Selected/pressed/loading/empty/error/reduced-motion states | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |

## Verified non-visual checks

- `npm.cmd run build`: PASS (Next.js compilation and TypeScript).
- `npm.cmd run lint`: PASS.
- `node --experimental-strip-types --test tests/navigation.test.mjs`: PASS, 3/3 navigation-unit tests.
- `GET /`, `/goi-y/solo`, `/goi-y/couple`, `/goi-y/friends` on local dev server: PASS, HTTP 200. This does **not** verify geolocation, search, random selection, map or routing in the browser.
- `git diff --check`: PASS (only Git line-ending warnings).

Visual sign-off needs a Browser session with geolocation/mock place data, screenshots of the old and new UI at matching viewports, interaction recordings or traces for the ten motion types, keyboard/touch checks, horizontal-overflow measurements, attribution inspection and a transition FPS trace. Do not change any **NOT VERIFIED** item to **PASS** merely by reading CSS.
