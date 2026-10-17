# 12. Measurable Visual Acceptance Criteria

## Objective

The Dateny interface must demonstrate a clearly visible transformation from the previous flat web design into an Apple iOS 26-inspired Liquid Glass application.

The existing in-app directions screen is the minimum visual baseline, not the final quality target.

A redesign is considered unsuccessful if the primary differences are limited to colors, border radius, shadows, or basic backdrop blur.

## A. Liquid Glass Material

Every major floating glass component must meet these requirements:

- Background transparency: 45–80%, adjusted for contrast.
- Backdrop blur: 16–32px.
- Saturation: 130–180%.
- Border: 1px translucent highlight with different top and bottom edge intensities.
- At least two visible depth cues: edge highlight, inner reflection, background distortion, layered shadow, or subtle specular highlight.
- Shadow should include a soft ambient layer and a smaller contact layer.
- Glass components must remain visually distinct against both light and colorful backgrounds.
- Glass must preserve readable text and icons.

**Acceptance test:** Place a glass component over a detailed map or photograph. The background must remain perceptible through the component, while text stays readable.

A simple opaque white card with blur does not pass.

CSS blur alone does not qualify as physical refraction. If refraction cannot be implemented efficiently, use subtle optical highlights and layered surfaces rather than claiming true refraction.

## B. Spatial Layering

- Each primary screen must contain at least three perceptible depth levels: background content, content surfaces, and floating controls.
- Floating navigation should visually sit 8–16px away from screen edges on mobile.
- Major floating surfaces should use soft elevation shadows.
- Avoid large, uninterrupted solid-color blocks.
- Floating controls must not obstruct map interactions or important content.

**Acceptance test:** The user should be able to identify the foreground controls, content layer, and background immediately.

## C. Motion and Micro-interactions

The application must contain meaningful motion, not random decorative animations.

| Interaction | Target duration | Expected behavior |
|---|---|---|
| Button press | 100–160ms | Scale to 0.96–0.98 and return |
| Button release | 180–280ms | Spring-like recovery |
| Mode switching | 350–550ms | Shared selection indicator moves, theme colors interpolate |
| Glass card hover | 180–260ms | Lift 3–6px, subtle highlight shift |
| Card selection | 250–400ms | Scale and elevation change |
| Modal appearance | 350–500ms | Fade, translate, subtle scale |
| Bottom sheet opening | 400–600ms | Spring-like slide and settle |
| Filter selection | 200–350ms | Sliding highlight or animated selection |
| Route drawing | 500–900ms | Progressive route reveal |
| Place results | 250–450ms | Staggered entrance, 30–60ms between cards |

All animations must use transform and opacity where possible.

Respect `prefers-reduced-motion`.

Avoid continuous movement, distracting glows, and animations that delay core tasks.

## D. Mode-Specific Visual Identity

The three discovery modes must have distinct emotional atmospheres while sharing the same components.

### Solo — Calm Blue

- Primary accent: `#2463E8`.
- Ambient glow: cool blue.
- Movement: smooth and restrained.
- Visual mood: quiet, focused, breathable.
- Background tint must be visible but subtle.

### Couple — Romantic Rose

- Primary accent: `#DF5074`.
- Ambient glow: rose and warm peach.
- Movement: soft and fluid.
- Visual mood: intimate, elegant, warm.
- Use soft light transitions and warm imagery.

### Friends — Playful Violet

- Primary accent: `#7358D8`.
- Ambient glow: lavender and cool violet.
- Movement: slightly more energetic spring transitions.
- Visual mood: social, spontaneous, playful.
- Keep motion controlled and sophisticated.

**Acceptance test:** Capture screenshots of the same discovery screen in all three modes. A viewer should be able to distinguish the modes without reading their labels.

Do not achieve this by replacing the entire interface with large saturated color blocks.

## E. Layout Transformation

The homepage must not retain the previous traditional landing-page structure unchanged.

Required changes:

- Replace the flat navigation bar with a floating glass navigation system.
- Replace the three solid-colored mode cards with spatial glass-based interactive surfaces.
- Introduce ambient color lighting behind mode-selection content.
- Replace static filter buttons with a shared glass segmented control.
- Make primary actions feel tactile through pressed states and lighting.
- Reduce unnecessarily oversized headings.
- Introduce depth and controlled overlapping where it improves the composition.
- Preserve responsive layout and information clarity.

**Acceptance test:** Compare before-and-after screenshots at the same viewport. The change must be recognizable from layout, layering, material, and interaction design, even if the accent colors are temporarily removed.

## F. Map and Directions Consistency

- The map remains the primary content surface.
- Floating map controls use the shared glass material.
- Route information uses a rounded, elevated panel.
- Selected travel mode uses a visibly animated indicator.
- Route transitions must not obscure map labels.
- The directions screen and discovery screen must use matching radius, shadow, typography, and glass tokens.
- Preserve Leaflet interaction performance and attribution visibility.

## G. Accessibility and Performance

- Minimum touch target: 44 × 44 CSS pixels.
- Normal text contrast: at least 4.5:1.
- Large text contrast: at least 3:1.
- Keyboard focus indicators must remain visible.
- No horizontal overflow at 375px, 768px, or 1440px viewport widths.
- Avoid significant layout shifts during animations.
- Aim for at least 55 FPS during standard UI transitions on the target test device.
- Avoid continuously running expensive blur or filter animations.
- Reduce glass complexity on low-performance devices if needed.

## H. Verification Requirements

Codex must validate the design at:

- Mobile: 375 × 812.
- Tablet: 768 × 1024.
- Desktop: 1440 × 900.

For each viewport, verify:

1. Homepage mode selection.
2. Solo discovery.
3. Couple discovery.
4. Friends discovery.
5. Nearby places and map.
6. In-app directions.

Verify these states where relevant:

- Default.
- Selected.
- Pressed.
- Loading.
- Empty results.
- Error.
- Reduced motion.

Use browser screenshots and interaction tests if browser automation is available.

Do not claim visual verification if screenshots or browser testing were not actually performed.

## I. Definition of Done

A redesign passes only if:

- All three discovery modes have distinct, recognizable visual identities.
- The homepage structure has visibly changed.
- Major floating surfaces exhibit multiple glass depth cues.
- At least six meaningful interaction types have been implemented and verified.
- Mode transitions animate both selection and theme.
- The directions screen and discovery pages share a coherent visual language.
- The interface remains accessible and responsive.
- Existing geolocation, map, routing, search, and random-selection functionality still works.
- Before-and-after screenshots are available for comparison when screenshot tooling is available.

If any criterion fails, report it explicitly and continue improving the implementation rather than declaring the redesign complete.