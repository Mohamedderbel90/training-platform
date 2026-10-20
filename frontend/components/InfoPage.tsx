"use client";

import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { PageHeader } from "@/components/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/config/contact";

interface Block {
  heading?: string;
  text: string;
}

/** Static, approved Help / Terms / Privacy content (DEC-50, DEC-51). The
 * texts live in the message catalogs (ar/en); the contact address comes
 * from lib/config/contact.ts. */
export function InfoContent({ section }: { section: "help" | "terms" | "privacy" }) {
  const t = useTranslations("Info");
  const blocks = t.raw(`${section}.blocks`) as Block[];
  // The address is rendered as an isolated left-to-right link so it reads
  // correctly inside right-to-left (Arabic) text.
  const fill = (text: string) =>
    text.split("{email}").flatMap((part, index, parts) =>
      index < parts.length - 1
        ? [
            part,
            <a key={index} href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">
              <bdi>{SUPPORT_EMAIL}</bdi>
            </a>,
          ]
        : [part],
    );
  return (
    <div>
      <PageHeader title={<h1>{t(`${section}.title`)}</h1>} subtitle={t(`${section}.subtitle`)} />
      <div className="card">
        {blocks.map((block, index) => (
          <section key={index} className="info-block">
            {block.heading ? <h2 className="card__title">{block.heading}</h2> : null}
            <p>{fill(block.text)}</p>
          </section>
        ))}
        {section !== "terms" ? (
          <p className="card__meta">
            {t("contactLabel")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">
              <bdi>{SUPPORT_EMAIL}</bdi>
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function InfoPage({ section }: { section: "help" | "terms" | "privacy" }) {
  return (
    <ProtectedRoute>
      <InfoContent section={section} />
    </ProtectedRoute>
  );
}
