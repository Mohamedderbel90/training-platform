import type { SVGProps } from "react";

/** Small hand-authored icon set (no icon library dependency).
 * Consistent 20x20 viewbox, 1.75 stroke, currentColor -- purely
 * decorative, so every icon is rendered aria-hidden and any
 * accessible label is supplied by surrounding text (see AppShell). */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1.2em"
      height="1.2em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </Icon>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 5l10 10M15 5L5 15" />
    </Icon>
  );
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 9.5 10 4l6.5 5.5" />
      <path d="M5.5 8.5V16h9V8.5" />
    </Icon>
  );
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="7.3" cy="7" r="2.4" />
      <path d="M2.7 16c0-2.3 2-4 4.6-4s4.6 1.7 4.6 4" />
      <circle cx="14" cy="6.6" r="1.9" />
      <path d="M12.6 8.8c1.9.2 3.4 1.7 3.7 3.7" />
    </Icon>
  );
}

export function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="4" width="11" height="13.5" rx="1.6" />
      <path d="M7.5 3.5h5v2h-5z" fill="currentColor" stroke="none" />
      <path d="M7 9.5h6M7 12.5h6M7 15h4" />
    </Icon>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3" />
      <path d="M12.5 13.5 16.5 10l-4-3.5M16.5 10H8" />
    </Icon>
  );
}

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="6.7" />
      <path d="M3.3 10h13.4M10 3.3c2 2.4 2 11 0 13.4M10 3.3c-2 2.4-2 11 0 13.4" />
    </Icon>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 4.5 12.5 10 7 15.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props} strokeWidth="1.8">
      <path d="M5.5 8 10 12.5 14.5 8" />
    </Icon>
  );
}

export function InboxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.3 10.5 5.7 4.5h8.6l2.4 6" />
      <path d="M3.3 10.5h4.2c.3 1.2 1.2 2 2.5 2s2.2-.8 2.5-2h4.2V15a1 1 0 0 1-1 1H4.3a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

export function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 3.5 17 16H3z" />
      <path d="M10 8.2v3.4" />
      <circle cx="10" cy="13.6" r="0.15" fill="currentColor" />
    </Icon>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 8 14.5 16 5.5" />
    </Icon>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.8" />
      <path d="M3.2 5.5 10 11l6.8-5.5" />
    </Icon>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="9" width="12" height="8" rx="1.8" />
      <path d="M6.2 9V6.7a3.8 3.8 0 0 1 7.6 0V9" />
    </Icon>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.5 10S5.5 4.8 10 4.8 17.5 10 17.5 10 14.5 15.2 10 15.2 2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </Icon>
  );
}

export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.5 10S5.5 4.8 10 4.8 17.5 10 17.5 10 14.5 15.2 10 15.2 2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="2.3" />
      <path d="M3.5 3.5l13 13" />
    </Icon>
  );
}

// Drawn pointing toward reading-start (left) to match the RTL "submit"
// convention by default; `.auth-submit__icon` in globals.css mirrors it
// for `dir="ltr"` so it points right instead.
export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M16 10H4M4 10l4.5-4.5M4 10l4.5 4.5" />
    </Icon>
  );
}

export function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 5.3c-1.6-1-3.6-1.3-5.3-.8v10.2c1.7-.5 3.7-.2 5.3.8" />
      <path d="M10 5.3c1.6-1 3.6-1.3 5.3-.8v10.2c-1.7-.5-3.7-.2-5.3.8Z" />
      <path d="M10 5.3v10.5" />
    </Icon>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="13" height="12" rx="1.8" />
      <path d="M3.5 8.3h13M7 3v2.6M13 3v2.6" />
    </Icon>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="6.7" />
      <path d="M10 6.3V10l2.8 1.7" />
    </Icon>
  );
}

export function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.3 13.5 8 8.8l2.7 2.7 6-6" />
      <path d="M13.2 5.5h3.5V9" />
    </Icon>
  );
}

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="6.8" r="2.9" />
      <path d="M4 16.3c0-2.9 2.7-5 6-5s6 2.1 6 5" />
    </Icon>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 14.5V9a5 5 0 0 1 10 0v5.5l1.3 1.7H3.7Z" />
      <path d="M8.3 17.3a1.9 1.9 0 0 0 3.4 0" />
    </Icon>
  );
}

export function MegaphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.3 8.2v3.6h2.3l6.4 3V5.2l-6.4 3Z" />
      <path d="M12 6.7a4.2 4.2 0 0 1 0 6.6" />
      <path d="M5.6 11.8v3.1a1.1 1.1 0 0 0 2.2 0v-1.9" />
    </Icon>
  );
}

export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props} strokeWidth="1.5">
      <path
        d="M5.5 3.5h6l3 3v10a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
        fill="#fff"
      />
      <path d="M11.5 3.5v3h3" />
      <path d="M7.3 10.5h5.4M7.3 13h3.4" />
    </Icon>
  );
}

export function LeafIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 15c-1-5 1.5-9.5 10-10.5C15.7 12.5 11 15 5 15Z" fill="currentColor" fillOpacity="0.16" />
      <path d="M5 15c-1-5 1.5-9.5 10-10.5C15.7 12.5 11 15 5 15Z" />
      <path d="M6.3 13.5c2-2.4 4-4.4 7.4-7" />
    </Icon>
  );
}
