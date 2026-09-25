import { notFound } from "next/navigation";

/** Catch-all so an unknown URL under a valid locale renders the
 * localized, app-shell-wrapped `not-found.tsx` (next-intl's documented
 * pattern) instead of Next's unstyled default 404. Real routes always
 * win over this segment. */
export default function CatchAllPage() {
  notFound();
}
