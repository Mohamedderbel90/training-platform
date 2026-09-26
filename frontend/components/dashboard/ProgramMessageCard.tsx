import { useId } from "react";
import { useTranslations } from "next-intl";
import { MegaphoneIcon } from "@/components/icons";

/** No announcement/messaging model exists in the backend yet (see M5
 * point 5F): rather than invent a "message from program admin" card,
 * this documents the limitation directly in the UI instead of showing
 * fabricated content. Shared by all three role dashboards. */
export function ProgramMessageCard() {
  const t = useTranslations("Dashboard");
  const id = useId();
  return (
    <section className="card dashboard-note-card" aria-labelledby={id}>
      <h2 className="card__title card__title--with-icon" id={id}>
        <MegaphoneIcon aria-hidden="true" /> {t("programMessageTitle")}
      </h2>
      <div className="message-card__body">{t("programMessageUnavailable")}</div>
    </section>
  );
}
