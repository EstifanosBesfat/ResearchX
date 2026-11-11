import type { AskFilters, RetrievedPaper } from "@researchx/shared";

export const SYNTHESIS_SYSTEM_PROMPT = `You are the synthesis step for ResearchX. Return one JSON object and nothing else.
Use only the passages and extracted study fields in the user message.
Do not use outside knowledge, do not invent numbers, and do not name papers that are not in the packet.
If the passages do not answer the question, set sufficient to false, leave findings empty, and explain the gap without statistics.
Every finding must include paperIds copied from the packet. A statistic must be an exact copy of text that appears in a cited passage.
Research gaps must describe what this retrieved set does not cover. Do not introduce new statistics.

JSON shape:
{
  "sufficient": boolean,
  "gap": string | null,
  "executiveSummary": string | null,
  "findings": [{ "statement": string, "paperIds": string[], "statistic": string | null }],
  "perPaper": [{ "paperId": string, "finding": string }],
  "limitations": string[],
  "researchGaps": string[]
}`;

export function synthesisUserPrompt(
  question: string,
  filters: AskFilters,
  papers: RetrievedPaper[],
  passages: Array<{ paperId: string; section: string; content: string }>,
): string {
  const paperBlocks = papers
    .map((paper) =>
      [
        `paperId: ${paper.id}`,
        `title: ${paper.title}`,
        `year: ${paper.year ?? "not stated"}`,
        `scope: ${paper.scope}`,
        `location: ${paper.studyLocation ?? "not stated"}`,
        `population: ${paper.studyPopulation ?? "not stated"}`,
        `methodology: ${paper.methodology ?? "not stated"}`,
        `sampleSize: ${paper.sampleSize ?? "not stated"}`,
      ].join("\n"),
    )
    .join("\n\n");
  const passageBlocks = passages
    .map(
      (passage, index) =>
        `[${index + 1}] paperId: ${passage.paperId} | section: ${passage.section}\n${passage.content}`,
    )
    .join("\n\n");
  return [
    `Question: ${question}`,
    `Filters: ${JSON.stringify(filters)}`,
    "",
    "Retrieved studies:",
    paperBlocks,
    "",
    "Retrieved passages:",
    passageBlocks,
  ].join("\n");
}
