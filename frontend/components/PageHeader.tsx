/** Reusable page title block used at the top of every dashboard/detail
 * page. Purely a layout wrapper -- callers still pass their own
 * translated heading text, so no copy lives here and next-intl
 * coverage on each page is unaffected. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  leadingActions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Controls rendered BEFORE the title block, packed tightly beside it
   * at the row's logical start (e.g. the Training Days Cards/Calendar +
   * Sort-by controls) -- unlike `actions`, which sits in its own slot at
   * the row's opposite/trailing end. Only pages that pass this prop get
   * the `page-header--leading` layout below; every other `PageHeader`
   * caller is unaffected. */
  leadingActions?: React.ReactNode;
}) {
  return (
    <div className={`page-header${leadingActions ? " page-header--leading" : ""}`}>
      {leadingActions ? <div className="page-header__leading">{leadingActions}</div> : null}
      <div className="page-header__titles">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        {title}
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}
