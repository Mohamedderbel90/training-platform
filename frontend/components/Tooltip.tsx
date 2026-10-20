"use client";

import { useId, useState, type ReactNode } from "react";

export interface TooltipTriggerProps {
  "aria-describedby": string;
  onFocus: () => void;
  onBlur: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Small, reusable accessible tooltip.
 *
 * Shows `content` on mouse hover AND on keyboard focus -- the native
 * `title` attribute is not used because screen readers announce it
 * inconsistently and, critically, it never appears on keyboard Tab
 * focus. Instead the trigger is wired to the bubble via
 * `aria-describedby`, the standard WAI-ARIA tooltip pattern (a
 * `role="tooltip"` element referenced by the id).
 *
 * `children` is a render prop rather than a plain node so the trigger
 * (typically a real, focusable `<button aria-disabled="true">` -- see
 * `DisabledAction` in `components/DayCard.tsx`) can spread the returned
 * props onto whatever element it actually renders, instead of this
 * component wrapping it in an extra focusable/interactive element of
 * its own.
 *
 * The bubble text node is always present in the DOM (only its
 * visibility toggles with `visible`), so it is always reachable via
 * `aria-describedby` and always present in the accessibility tree --
 * including while the trigger looks visually disabled.
 */
export function Tooltip({
  content,
  placement = "top",
  children,
}: {
  content: ReactNode;
  /** Which side the bubble opens on. Default "top" matches every existing
   * usage; "bottom" is for a trigger that sits near the top of a
   * container with `overflow: hidden` (e.g. the collapsible Training
   * Days filter panel, see SortControl's `hint` prop), where a bubble
   * opening upward would be clipped by that ancestor. */
  placement?: "top" | "bottom";
  children: (trigger: TooltipTriggerProps) => ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <span className="tooltip">
      {children({
        "aria-describedby": id,
        onFocus: show,
        onBlur: hide,
        onMouseEnter: show,
        onMouseLeave: hide,
      })}
      <span
        role="tooltip"
        id={id}
        className="tooltip__bubble"
        data-placement={placement === "bottom" ? "bottom" : undefined}
        data-visible={visible ? "true" : undefined}
      >
        {content}
      </span>
    </span>
  );
}
