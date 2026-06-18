## Add pulsing amber border to Preparing cards in edit mode

**What:** When a Preparing strip card is in inline edit mode, apply a continuous pulsing amber border/glow animation that stops immediately on Save or Cancel.

**How:**
1. **`src/styles.css`** — Add a `@keyframes edit-pulse` that alternates `box-shadow` from a dim amber glow (`0 0 0 2px var(--color-warning)/30`) to a bright one (`0 0 0 4px var(--color-warning)/70`), on a ~1.2s ease-in-out infinite loop. Register via `@utility edit-pulse` so Tailwind v4 exposes it as a utility class (or add it to the `@layer base` as a raw `.animate-edit-pulse` class if `@utility` is not yet present).

2. **`src/components/PreparingAlerts.tsx`** — On the card `<li>` element, conditionally add the animation class when `isEditing === true`. Remove the class when edit mode ends (Save success or Cancel). No other component changes.

**Verification:** Build passes. Edit a Preparing card — the card border glows amber and pulses continuously. Tap Save/Cancel — glow stops instantly and card reverts to the standard non-editing border state.
