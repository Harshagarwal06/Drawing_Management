# Design — Unique Drawings

A locked design system for the DrawVault document-control workspace. Every
screen should make operational state easier to read, not compete with it.

## Genre

Modern-minimal: technical, restrained, and precise.

## Macrostructure family

- Marketing/auth pages: Workbench — concise product context alongside the action.
- App pages: Workbench — a quiet utility header followed by high-signal operational panels.
- Content pages: Tabular workspace — search, filters, and documents are the primary composition.

## Theme

Cool engineered paper, graphite utility surfaces, and a single cobalt action signal.
The full token set lives in `src/tokens.css`.

## Typography

- Display: Space Grotesk, 600, normal.
- Body: Inter, 400–600.
- Mono: JetBrains Mono, 500.
- Display tracking: -0.03em.

## Spacing and shape

Use the named 4-point scale in `src/tokens.css`. Controls have 6px corners;
panels have 10–14px corners. Borders establish hierarchy before shadows do.

## Motion

Use only opacity and transform transitions with the named easings. Respect
reduced-motion preferences. No decorative animation, gradients, glass effects,
or parallax.

## Microinteractions stance

Focus states use cobalt. Hover clarifies an affordance without moving layout.
Success is quiet; operational feedback uses the existing toast system.

## CTA voice

- Primary: solid cobalt, compact rectangular control, specific verb.
- Secondary: quiet bordered control or a textual link with an arrow.

## What every screen shares

- The cool paper / graphite / cobalt palette.
- Space Grotesk display, Inter body, and JetBrains Mono for project codes and metadata.
- A calm, high-contrast shell with visible but restrained rules.
- One visual priority per panel; no decorative card grids.

## Per-page allowances

- The authenticated workspace has no decorative hero imagery.
- The login page may use one graphite context panel.
- Status colours remain semantic and are never reused as general decoration.
