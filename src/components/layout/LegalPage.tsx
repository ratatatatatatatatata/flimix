import type { ReactNode } from "react";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

/** Shared prose layout for /legal/* pages. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  /** e.g. "2026-07-01" */
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <article className="container-fx max-w-3xl py-14 sm:py-16">
      <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm text-mist-500">Сүүлд шинэчилсэн: {updated}</p>
      {intro ? (
        <p className="mt-6 leading-relaxed text-mist-300">{intro}</p>
      ) : null}
      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="font-display text-lg font-semibold text-white">
              {i + 1}. {s.heading}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-mist-300 sm:text-base [&_a:hover]:text-royal-400 [&_a]:text-royal-300 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-mist-100">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
