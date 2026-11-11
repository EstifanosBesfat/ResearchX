import { GENERIC_TOKENS } from "./coverage";
import type { LlmDraft, ReportBody, RetrievedPaper, RetrievedPassage } from "./types";

const SENTENCE = /[^.!?]+[.!?]+|[^.!?]+$/g;

export function numericTokens(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?%?/g)].map((match) => match[0].replace(/,/g, "").toLowerCase());
}

export function allowedNumberSet(texts: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const text of texts) {
    for (const token of numericTokens(text)) {
      allowed.add(token);
      if (token.endsWith("%")) allowed.add(token.slice(0, -1));
      else allowed.add(`${token}%`);
    }
  }
  return allowed;
}

export function hasUnsourcedNumber(text: string, allowed: Set<string>): boolean {
  return numericTokens(text).some((token) => {
    const bare = token.endsWith("%") ? token.slice(0, -1) : token;
    return !allowed.has(token) && !allowed.has(bare) && !allowed.has(`${bare}%`);
  });
}

function sentences(text: string): string[] {
  const protectedText = text.replace(/(\d)\.(\d)/g, "$1\u0000$2");
  const parts = protectedText.match(SENTENCE)?.map((part) => part.trim()).filter(Boolean) ?? [];
  return parts.map((part) => part.replace(/\u0000/g, "."));
}

export function keepSupportedSentences(text: string, allowed: Set<string>, passages: string[]): string {
  const kept = sentences(text).filter(
    (sentence) => !hasUnsourcedNumber(sentence, allowed) && !hasNovelDistinctiveToken(sentence, passages),
  );
  return kept.join(" ").trim();
}

function hasNovelDistinctiveToken(sentence: string, passages: string[]): boolean {
  const tokens = sentence.toLowerCase().match(/[a-z]{10,}/g) ?? [];
  const haystack = passages.join("\n").toLowerCase();
  return tokens.some((token) => !GENERIC_TOKENS.has(token) && !haystack.includes(token));
}

export function statisticIsCopied(statistic: string, passages: string[]): boolean {
  const needle = statistic.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 2) return false;
  const haystack = passages.join("\n").replace(/\s+/g, " ").toLowerCase();
  return haystack.includes(needle);
}

export function emptyOverview(): ReportBody["evidenceOverview"] {
  return {
    studyCount: 0,
    ethiopianCount: 0,
    internationalCount: 0,
    yearMin: null,
    yearMax: null,
    locations: [],
  };
}

export function insufficientReport(gap: string): ReportBody {
  return {
    sufficient: false,
    gap,
    executiveSummary: null,
    evidenceOverview: emptyOverview(),
    findings: [],
    comparison: [],
    limitations: [],
    researchGaps: [],
    references: [],
  };
}

export function overviewFromPapers(papers: RetrievedPaper[]): ReportBody["evidenceOverview"] {
  const years = papers.map((paper) => paper.year).filter((year): year is number => typeof year === "number");
  const locations = [
    ...new Set(papers.map((paper) => paper.studyLocation).filter((location): location is string => Boolean(location))),
  ];
  return {
    studyCount: papers.length,
    ethiopianCount: papers.filter((paper) => paper.scope === "ethiopia").length,
    internationalCount: papers.filter((paper) => paper.scope === "international").length,
    yearMin: years.length ? Math.min(...years) : null,
    yearMax: years.length ? Math.max(...years) : null,
    locations,
  };
}

function metadataText(papers: RetrievedPaper[], ids?: Set<string>): string[] {
  return papers
    .filter((paper) => (ids ? ids.has(paper.id) : true))
    .flatMap((paper) => [
      paper.sampleSize ?? "",
      paper.year === null ? "" : String(paper.year),
      paper.studyLocation ?? "",
      paper.methodology ?? "",
      paper.studyPopulation ?? "",
      paper.findings ?? "",
      paper.limitations ?? "",
    ]);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function storedFinding(paper: RetrievedPaper, passages: string[]): string | null {
  if (!paper.findings) return null;
  const allowed = allowedNumberSet([...passages, ...metadataText([paper])]);
  const text = keepSupportedSentences(paper.findings, allowed, passages);
  return text || null;
}

const UNSUPPORTED_GAP =
  "The retrieved passages do not support a citation-grounded answer. No statistics were added from model memory.";

const CITATION_GAP =
  "No cited finding survived the citation check. Claims that named a paper outside the retrieved set were removed, and nothing grounded remained. No answer was taken from model memory.";

/**
 * Drops any paperId that was not retrieved, removes statistics that are not
 * copied from the cited passages, and downgrades the report when no cited
 * finding remains.
 */
export function groundReport(
  draft: LlmDraft,
  papers: RetrievedPaper[],
  passages: RetrievedPassage[],
): { status: "ready" | "insufficient"; report: ReportBody } {
  const allowedIds = new Set(papers.map((paper) => paper.id));
  const byPaper = new Map<string, string[]>();
  for (const passage of passages) {
    const list = byPaper.get(passage.paperId) ?? [];
    list.push(passage.content);
    byPaper.set(passage.paperId, list);
  }
  const allPassages = passages.map((passage) => passage.content);
  const allowedNumbers = allowedNumberSet([...allPassages, ...metadataText(papers)]);
  const modelGap = keepSupportedSentences(draft.gap ?? "", allowedNumbers, allPassages);

  if (draft.sufficient === false) {
    return { status: "insufficient", report: insufficientReport(modelGap || UNSUPPORTED_GAP) };
  }

  const findings: ReportBody["findings"] = [];
  for (const finding of draft.findings ?? []) {
    const paperIds = [...new Set((finding.paperIds ?? []).filter((id) => allowedIds.has(id)))];
    if (paperIds.length === 0) continue;
    const cited = paperIds.flatMap((id) => byPaper.get(id) ?? []);
    const citedAllowed = allowedNumberSet([...cited, ...metadataText(papers, new Set(paperIds))]);
    const statement = keepSupportedSentences(finding.statement ?? "", citedAllowed, cited);
    if (!statement) continue;
    const rawStatistic = finding.statistic?.trim() ?? "";
    const statistic =
      rawStatistic && statisticIsCopied(rawStatistic, cited) && !hasUnsourcedNumber(rawStatistic, citedAllowed)
        ? rawStatistic
        : null;
    findings.push({ statement, paperIds, statistic });
  }

  if (findings.length === 0) {
    return { status: "insufficient", report: insufficientReport(CITATION_GAP) };
  }

  const perPaper = new Map<string, string>();
  for (const row of draft.perPaper ?? []) {
    if (!row.paperId || !allowedIds.has(row.paperId)) continue;
    const cited = byPaper.get(row.paperId) ?? [];
    const citedAllowed = allowedNumberSet([...cited, ...metadataText(papers, new Set([row.paperId]))]);
    const text = keepSupportedSentences(row.finding ?? "", citedAllowed, cited);
    if (text) perPaper.set(row.paperId, text);
  }

  const comparison = papers.map((paper) => ({
    paperId: paper.id,
    title: paper.title,
    year: paper.year,
    scope: paper.scope,
    location: paper.studyLocation,
    methodology: paper.methodology,
    sampleSize: paper.sampleSize,
    findings: perPaper.get(paper.id) ?? storedFinding(paper, byPaper.get(paper.id) ?? []),
  }));

  const limitations = uniqueStrings([
    ...papers.map((paper) => paper.limitations ?? ""),
    ...(draft.limitations ?? []).map((item) => keepSupportedSentences(item, allowedNumbers, allPassages)),
  ]);
  const researchGaps = uniqueStrings(
    (draft.researchGaps ?? []).map((item) => keepSupportedSentences(item, allowedNumbers, allPassages)),
  );
  const summary = keepSupportedSentences(draft.executiveSummary ?? "", allowedNumbers, allPassages);

  return {
    status: "ready",
    report: {
      sufficient: true,
      gap: null,
      executiveSummary: summary || "The findings below are limited to claims that cite retrieved papers.",
      evidenceOverview: overviewFromPapers(papers),
      findings,
      comparison,
      limitations,
      researchGaps,
      references: papers.map((paper) => ({
        paperId: paper.id,
        title: paper.title,
        year: paper.year,
        journal: paper.journal,
        sourceUrl: paper.sourceUrl,
        scope: paper.scope,
      })),
    },
  };
}
