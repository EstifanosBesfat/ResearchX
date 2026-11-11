"use client";

import type { PaperDetail, PaperPassage } from "@researchx/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getPaper } from "@/lib/api";
import { FullScreen, ScopeBadge } from "./Chrome";

const SECTION_ORDER = ["abstract", "introduction", "methods", "results", "discussion", "other"];

export function PaperView() {
  const params = useParams<{ id: string }>();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPaper(params.id)
      .then((detail) => {
        if (!cancelled) setPaper(detail);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The paper could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <FullScreen kicker="Paper" title="This paper is not in the corpus" tone="clay">
        <p>{error}</p>
        <Link href="/" className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
          Back to the desk
        </Link>
      </FullScreen>
    );
  }

  if (!paper) {
    return (
      <FullScreen kicker="Paper" title="Opening the study record">
        <p>Loading the stored metadata and passages. This page does not re-analyze the PDF.</p>
      </FullScreen>
    );
  }

  const groups = groupPassages(paper.passages);
  return (
    <article className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-grove">
        Back to the desk
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ScopeBadge scope={paper.scope} />
        {paper.diseaseTags.map((tag) => (
          <span key={tag} className="rounded-full bg-paper-deep px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {tag}
          </span>
        ))}
      </div>
      <h1 className="font-display mt-4 text-4xl leading-tight text-ink">{paper.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {[paper.authors.join(", "), paper.year, paper.journal].filter(Boolean).join(" · ")}
      </p>
      {paper.sourceUrl && (
        <a
          href={paper.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-grove underline-offset-2 hover:underline"
        >
          Open source
        </a>
      )}
      {paper.abstract && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Abstract</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">{paper.abstract}</p>
        </section>
      )}
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field label="Location" value={paper.studyLocation} />
        <Field label="Population" value={paper.studyPopulation} />
        <Field label="Methodology" value={paper.methodology} />
        <Field label="Sample size" value={paper.sampleSize} />
      </dl>
      <section className="mt-8">
        <h2 className="font-display text-2xl">Findings</h2>
        <p className="mt-3 leading-relaxed">{paper.findings ?? "Not stated in the extracted study record."}</p>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-2xl">Limitations</h2>
        <p className="mt-3 leading-relaxed">{paper.limitations ?? "Not stated in the extracted study record."}</p>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Evidence passages</h2>
        {paper.passages.length === 0 ? (
          <p className="mt-3 text-ink-soft">No passages are stored for this paper yet.</p>
        ) : (
          groups.map(([section, passages]) => (
            <div key={section} className="mt-6">
              <h3 className="text-sm font-semibold tracking-[0.16em] text-gold uppercase">{section}</h3>
              <div className="mt-3 space-y-3">
                {passages.map((passage) => (
                  <blockquote key={passage.id} className="rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed">
                    {passage.content}
                  </blockquote>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="mt-2 leading-relaxed">{value ?? "Not stated"}</dd>
    </div>
  );
}

function groupPassages(passages: PaperPassage[]): Array<[string, PaperPassage[]]> {
  const groups = new Map<string, PaperPassage[]>();
  for (const passage of passages) {
    const list = groups.get(passage.section) ?? [];
    list.push(passage);
    groups.set(passage.section, list);
  }
  return [...groups.entries()].sort((left, right) => {
    const leftIndex = SECTION_ORDER.indexOf(left[0]);
    const rightIndex = SECTION_ORDER.indexOf(right[0]);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
}
