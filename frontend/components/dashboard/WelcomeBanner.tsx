import { useTranslations } from "next-intl";
import { BookIcon, LeafIcon } from "@/components/icons";

/** Dashboard hero banner (M5 point 5A). `subtitleKey` lets each role's
 * dashboard supply its own supporting copy while sharing the same
 * layout/imagery. The photo is a decorative background image only
 * (`quran-photo.jpg`, an approved asset from noor-login/ not
 * previously used anywhere) -- never the full dashboard screenshot. */
export function WelcomeBanner({
  name,
  subtitleKey,
}: {
  name: string;
  subtitleKey: string;
}) {
  const t = useTranslations("Dashboard");
  return (
    <section className="welcome-banner" aria-label={t("welcomeRegionLabel")}>
      <div className="welcome-banner__image" role="presentation" />
      <div className="welcome-banner__body">
        <h1 className="welcome-banner__title">
          <LeafIcon className="welcome-banner__title-icon" />
          {t("welcomeBack", { name })}
        </h1>
        <p className="welcome-banner__subtitle">{t(subtitleKey)}</p>
        <p className="welcome-banner__quote">
          <BookIcon aria-hidden="true" />
          <span>{t("welcomeQuote")}</span>
        </p>
      </div>
    </section>
  );
}
