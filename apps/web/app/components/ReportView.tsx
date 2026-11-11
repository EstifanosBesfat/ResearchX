"use client";

import type { ResearchRecord } from "@researchx/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getReport } from "@/lib/api";
import { formatStamp, scopeLabel } from "@/lib/format";
import { FullScreen, ScopeBadge } from "./Chrome";

export function ReportView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [record, setRecord] = useState<ResearchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const next = await getReport(id);
        if (cancelled) return;
        setRecord(next);
        setError(null);
        if (next.status === "processing") {
          timer = setTimeout(() => {
            void load();
          }, 1500);
        }
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "The report could not be opened.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return (
      <FullScreen kicker="Report" title="This report could not be opened" tone="clay">
        <p>{error}</p>
        <Link href="/" className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
          Back to the desk
        </Link>
      </FullScreen>
    );
  }

  if (!record || record.status === "processing") {
    return (
      <FullScreen kicker="Processing" title="Reading the corpus">
        <p>{record?.question ?? "The question is in the queue."}</p>
        <p>The report stays on this screen until retrieval and citation checks finish. Nothing is shown from model memory while it runs.</p>
      </FullScreen>
    );
  }

  if (record.status === "insufficient" || record.report?.sufficient === false) {
    return (
      <FullScreen kicker="Insufficient evidence" title="The corpus cannot answer this question" tone="clay">
        <p className="text-ink">{record.question}</p>
        <p>{record.report?.gap ?? "Not enough retrieved passages cleared the evidence bar."}</p>
        <p>No statistics were added to fill the gap.</p>
        <Link href="/" className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
          Ask a different question
        </Link>
      </FullScreen>
    );
  }

  const report = record.report;
  if (!report) {
    return (
      <FullScreen kicker="Report" title="The report is empty" tone="ink">
        <p>The status is ready, but no report body was stored.</p>
      </FullScreen>
    );
  }

  const overview = report.evidenceOverview;
  return (
    <article className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Cited report</p>
      <h1 className="font-display mt-3 max-w-4xl text-4xl leading-tight text-grove sm:text-5xl">{record.question}</h1>
      <p className="mt-3 text-sm text-ink-soft">{formatStamp(record.createdAt)} Guatemala</p>
      <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Studies" value={String(overview.studyCount)} />
        <Stat label="Ethiopia" value={String(overview.ethiopianCount)} />
        <Stat label="International" value={String(overview.internationalCount)} />
        <Stat
          label="Years"
          value={overview.yearMin && overview.yearMax ? `${overview.yearMin}–${overview.yearMax}` : "Not stated"}
        />
      </dl>
      {overview.locations.length > 0 && (
        <p className="mt-4 text-sm text-ink-soft">Locations in the retrieved studies: {overview.locations.join(", ")}.</p>
      )}

      <Section title="Executive summary">
        <p className="max-w-3xl text-lg leading-relaxed">{report.executiveSummary}</p>
      </Section>

      <Section title="Major findings">
        <ol className="space-y-4">
          {report.findings.map((finding, index) => (
            <li key={`${finding.statement}-${index}`} className="rounded-2xl border border-line bg-card p-4">
              <p className="leading-relaxed">{finding.statement}</p>
              {finding.statistic && (
                <p className="mt-2 text-sm font-semibold text-grove">From the passage: {finding.statistic}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {finding.paperIds.map((paperId) => {
                  const reference = report.references.find((item) => item.paperId === paperId);
                  return (
                    <Link
                      key={paperId}
                      href={`/papers/${paperId}`}
                      className="rounded-full bg-paper-deep px-3 py-1 text-xs font-semibold text-grove"
                    >
                      {reference?.year ?? "Paper"} · {reference?.title?.slice(0, 72) ?? paperId}
                    </Link>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Study comparison">
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="min-w-[56rem] w-full border-collapse text-left text-sm">
            <thead className="bg-grove text-paper">
              <tr>
                {["Study", "Scope", "Location", "Methodology", "Sample size", "Findings"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.comparison.map((row) => (
                <tr key={row.paperId} className="border-t border-line bg-card align-top">
                  <td className="px-3 py-3">
                    <Link href={`/papers/${row.paperId}`} className="font-semibold text-grove underline-offset-2 hover:underline">
                      {row.title}
                    </Link>
                    <div className="mt-1 text-ink-soft">{row.year ?? "Year not stated"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <ScopeBadge scope={row.scope} />
                  </td>
                  <td className="px-3 py-3">{row.location ?? "Not stated"}</td>
                  <td className="px-3 py-3">{row.methodology ?? "Not stated"}</td>
                  <td className="px-3 py-3">{row.sampleSize ?? "Not stated"}</td>
                  <td className="px-3 py-3">{row.findings ?? "Not stated in the retrieved passages."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Limitations">
        {report.limitations.length === 0 ? (
          <p>The stored study records do not state a limitation for this set.</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5">
            {report.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Research gaps">
        {report.researchGaps.length === 0 ? (
          <p>No additional gap was stated beyond the retrieved evidence.</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5">
            {report.researchGaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="References">
        <div className="grid gap-3 md:grid-cols-2">
          {report.references.map((reference) => (
            <article key={reference.paperId} className="rounded-2xl border border-line bg-card p-4">
              <ScopeBadge scope={reference.scope} />
              <h3 className="mt-3 font-semibold leading-snug">
                <Link href={`/papers/${reference.paperId}`} className="hover:text-grove">
                  {reference.title}
                </Link>
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                {[reference.year, reference.journal].filter(Boolean).join(" · ") || "Source details stored with the paper"}
              </p>
              {reference.sourceUrl && (
                <a
                  href={reference.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-grove underline-offset-2 hover:underline"
                >
                  Open source
                </a>
              )}
            </article>
          ))}
        </div>
      </Section>
      <p className="mt-10 text-xs text-ink-soft">
        Scope labels distinguish {scopeLabel("ethiopia")} studies from {scopeLabel("international")} studies. Counts come from the retrieved set.
      </p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="font-display mt-1 text-3xl text-grove">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
