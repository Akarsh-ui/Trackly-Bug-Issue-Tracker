---
name: Warm Editorial Craft
colors:
  surface: '#fcf9f7'
  surface-dim: '#dcd9d7'
  surface-bright: '#fcf9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f1'
  surface-container: '#f0edeb'
  surface-container-high: '#eae8e5'
  surface-container-highest: '#e5e2e0'
  on-surface: '#1c1c1b'
  on-surface-variant: '#55433c'
  inverse-surface: '#31302f'
  inverse-on-surface: '#f3f0ee'
  outline: '#88726b'
  outline-variant: '#dbc1b8'
  surface-tint: '#974725'
  primary: '#944523'
  on-primary: '#ffffff'
  primary-container: '#b35c38'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb599'
  secondary: '#605e59'
  on-secondary: '#ffffff'
  secondary-container: '#e3dfd9'
  on-secondary-container: '#64625d'
  tertiary: '#75553c'
  on-tertiary: '#ffffff'
  tertiary-container: '#906e52'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb599'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#793010'
  secondary-fixed: '#e6e2dc'
  secondary-fixed-dim: '#cac6c0'
  on-secondary-fixed: '#1c1c18'
  on-secondary-fixed-variant: '#484742'
  tertiary-fixed: '#ffdcc2'
  tertiary-fixed-dim: '#e8be9f'
  on-tertiary-fixed: '#2c1603'
  on-tertiary-fixed-variant: '#5d4128'
  background: '#fcf9f7'
  on-background: '#1c1c1b'
  surface-variant: '#e5e2e0'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system crafts an intentional, quiet workspace for engineering and product teams. It balances the systematic speed of Linear and GitHub with the quiet, focused typographic clarity of iA Writer and the utilitarian warmth of Basecamp.

### Key Tenets
- **Editorial Utility:** Density is achieved via typographic discipline and structural rules rather than heavy containers. The workspace feels composed, legible, and timeless.
- **Understated Craft:** Every 1px border, tabular row, and monospace ticket identifier has purpose. No gratuitous decorative cards, blurred drop-shadows, or glassmorphic gradients.
- **Warm Restraint:** High-contrast legibility softened by warm bone, raw paper, and deep iron-carbon tones instead of stark, sterile blues or harsh pure blacks.

## Colors

The palette draws from natural drafting materials: paper, bone, warm slate, and terra cotta pigment. Primary surfaces are warm off-whites, contrasted by dark charcoal typography and grounded by fine 1px warm grey rules.

### Canvas & Surfaces
- **Canvas Base:** `#F7F6F2` (warm bone) for primary workspace canvas and side-panels. Secondary canvas tier sits at `#F4F3EE`.
- **Card & Content Surfaces:** `#FFFFFF` (pure white) and `#FAFAF8` (ivory tint) to create quiet structural separation.
- **Borders & Dividers:** Primary boundary rules use `#E4E2DC`; subtle internal cell dividers use `#DCD9D0`.

### Typography Colors
- **Primary Ink:** `#1F1F1E` (deep carbon charcoal) delivers strong contrast without the clinical glare of `#000000`.
- **Secondary Ink:** `#6B6964` (muted slate) for labels, secondary issue counts, and metadata.
- **Muted / Placeholder Ink:** `#8C8983` for empty states, placeholder text, and inactive iconography.

### Accents & Semantics
- **Brand Primary:** `#C56A45` (terracotta) for primary creation actions, focused states, and selected tabs. Hover: `#B05B38`. Active: `#9E4E2E`.
- **Urgent / Blocker / Bug:** `#B3473B` (muted rust) paired with `#FBEAE8` wash.
- **In Progress / High:** `#C47D2B` (warm amber) paired with `#FCF3E6` wash.
- **Done / Resolved:** `#557A59` (soft sage) paired with `#EEF3EE` wash.
- **Backlog / Triage:** `#78756F` (warm slate) paired with `#F0EFEA` wash.

## Typography

Typography prioritizes scannability and reading rhythm. The system pairs `Geist` for balanced interface copy and hierarchical headings with `JetBrains Mono` for issue keys (e.g., `TRK-492`), commits, Git branch handles, and numeric indicators.

- **Headlines:** Set tight with subtle negative letter spacing for crisp, bookish titles.
- **Body:** Standardized at 13px for dense issue views and 15px for long-form issue descriptions and markdown notes.
- **Monospace Tokens:** Applied to status prefixes, hotkey helpers, and tabular numbers using tabular figures (`tnum`).

## Layout & Spacing

The layout is built upon an architectural, utilitarian split-pane grid. Interfaces default to tabular data matrices, expandable side-drawers, and dual-column master-detail views.

### Structure & Rhythm
- **Desktop (1024px+):** Fluid master-detail split. Fixed sidebar navigation (240px), fluid issue list or board view (min 400px), and optional persistent issue inspector panel (440px). 16px (`1rem`) gutters isolate parallel context.
- **Tablet (768px - 1023px):** Collapsible sidebar turns into an overlay drawer. Workspace transitions to dynamic tabular row views with an off-canvas modal inspector.
- **Mobile (< 768px):** Single-column stacked layout with 16px canvas margins (`margin-mobile`), 12px cell gutters, and full-width list items with swipe action affordances.

### Spacing Tokens
- `space-2xs` (2px) and `space-xs` (4px): Inline metadata grouping, badge interior padding, icon-to-label pairing.
- `space-sm` (8px): Form input inner paddings, list row vertical rhythm, compact button padding.
- `space-md` (12px): Standard button padding, cell gaps in tables.
- `space-lg` (16px) to `space-2xl` (32px): Container sectional gaps, drawer margins, markdown section paragraph splits.

## Elevation & Depth

This system avoids ambient blur shadows and heavy elevations, opting instead for structural 1px drafting lines and flat, layered tonal planes.

### Depth Hierarchy
- **Canvas (Level 0):** `#F7F6F2` canvas background. Completely flat.
- **Row & Tile Surfaces (Level 1):** `#FFFFFF` surfaces nested within `#F7F6F2`, bound strictly by a 1px border (`#E4E2DC`). No shadow.
- **Hover & Active States:** Indicated via subtle surface tint (`#F4F3EE`) or boundary darkening (`#C56A45`), not elevation lifts.
- **Contextual Popovers & Select Menus (Level 2):** `#FFFFFF` surface framed with a 1px `#DCD9D0` border, paired with a faint, razor-thin structural shadow: `0 2px 4px rgba(31, 31, 30, 0.04), 0 8px 16px rgba(31, 31, 30, 0.03)`.
- **Command Palette & Modals (Level 3):** `#FFFFFF` surface, high-contrast 1px border (`#DCD9D0`), centered with an intentional scrim (`rgba(31, 31, 30, 0.25)`) and a tight craft drop: `0 12px 32px rgba(31, 31, 30, 0.08)`.

## Shapes

The shape scale is restrained to low-radius rectangles (4px to 6px) to echo mechanical blueprints and typographic grids.

- **Base Radius (4px / 0.25rem):** Form inputs, inline tags, issue badges, dropdown menus, button controls.
- **Large Radius (8px / 0.5rem):** Modals, flyout panels, detached table container blocks.
- **Strictly No Pill Shapes:** Buttons and status tags must never use 9999px rounded pills; crisp micro-radii keep the UI architectural and mature.

## Components

### Buttons
- **Primary:** Terracotta `#C56A45` solid fill with `#FFFFFF` text. Hover: `#B05B38`. Focus: 2px ring offset in `#C56A45`. 4px corner radius.
- **Secondary / Default:** `#FFFFFF` fill with 1px border in `#E4E2DC`, text in `#1F1F1E`. Hover: `#F7F6F2` with border darkened to `#DCD9D0`.
- **Ghost:** Transparent fill with `#6B6964` text. Hover: `#F4F3EE` fill and `#1F1F1E` text. Used for row utilities and inline actions.

### Issue Key & Status Chips
- **Issue Key:** Monospace (`JetBrains Mono`, 11px), uppercase, text `#6B6964`, optional border-bottom hover underline.
- **Status Indicator:** 6px solid dot with companion text label.
  - *Done:* `#557A59`
  - *In Progress:* `#C47D2B`
  - *Urgent/Bug:* `#B3473B`
  - *Backlog:* `#8C8983`
- **Priority Tags:** Desaturated wash containers (e.g., `#FCF3E6` background with `#C47D2B` glyph and text) bound by 4px radius and 2px horizontal padding.

### Table & List Rows
- **Layout:** Edge-to-edge layout separated by a 1px border `#E4E2DC`.
- **Height & Spacing:** 38px dense row height; horizontal padding of 12px.
- **Hover State:** Entire row switches background to `#F4F3EE`.
- **Selection:** Selected row displays a 2px left border accent in `#C56A45` with `#FAFAF8` background.

### Input Fields & Textareas
- **Surface:** `#FFFFFF` with 1px `#E4E2DC` boundary.
- **Focus:** Crisp 1px `#C56A45` perimeter line with a zero-distance 1px box-shadow tone; no neon outer rings.
- **Height:** Inputs default to 34px with 13px Geist typography and 8px horizontal padding.

### Checkboxes & Selection Controls
- **Checkbox:** 14px square, 3px border radius, `#FFFFFF` interior with 1.5px `#DCD9D0` border. Checked: `#1F1F1E` background with `#FFFFFF` checkmark glyph.

### Command Palette (Quick Find / K-Bar)
- **Container:** 640px wide, centered overlay. `#FFFFFF` background with 6px radius and 1px `#DCD9D0` border.
- **Input Header:** 48px height with 15px Geist text, border-bottom 1px `#E4E2DC`.
- **Group Headers:** 11px uppercase `JetBrains Mono` in `#8C8983` with 12px vertical spacing.
- **Item Rows:** 36px height; active highlighted item sits on `#F4F3EE` with right-aligned keyboard shortcut badges (`JetBrains Mono`, 11px, `#6B6964`).