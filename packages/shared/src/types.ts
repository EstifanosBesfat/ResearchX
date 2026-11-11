import type { SCOPES } from "./constants";

export type Scope = (typeof SCOPES)[number];

export type ReportStatus = "processing" | "ready" | "insufficient";

export interface AskFilters {
  country?: string;
  yearFrom?: number;
  yearTo?: number;
  includeInternational?: boolean;
  includeEthiopia?: boolean;
}

export interface AskRequest {
  question: string;
  filters?: AskFilters;
}

export interface AskResponse {
  id: string;
  status: ReportStatus;
}

export interface EvidenceOverview {
  studyCount: number;
  ethiopianCount: number;
  internationalCount: number;
  yearMin: number | null;
  yearMax: number | null;
  locations: string[];
}

export interface Finding {
  statement: string;
  paperIds: string[];
  statistic: string | null;
}

export interface ComparisonRow {
  paperId: string;
  title: string;
  year: number | null;
  scope: Scope;
  location: string | null;
  methodology: string | null;
  sampleSize: string | null;
  findings: string | null;
}

export interface ReportReference {
  paperId: string;
  title: string;
  year: number | null;
  journal: string | null;
  sourceUrl: string | null;
  scope: Scope;
}

/** Sections A–G of a stored research report. */
export interface ReportBody {
  sufficient: boolean;
  gap: string | null;
  executiveSummary: string | null;
  evidenceOverview: EvidenceOverview;
  findings: Finding[];
  comparison: ComparisonRow[];
  limitations: string[];
  researchGaps: string[];
  references: ReportReference[];
}

export interface LlmDraft {
  sufficient?: boolean;
  gap?: string | null;
  executiveSummary?: string | null;
  findings?: Array<{
    statement?: string;
    paperIds?: string[];
    statistic?: string | null;
  }>;
  perPaper?: Array<{
    paperId?: string;
    finding?: string;
  }>;
  limitations?: string[];
  researchGaps?: string[];
}

export interface RetrievedPassage {
  paperId: string;
  content: string;
}

export interface RetrievedPaper {
  id: string;
  title: string;
  year: number | null;
  journal: string | null;
  scope: Scope;
  studyLocation: string | null;
  studyPopulation: string | null;
  methodology: string | null;
  sampleSize: string | null;
  findings: string | null;
  limitations: string | null;
  sourceUrl: string | null;
}

export interface ResearchRecord {
  id: string;
  question: string;
  filters: AskFilters;
  status: ReportStatus;
  report: ReportBody | null;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  question: string;
  filters: AskFilters;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportSource {
  paperId: string;
  rank: number;
  score: number;
  title: string;
  year: number | null;
  journal: string | null;
  scope: Scope;
  sourceUrl: string | null;
}

export interface PaperSummary {
  id: string;
  externalId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  scope: Scope;
  diseaseTags: string[];
  sourceUrl: string | null;
}

export interface PaperPassage {
  id: string;
  section: string;
  chunkIndex: number;
  content: string;
}

export interface PaperDetail extends PaperSummary {
  abstract: string | null;
  studyLocation: string | null;
  studyPopulation: string | null;
  methodology: string | null;
  sampleSize: string | null;
  pdfUrl: string | null;
  findings: string | null;
  limitations: string | null;
  createdAt: string;
  passages: PaperPassage[];
}

export interface DemoQuestion {
  id: string;
  label: string;
  question: string;
  filters: AskFilters;
}
