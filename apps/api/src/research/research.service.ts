import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import {
  DEFAULT_SIMILARITY_FLOOR,
  MIN_SUPPORTING_CHUNKS,
  PASSAGES_PER_PAPER,
  TOP_STUDIES,
  countPassagesCovering,
  distinctiveTokens,
  groundReport,
  insufficientReport,
  resolveScopes,
  topicGap,
  type AskFilters,
  type AskRequest,
  type HistoryItem,
  type ReportBody,
  type ReportSource,
  type ReportStatus,
  type ResearchRecord,
  type RetrievedPaper,
  type Scope,
} from "@researchx/shared";
import { DatabaseService } from "../db/database.service";
import { EmbeddingsService, toVectorLiteral } from "../embeddings/embeddings.service";
import { LlmService } from "../llm/llm.service";
import { SYNTHESIS_SYSTEM_PROMPT, synthesisUserPrompt } from "./prompt";
import { fuseChunks, groupStudies, keywordQueryText, type RankedChunk } from "./retrieval";

interface ReportRow {
  id: string;
  question: string;
  filters: AskFilters;
  status: ReportStatus;
  report: ReportBody | null;
  created_at: Date;
}

interface ChunkRow {
  id: string;
  paper_id: string;
  section: string;
  chunk_index: number;
  content: string;
  cosine_sim: number;
}

interface PaperRow {
  id: string;
  title: string;
  year: number | null;
  journal: string | null;
  scope: Scope;
  study_location: string | null;
  study_population: string | null;
  methodology: string | null;
  sample_size: string | null;
  findings: string | null;
  limitations: string | null;
  source_url: string | null;
}

interface SourceRow extends PaperRow {
  rank: number;
  score: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly embeddings: EmbeddingsService,
    private readonly llm: LlmService,
  ) {}

  async ask(input: AskRequest): Promise<{ id: string; status: ReportStatus }> {
    this.requireDatabase();
    const filters = input.filters ?? {};
    const rows = await this.database.query<ReportRow>(
      `INSERT INTO research_reports (question, filters, status)
       VALUES ($1, $2::jsonb, 'processing')
       RETURNING id, question, filters, status, report, created_at`,
      [input.question, JSON.stringify(filters)],
    );
    const id = rows[0].id;
    void this.finish(id, input.question, filters).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : "The research run failed.";
      this.logger.error(message);
      try {
        await this.store(
          id,
          "insufficient",
          insufficientReport(
            "The research run failed before a grounded report was stored. No answer was taken from model memory.",
          ),
          [],
        );
      } catch (storeError) {
        const detail = storeError instanceof Error ? storeError.message : "Could not store the failed run.";
        this.logger.error(detail);
      }
    });
    return { id, status: "processing" };
  }

  async get(id: string): Promise<ResearchRecord> {
    this.assertUuid(id);
    const rows = await this.database.query<ReportRow>(
      `SELECT id, question, filters, status, report, created_at
       FROM research_reports WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Research report not found.");
    return this.toRecord(rows[0]);
  }

  async sources(id: string): Promise<{ reportId: string; sources: ReportSource[] }> {
    this.assertUuid(id);
    const report = await this.database.query<{ id: string }>("SELECT id FROM research_reports WHERE id = $1", [id]);
    if (!report[0]) throw new NotFoundException("Research report not found.");
    const rows = await this.database.query<SourceRow>(
      `SELECT rs.rank, rs.score, p.id, p.title, p.year, p.journal, p.scope, p.source_url,
              p.study_location, p.study_population, p.methodology, p.sample_size, p.findings, p.limitations
       FROM report_sources rs
       JOIN papers p ON p.id = rs.paper_id
       WHERE rs.report_id = $1
       ORDER BY rs.rank ASC`,
      [id],
    );
    return {
      reportId: id,
      sources: rows.map((row) => ({
        paperId: row.id,
        rank: row.rank,
        score: row.score,
        title: row.title,
        year: row.year,
        journal: row.journal,
        scope: row.scope,
        sourceUrl: row.source_url,
      })),
    };
  }

  async history(): Promise<HistoryItem[]> {
    const rows = await this.database.query<ReportRow>(
      `SELECT id, question, filters, status, report, created_at
       FROM research_reports
       ORDER BY created_at DESC
       LIMIT 30`,
    );
    return rows.map((row) => ({
      id: row.id,
      question: row.question,
      filters: row.filters ?? {},
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  private async finish(id: string, question: string, filters: AskFilters): Promise<void> {
    const scopes = resolveScopes(question, filters);
    if (scopes.length === 0) {
      await this.store(
        id,
        "insufficient",
        insufficientReport(
          "No corpus scope was selected. Turn on Ethiopian evidence, international evidence, or both. No answer was written from model memory.",
        ),
        [],
      );
      return;
    }
    if (!this.embeddings.configured()) {
      await this.store(
        id,
        "insufficient",
        insufficientReport(
          "The shared embedding endpoint is not configured, so passages could not be ranked. No answer was synthesized from model memory.",
        ),
        [],
      );
      return;
    }

    const embedding = await this.embeddings.embed(question);
    const vectorLiteral = toVectorLiteral(embedding);
    const floor = similarityFloor();
    const vectorHits = await this.searchVector(vectorLiteral, scopes, filters);
    const keyword = keywordQueryText(question);
    const keywordHits = keyword ? await this.searchKeyword(vectorLiteral, keyword, scopes, filters) : [];
    const fused = fuseChunks(vectorHits, keywordHits);
    const supportive = fused.filter((chunk) => chunk.cosineSim >= floor);
    const groups = groupStudies(supportive, PASSAGES_PER_PAPER, TOP_STUDIES);
    const passages = groups.flatMap((group) => group.passages);
    if (passages.length < MIN_SUPPORTING_CHUNKS) {
      await this.store(
        id,
        "insufficient",
        insufficientReport(
          `${passages.length} passage${passages.length === 1 ? "" : "s"} cleared the similarity floor of ${floor}. At least ${MIN_SUPPORTING_CHUNKS} matching passages are required before a report is written. No answer was taken from model memory.`,
        ),
        [],
      );
      return;
    }

    const tokens = distinctiveTokens(question);
    const covered = countPassagesCovering(
      tokens,
      passages.map((passage) => passage.content),
    );
    if (tokens.length > 0 && covered < MIN_SUPPORTING_CHUNKS) {
      await this.store(id, "insufficient", insufficientReport(topicGap(tokens)), []);
      return;
    }

    const papers = await this.loadPapers(groups.map((group) => group.paperId));
    const orderedPapers = groups
      .map((group) => papers.get(group.paperId))
      .filter((paper): paper is RetrievedPaper => Boolean(paper));
    const passagePayload = passages.map((passage) => ({
      paperId: passage.paperId,
      content: passage.content,
    }));

    if (!this.llm.configured()) {
      await this.store(
        id,
        "insufficient",
        insufficientReport(
          "Passages were retrieved, but the synthesis endpoint is not configured. No answer was written from model memory.",
        ),
        groups.map((group, index) => ({ paperId: group.paperId, rank: index + 1, score: group.score })),
      );
      return;
    }

    const draft = await this.llm.completeJson(
      SYNTHESIS_SYSTEM_PROMPT,
      synthesisUserPrompt(
        question,
        filters,
        orderedPapers,
        passages.map((passage) => ({
          paperId: passage.paperId,
          section: passage.section,
          content: passage.content.slice(0, 1800),
        })),
      ),
    );
    const grounded = groundReport(draft, orderedPapers, passagePayload);
    await this.store(
      id,
      grounded.status,
      grounded.report,
      groups.map((group, index) => ({ paperId: group.paperId, rank: index + 1, score: group.score })),
    );
  }

  private async searchVector(vector: string, scopes: Scope[], filters: AskFilters): Promise<RankedChunk[]> {
    const rows = await this.database.query<ChunkRow>(
      `SELECT c.id, c.paper_id, c.section, c.chunk_index, c.content,
              1 - (c.embedding <=> $1::vector) AS cosine_sim
       FROM chunks c
       JOIN papers p ON p.id = c.paper_id
       WHERE c.embedding IS NOT NULL
         AND p.scope = ANY($2::text[])
         AND ($3::int IS NULL OR p.year >= $3)
         AND ($4::int IS NULL OR p.year <= $4)
       ORDER BY c.embedding <=> $1::vector
       LIMIT 50`,
      [vector, scopes, filters.yearFrom ?? null, filters.yearTo ?? null],
    );
    return rows.map((row) => this.toChunk(row));
  }

  private async searchKeyword(
    vector: string,
    query: string,
    scopes: Scope[],
    filters: AskFilters,
  ): Promise<RankedChunk[]> {
    const rows = await this.database.query<ChunkRow>(
      `SELECT c.id, c.paper_id, c.section, c.chunk_index, c.content,
              CASE WHEN c.embedding IS NULL THEN 0
                   ELSE 1 - (c.embedding <=> $1::vector) END AS cosine_sim
       FROM chunks c
       JOIN papers p ON p.id = c.paper_id
       WHERE c.content_tsv @@ plainto_tsquery('english', $2)
         AND p.scope = ANY($3::text[])
         AND ($4::int IS NULL OR p.year >= $4)
         AND ($5::int IS NULL OR p.year <= $5)
       ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', $2)) DESC
       LIMIT 40`,
      [vector, query, scopes, filters.yearFrom ?? null, filters.yearTo ?? null],
    );
    return rows.map((row) => this.toChunk(row));
  }

  private async loadPapers(ids: string[]): Promise<Map<string, RetrievedPaper>> {
    if (ids.length === 0) return new Map();
    const rows = await this.database.query<PaperRow>(
      `SELECT id, title, year, journal, scope, study_location, study_population,
              methodology, sample_size, findings, limitations, source_url
       FROM papers
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(rows.map((row) => [row.id, this.toPaper(row)]));
  }

  private async store(
    id: string,
    status: ReportStatus,
    report: ReportBody,
    sources: Array<{ paperId: string; rank: number; score: number }>,
  ): Promise<void> {
    await this.database.query("DELETE FROM report_sources WHERE report_id = $1", [id]);
    for (const source of sources) {
      await this.database.query(
        `INSERT INTO report_sources (report_id, paper_id, rank, score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_id, paper_id) DO UPDATE SET rank = EXCLUDED.rank, score = EXCLUDED.score`,
        [id, source.paperId, source.rank, source.score],
      );
    }
    await this.database.query(
      `UPDATE research_reports SET status = $2, report = $3::jsonb WHERE id = $1`,
      [id, status, JSON.stringify(report)],
    );
  }

  private toChunk(row: ChunkRow): RankedChunk {
    return {
      chunkId: row.id,
      paperId: row.paper_id,
      section: row.section,
      chunkIndex: row.chunk_index,
      content: row.content,
      cosineSim: Number(row.cosine_sim) || 0,
      vectorRank: null,
      keywordRank: null,
      score: 0,
    };
  }

  private toPaper(row: PaperRow): RetrievedPaper {
    return {
      id: row.id,
      title: row.title,
      year: row.year,
      journal: row.journal,
      scope: row.scope,
      studyLocation: row.study_location,
      studyPopulation: row.study_population,
      methodology: row.methodology,
      sampleSize: row.sample_size,
      findings: row.findings,
      limitations: row.limitations,
      sourceUrl: row.source_url,
    };
  }

  private toRecord(row: ReportRow): ResearchRecord {
    return {
      id: row.id,
      question: row.question,
      filters: row.filters ?? {},
      status: row.status,
      report: row.report,
      createdAt: row.created_at.toISOString(),
    };
  }

  private requireDatabase(): void {
    if (!this.database.available()) {
      throw new ServiceUnavailableException("DATABASE_URL is not configured.");
    }
  }

  private assertUuid(id: string): void {
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundException("Research report not found.");
    }
  }
}

function similarityFloor(): number {
  const parsed = Number(process.env.SIMILARITY_FLOOR ?? DEFAULT_SIMILARITY_FLOOR);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return DEFAULT_SIMILARITY_FLOOR;
  return parsed;
}
