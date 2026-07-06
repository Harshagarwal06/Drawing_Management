# This folder

React 19 SPA (Vite + Tailwind), deployed on Vercel. The Capacitor `ios/`/`android/` shells here
belong to the `android-app` branch work — don't touch them for website changes.

# Rules that only apply here

- Lint uses eslint-plugin-react-hooks v7 compiler rules:
  - Wrap unstable callbacks used inside effects in `useEffectEvent` — do not add them to
    effect deps (causes fetch loops).
  - Loading flags are derived (`loadedProjectId !== activeProject.id`) and set in the fetch
    `.finally` — never `setLoading(true)` at the top of an effect (`set-state-in-effect` rule).
  - Session restore happens in a `useState` lazy initializer, not an effect.
- `eslint.config.js` must keep ignoring `dist`, `ios`, and `android`.
- Use the design tokens (`bg-primary`, `bg-surface-container*`, `border-border-slate`,
  `text-on-surface*`, `bg-status-*`) — not raw Tailwind palette colours.
- Tests are vitest, colocated in `__tests__/` directories next to the code.
