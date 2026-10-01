# Intact — Design System & Tokens

A calm, credible, document-like aesthetic designed for tenancy inspection records.

## 1. Direction & Principles
- **Aesthetic**: Inspection document / physical paper record.
- **Background**: Warm off-white paper (`#FAF8F5`).
- **Text**: Near-black ink (`#1C1917`).
- **Accent**: One muted ink blue (`#1E3A5F`).
- **Visual Structure**: Thin 1px borders (`#D6CEBE` / `#E7E2DA`), small radii (`4px` - `6px`), zero blur/glassmorphism/glow, no gradients.
- **Theme**: Light theme only.

## 2. Color Palette

### Base & Paper
- `paper-50` (`#FAF8F5`): Root background
- `paper-100` (`#F4F0EA`): Secondary surface / table header
- `paper-200` (`#EAE3D9`): Card container background
- `paper-300` (`#DCD3C5`): Subtle separator

### Ink & Typography
- `ink-900` (`#1C1917`): Primary text / headings
- `ink-600` (`#57534E`): Secondary / description text
- `ink-500` (`#78716C`): Muted helper text
- `ink-200` (`#D6CEBE`): Standard border
- `ink-100` (`#E7E2DA`): Subtle divider

### Accent
- `accent` (`#1E3A5F`): Deep ink blue for primary actions and active states
- `accent-hover` (`#152A45`): Hover state for accent buttons
- `accent-subtle` (`#EEF2F6`): Selected / badge background

### Semantic Status Tokens
- **Damage**: `damage` (`#991B1B`), `damage-bg` (`#FEF2F2`), `damage-border` (`#FECACA`)
- **Normal Wear**: `wear` (`#B45309`), `wear-bg` (`#FFFBEB`), `wear-border` (`#FDE68A`)
- **Unclear / Review**: `unclear` (`#4B5563`), `unclear-bg` (`#F3F4F6`), `unclear-border` (`#E5E7EB`)
- **Accepted**: `accepted` (`#166534`), `accepted-bg` (`#F0FDF4`), `accepted-border` (`#BBF7D0`)
- **Disputed**: `disputed` (`#9F1239`), `disputed-bg` (`#FFF1F2`), `disputed-border` (`#FECDD3`)

## 3. Typography
- **UI Sans**: System sans-serif stack for clear readability.
- **Monospace**: `ui-monospace` / monospace for timestamps, SHA-256 hashes, coordinates, and UUIDs.

## 4. Geometry & Elevation
- **Border Radius**: `4px` (`rounded-sm`), `6px` (`rounded` / `rounded-md`).
- **Borders**: `1px solid` `#D6CEBE` or `#E7E2DA`.
- **Shadows**: Flat or subtle `0 1px 2px 0 rgba(0, 0, 0, 0.04)`.
