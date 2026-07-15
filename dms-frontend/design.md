# DrawVault mobile web design system

## Product context

DrawVault is the drawing workspace used by Unique Properties directors, in-house architects, and project teams. The mobile website is for checking the active project, locating current drawings, reviewing revisions, issuing or opening transmittals, and completing short administrative actions away from a desk.

The interface should feel restrained, technical, and trustworthy. It must never imply that project data is available offline when it is not.

## Direction

- Genre: modern-minimal
- Macrostructure: Workbench
- Theme: Cobalt
- Enrichment: none; project data and controls are the visual content
- Primary axis: compact navigation chrome around a left-biased document workspace
- Desktop information architecture remains intact; mobile changes presentation, not permissions or capabilities

## Type

- Display: Space Grotesk 700 for route and panel headings
- Body: IBM Plex Sans 400–600 for controls and copy
- Data: IBM Plex Mono 500–600 for drawing numbers, project codes, revisions, and dates
- Body copy stays at 16px; compact metadata may be 12–14px but never carries a primary action
- All data displays use tabular numerals

## Colour

- Paper: cool, lightly blue-tinted surfaces
- Ink: graphite rather than black
- Accent: cobalt, reserved for current selection, focus, and primary actions
- Status colours always include text or an icon; colour is never the only signal
- Borders establish grouping before shadows

## Shape and space

- 4px spacing base
- 6px controls, 10px panels, 14px mobile sheets
- Minimum touch target: 44px by 44px
- Mobile page padding: 16px; desktop page padding: 40px
- Mobile bottom navigation and sheets include device safe-area insets
- Content uses `dvh` for viewport-constrained surfaces

## Mobile navigation

- A compact top bar always names the current route and active project
- Directors receive Home, Documents, Register, Transmittals, and More
- More contains Analytics, Settings, Install DrawVault, and Sign out
- In-house architects and Project Team users receive Documents, Settings, and More; More keeps installation and sign-out available without exposing director-only routes
- The desktop sidebar remains the primary navigation from 768px upward

## Interaction

- Every hover affordance has a tap and keyboard equivalent
- Focus rings appear immediately
- Menus and sheets close on Escape and restore focus
- Sheets lock background scrolling while open
- Reduced motion removes spatial transitions
- Update prompts never reload during an upload or form action without the user choosing to update

## Responsive contract

- Required widths: 320, 375, 390/393, 414, 768, and desktop
- No document-level horizontal scrolling
- Inputs render at 16px on phone widths so iOS does not zoom
- Desktop tables become labelled cards on phones; the desktop table remains from 768px upward
- Dialogs become bottom/full-height sheets on phones with sticky headers and actions
- Long labels reflow at the container level; clickable labels stay on one line

## PWA trust contract

- Cache only the application shell, hashed build assets, icons, local legal pages, and the offline document
- Never cache API responses, authorization-bearing requests, uploaded drawings, PDFs, DWG/DXF/IFC/RVT files, transmittals, signed R2 URLs, or project/user data
- When offline, DrawVault states that live project data cannot be loaded and offers retry
- Installation guidance is available from More and Settings; iOS instructions describe Safari’s Add to Home Screen flow

## Exports

### CSS custom properties

The live source of truth is `src/tokens.css`:

```css
:root {
  --color-paper: oklch(0.982 0.006 252);
  --color-paper-raised: oklch(0.995 0.003 252);
  --color-paper-muted: oklch(0.952 0.010 252);
  --color-rule: oklch(0.884 0.012 252);
  --color-rule-strong: oklch(0.790 0.018 252);
  --color-ink-muted: oklch(0.475 0.021 255);
  --color-ink: oklch(0.225 0.021 255);
  --color-accent: oklch(0.515 0.215 260);
  --color-accent-ink: oklch(0.985 0.003 252);
  --color-accent-strong: oklch(0.455 0.220 260);
  --color-accent-soft: oklch(0.925 0.043 260);
  --color-focus: oklch(0.585 0.205 260);
  --color-success: oklch(0.535 0.140 158);
  --color-warning: oklch(0.650 0.145 70);
  --color-danger: oklch(0.550 0.190 25);
  --font-display: "Space Grotesk", sans-serif;
  --font-body: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
  --space-3xs: 0.125rem;
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.5rem;
  --space-2xl: 4rem;
  --radius-control: 0.375rem;
  --radius-panel: 0.625rem;
  --radius-sheet: 0.875rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 120ms;
  --dur-short: 220ms;
  --dur-long: 300ms;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(0.982 0.006 252);
  --color-paper-raised: oklch(0.995 0.003 252);
  --color-paper-muted: oklch(0.952 0.010 252);
  --color-rule: oklch(0.884 0.012 252);
  --color-rule-strong: oklch(0.790 0.018 252);
  --color-ink-muted: oklch(0.475 0.021 255);
  --color-ink: oklch(0.225 0.021 255);
  --color-accent: oklch(0.515 0.215 260);
  --color-accent-ink: oklch(0.985 0.003 252);
  --color-focus: oklch(0.585 0.205 260);
  --font-display: "Space Grotesk", sans-serif;
  --font-body: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
  --spacing-3xs: 0.125rem;
  --spacing-2xs: 0.25rem;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2.5rem;
  --spacing-2xl: 4rem;
  --radius-control: 0.375rem;
  --radius-panel: 0.625rem;
  --radius-sheet: 0.875rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(0.982 0.006 252)", "$type": "color" },
    "paper-raised": { "$value": "oklch(0.995 0.003 252)", "$type": "color" },
    "paper-muted": { "$value": "oklch(0.952 0.010 252)", "$type": "color" },
    "rule": { "$value": "oklch(0.884 0.012 252)", "$type": "color" },
    "rule-strong": { "$value": "oklch(0.790 0.018 252)", "$type": "color" },
    "ink-muted": { "$value": "oklch(0.475 0.021 255)", "$type": "color" },
    "ink": { "$value": "oklch(0.225 0.021 255)", "$type": "color" },
    "accent": { "$value": "oklch(0.515 0.215 260)", "$type": "color" },
    "accent-ink": { "$value": "oklch(0.985 0.003 252)", "$type": "color" },
    "focus": { "$value": "oklch(0.585 0.205 260)", "$type": "color" }
  },
  "font": {
    "display": { "$value": ["Space Grotesk", "sans-serif"], "$type": "fontFamily" },
    "body": { "$value": ["IBM Plex Sans", "sans-serif"], "$type": "fontFamily" },
    "mono": { "$value": ["IBM Plex Mono", "monospace"], "$type": "fontFamily" }
  },
  "space": {
    "3xs": { "$value": "0.125rem", "$type": "dimension" },
    "2xs": { "$value": "0.25rem", "$type": "dimension" },
    "xs": { "$value": "0.5rem", "$type": "dimension" },
    "sm": { "$value": "0.75rem", "$type": "dimension" },
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" },
    "xl": { "$value": "2.5rem", "$type": "dimension" },
    "2xl": { "$value": "4rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "220ms", "$type": "duration" },
    "long": { "$value": "300ms", "$type": "duration" }
  }
}
```

### shadcn/ui variables

```css
:root {
  --background: 98.2% 0.006 252;
  --foreground: 22.5% 0.021 255;
  --card: 99.5% 0.003 252;
  --card-foreground: 22.5% 0.021 255;
  --popover: 99.5% 0.003 252;
  --popover-foreground: 22.5% 0.021 255;
  --primary: 51.5% 0.215 260;
  --primary-foreground: 98.5% 0.003 252;
  --secondary: 95.2% 0.010 252;
  --secondary-foreground: 22.5% 0.021 255;
  --muted: 95.2% 0.010 252;
  --muted-foreground: 47.5% 0.021 255;
  --accent: 92.5% 0.043 260;
  --accent-foreground: 22.5% 0.021 255;
  --destructive: 55% 0.190 25;
  --destructive-foreground: 98.5% 0.003 252;
  --border: 88.4% 0.012 252;
  --input: 88.4% 0.012 252;
  --ring: 58.5% 0.205 260;
  --radius: 0.625rem;
}
```
