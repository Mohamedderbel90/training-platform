import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  return (
    <div className="state-view state-view--error">
      <h1 className="state-view__title">{t("titleNotFound")}</h1>
      <p className="state-view__message">{t("notFoundMessage")}</p>
      <Link href="/" className="button button--secondary">
        {t("backHome")}
      </Link>
    </div>
  );
}
