# Noor Al-Qiyadah — login page assets

The **approved-login-reference.png** is the exact approved Arabic visual reference, with the extra institution login button absent.

Actual separate image files:
- `quran-photo.jpg`: text-free photograph cropped from the generated asset-board image; it is **upscaled**, not native high-resolution, so inspect at the intended display size.
- `noor-logo-symbol-approx.png`: **approximate extraction** of just the emblem from the approved reference, with white background made transparent; inspect edge quality. Render the Arabic/English brand name as real text, NOT a logo image.
- `right-ornament.jpg`: isolated ornamental strip from the asset-board image, with a light background (NOT transparent).
- `emerald-pattern.jpg`: decorative dark-green pattern cropped from the approved screenshot, with a dark-green background (NOT transparent).
- `design-tokens.css`: approximate color tokens.

## Important implementation notes for Claude Code
Use these assets under `frontend/public/noor-login/` and use `approved-login-reference.png` strictly for visual comparison. Build the form, language switcher, headings, hadith quotation, labels, buttons, and checkboxes in accessible React/HTML with `next-intl` Arabic and English translations. **Do not use screenshot or an asset sheet as the full-page background.**

Image generation/cropping is not a pixel-perfect extraction of original illustration layers. No genuine individual transparent original source files exist for the previously generated screenshot. Do not assert that these approximate extracted assets reproduce it exactly. In particular, use CSS/SVG or dedicated artwork for the curved green edge and seamless ornament if better visual fidelity is needed. No new login methods or institution-login button should be introduced. Preserve existing Odoo session authentication and password recovery routes.
