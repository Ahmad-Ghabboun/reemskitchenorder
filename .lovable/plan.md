## Kitchen header pills + card item sizing

File: `src/routes/kitchen.tsx` only. No logic changes.

### 1. Header pills
In the `itemTotals.map(...)` `<span>`:
- Replace `bg-warning/15 text-warning border border-warning/40 font-bold` with `bg-orange-500 text-white border border-orange-600 font-extrabold`.
- Padding: `px-2 py-0.5` → `px-4 py-2`.
- Inline style: `fontSize: 12` → `fontSize: 20` (keep `borderRadius: 999`).
- Keep `shrink-0`, `whitespace-nowrap`.

Header element: `py-3` → `py-4`.

### 2. Card item name
In the `<li>` inside `its.map(...)`, the name row:
- `<span className="text-lg font-black tabular-nums">` (quantity) → `text-[20px] font-black tabular-nums`.
- `<span className="text-lg font-bold leading-tight">` (name) → `text-[20px] font-bold leading-tight`.
- Removed-ingredient chips, hot-sauce tag, notes: unchanged.

### 3. Ready button
- `h-14` → `py-4` (remove fixed height, taller via padding), `text-xl` → `text-lg`.
- Keep `w-full bg-success text-success-foreground font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform`.

Build will be verified after edit.
