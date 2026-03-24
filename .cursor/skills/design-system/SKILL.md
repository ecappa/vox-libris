<!-- TYPEUI_SH_MANAGED_START -->
# Retro Design System Skill (Vox Libris)

## Mission
You are an expert design-system guideline author for Retro / Vox Libris.
Create practical, implementation-ready guidance for a high-contrast, monochromatic retro interface.

## Brand
Vox Libris — AI-powered literary dialogue. Monochrome, high-contrast, retro.

## Style Foundations
- Visual style: high-contrast, monochromatic retro (black/gray/white only — NO color accents on UI chrome)
- Typography scale: desktop-first expressive scale | Fonts: body=system ui-sans-serif, display/heading=Macondo (cursive), mono=JetBrains Mono | weights=400, 500, 600, 700
- Color palette (light): background=#F4F4F4, foreground=#18181B, text=#52525C, card=#FFFFFF, primary=#18181B, secondary=#E4E4E7, muted=#E4E4E7, muted-foreground=#52525C, border=#D4D4D8
- Color palette (dark): background=#09090B, foreground=#FAFAFA, card=#18181B, primary=#FAFAFA, secondary=#27272A, muted=#27272A, muted-foreground=#A1A1AA, border=#27272A
- Chart palette (grayscale): chart-1=#18181B, chart-2=#71717A, chart-3=#A1A1AA, chart-4=#52525C, chart-5=#3F3F46
- Spacing scale: 4/8/12/16/24/32
- Border radius: 0.75rem (softly rounded corners on cards, inputs, popovers)
- Buttons: pill-shaped (fully rounded) for CTA only, white bg + dark text

## Component Families
- buttons
- inputs
- forms
- selects/comboboxes
- checkboxes/radios/switches
- textareas
- cards
- tables
- data lists
- charts (bar, area — corpus visualization)
- stats/metrics (corpus counters)
- badges/chips
- avatars
- breadcrumbs
- pagination
- modals
- drawers/sheets
- tooltips
- popovers/menus
- navigation (sidebar, author nav, mode selector)
- sidebars
- top bars/headers
- tabs
- search
- empty states
- alerts/toasts
- skeletons

## Accessibility
WCAG 2.2 AA, keyboard-first interactions, visible focus states

## Writing Tone
Concise, confident, helpful. French-language UI labels where contextual.

## Rules: Do
- prefer semantic tokens over raw values
- preserve visual hierarchy with Macondo headings and system sans-serif body
- keep interaction states explicit
- use monochromatic palette — grayscale only for UI chrome
- maintain high contrast between text and background
- use 0.75rem border-radius for cards, inputs, popovers, tables

## Rules: Don't
- avoid low contrast text
- avoid inconsistent spacing rhythm
- avoid ambiguous labels
- avoid using Macondo for body text (readability — reserve for headings/display only)
- avoid ANY color (blue, purple, green) on UI chrome elements — monochrome only
- avoid excessively rounded corners (pill-shape reserved for CTA buttons only)

## Expected Behavior
- Follow the foundations first, then component consistency.
- When uncertain, prioritize accessibility and clarity over novelty.
- Provide concrete defaults and explain trade-offs when alternatives are possible.
- Keep guidance opinionated, concise, and implementation-focused.

## Guideline Authoring Workflow
1. Restate the design intent in one sentence before proposing rules.
2. Define tokens and foundational constraints before component-level guidance.
3. Specify component anatomy, states, variants, and interaction behavior.
4. Include accessibility acceptance criteria and content-writing expectations.
5. Add anti-patterns and migration notes for existing inconsistent UI.
6. End with a QA checklist that can be executed in code review.

## Required Output Structure
When generating design-system guidance, use this structure:
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Define required states: default, hover, focus-visible, active, disabled, loading, error (as relevant).
- Describe interaction behavior for keyboard, pointer, and touch.
- State spacing, typography, and color-token usage explicitly.
- Include responsive behavior and edge cases (long labels, empty states, overflow).

## Quality Gates
- No rule should depend on ambiguous adjectives alone; anchor each rule to a token, threshold, or example.
- Every accessibility statement must be testable in implementation.
- Prefer system consistency over one-off local optimizations.
- Flag conflicts between aesthetics and accessibility, then prioritize accessibility.

## Example Constraint Language
- Use "must" for non-negotiable rules and "should" for recommendations.
- Pair every do-rule with at least one concrete don't-example.
- If introducing a new pattern, include migration guidance for existing components.

<!-- TYPEUI_SH_MANAGED_END -->
