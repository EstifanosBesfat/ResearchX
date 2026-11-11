import assert from "node:assert/strict";
import test from "node:test";
import { groundReport } from "./grounding";
import type { LlmDraft, RetrievedPaper, RetrievedPassage } from "./types";

const papers: RetrievedPaper[] = [
  {
    id: "paper-et",
    title: "Antenatal care in Ethiopia",
    year: 2019,
    journal: "PLoS One",
    scope: "ethiopia",
    studyLocation: "Ethiopia",
    studyPopulation: "pregnant women",
    methodology: "systematic review",
    sampleSize: "22 studies",
    findings: "Antenatal care utilization varied across regions.",
    limitations: "Several included studies were cross-sectional.",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6459485/",
  },
  {
    id: "paper-int",
    title: "Maternal mortality in low-income countries",
    year: 2015,
    journal: "Reproductive Health",
    scope: "international",
    studyLocation: "low- and middle-income countries",
    studyPopulation: null,
    methodology: "cohort analysis",
    sampleSize: null,
    findings: null,
    limitations: null,
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4464034/",
  },
];

const passages: RetrievedPassage[] = [
  {
    paperId: "paper-et",
    content: "Antenatal care utilization in Ethiopia was 63.8% in the pooled estimate. Haemorrhage remained a leading contributor.",
  },
  {
    paperId: "paper-int",
    content: "Haemorrhage, hypertensive disorders, and sepsis were leading causes of maternal death in the cohort.",
  },
];

test("drops a paperId that was not retrieved and keeps the cited finding", () => {
  const draft: LlmDraft = {
    sufficient: true,
    executiveSummary: "Antenatal care utilization in Ethiopia was discussed in the retrieved studies.",
    findings: [
      {
        statement: "Antenatal care utilization in Ethiopia was 63.8% in the pooled estimate.",
        paperIds: ["paper-et", "not-retrieved"],
        statistic: "63.8%",
      },
    ],
  };
  const result = groundReport(draft, papers, passages);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.report.findings[0].paperIds, ["paper-et"]);
  assert.equal(result.report.findings[0].statistic, "63.8%");
  assert.deepEqual(
    result.report.references.map((reference) => reference.paperId),
    ["paper-et", "paper-int"],
  );
  assert.equal(result.report.evidenceOverview.ethiopianCount, 1);
  assert.equal(result.report.evidenceOverview.internationalCount, 1);
});

test("removes a statistic that is not copied from the cited passage", () => {
  const draft: LlmDraft = {
    sufficient: true,
    findings: [
      {
        statement: "Haemorrhage remained a leading contributor in the Ethiopian review.",
        paperIds: ["paper-et"],
        statistic: "91.2% of deaths",
      },
    ],
  };
  const result = groundReport(draft, papers, passages);
  assert.equal(result.status, "ready");
  assert.equal(result.report.findings[0].statistic, null);
  assert.equal(result.report.findings[0].statement.includes("91.2%"), false);
});

test("downgrades to insufficient when every cited id is outside the retrieved set", () => {
  const draft: LlmDraft = {
    sufficient: true,
    findings: [
      {
        statement: "A fabricated trial reported a large reduction.",
        paperIds: ["not-retrieved"],
        statistic: "50%",
      },
    ],
  };
  const result = groundReport(draft, papers, passages);
  assert.equal(result.status, "insufficient");
  assert.equal(result.report.findings.length, 0);
  assert.equal(result.report.comparison.length, 0);
  assert.equal(result.report.references.length, 0);
  assert.match(result.report.gap ?? "", /citation check/i);
});

test("does not keep model findings when the draft says the passages are insufficient", () => {
  const draft: LlmDraft = {
    sufficient: false,
    gap: "The passages discuss malaria prevention rather than the question.",
    findings: [
      {
        statement: "Antenatal care utilization in Ethiopia was 63.8% in the pooled estimate.",
        paperIds: ["paper-et"],
        statistic: "63.8%",
      },
    ],
  };
  const result = groundReport(draft, papers, passages);
  assert.equal(result.status, "insufficient");
  assert.equal(result.report.findings.length, 0);
  assert.match(result.report.gap ?? "", /malaria prevention/);
});

test("drops a sentence that introduces a topic token absent from the passages", () => {
  const draft: LlmDraft = {
    sufficient: true,
    findings: [
      {
        statement: "Tuberculosis treatment default fell after a new programme. Haemorrhage remained a leading contributor.",
        paperIds: ["paper-et"],
      },
    ],
  };
  const result = groundReport(draft, papers, passages);
  assert.equal(result.status, "ready");
  assert.equal(result.report.findings[0].statement.includes("Tuberculosis"), false);
  assert.match(result.report.findings[0].statement, /Haemorrhage/);
});
