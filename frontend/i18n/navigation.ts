import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js navigation APIs, so links and
// programmatic navigation keep the current locale segment.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
