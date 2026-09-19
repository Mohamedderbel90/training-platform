/** Inline SVG brand mark: a simple eight-point star built from two
 * overlapping squares, the same motif used at low opacity as the
 * background watermark (see `.geo-pattern` in globals.css). Kept as
 * a component (not a static asset) so it inherits `currentColor`
 * and needs no image request. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      width="1.15em"
      height="1.15em"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.4" transform="rotate(0 12 12)" opacity="0.001" />
        <path
          d="M12 3 L15.2 8.8 L21 12 L15.2 15.2 L12 21 L8.8 15.2 L3 12 L8.8 8.8 Z"
          fill="currentColor"
          fillOpacity="0.18"
        />
        <circle cx="12" cy="12" r="3.1" fill="currentColor" fillOpacity="0.5" stroke="none" />
      </g>
    </svg>
  );
}
