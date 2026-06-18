The existing `edit-pulse` keyframes in `src/styles.css` use `color-mix` values. Replace them with the exact rgba-based animation the user specified:

```css
@keyframes edit-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(212, 144, 10, 0.3); }
  50% { box-shadow: 0 0 0 4px rgba(212, 144, 10, 0.75); }
}

.animate-edit-pulse {
  animation: edit-pulse 1.2s ease-in-out infinite;
}
```

In `src/components/PreparingAlerts.tsx`, the outer `<li>` card already conditionally adds `animate-edit-pulse` when `isEditing === true` (line 134). No JSX change is needed.

After the CSS edit, verify the build passes, then take a screenshot of a Preparing card in edit mode on /kitchen to confirm the amber glow is visible.