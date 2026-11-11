import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ingestJsonSchema,
  ingestMetadataSchema,
  type PaperDetail,
  type PaperSummary,
  type Scope,
} from "@researchx/shared";
import { parseBody } from "../common/parse-body";
import { DatabaseService } from "../db/database.service";
import { looksLikePdf, removeUpload, runIngest, writeUpload } from "./ingest.runner";

interface PaperRow {
  id: string;
  external_id: string | null;
  title: string;
  authors: string[] | null;
  year: number | null;
  journal: string | null;
  abstract: string | null;
  study_location: string | null;
  study_population: string | null;
  methodology: string | null;
  sample_size: string | null;
  scope: Scope;
  disease_tags: string[] | null;
  source_url: string | null;
  pdf_url: string | null;
  findings: string | null;
  limitations: string | null;
  created_at: Date;
}

interface PassageRow {
  id: string;
  section: string;
  chunk_index: number;
  content: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PapersService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: Record<string, string | undefined>): Promise<PaperSummary[]> {
    const scope = query.scope === "ethiopia" || query.scope === "international" ? query.scope : null;
    const yearFrom = parseYear(query.yearFrom);
    const yearTo = parseYear(query.yearTo);
    const tag = query.tag?.trim() || null;
    const text = query.q?.trim().replace(/[\\%_]/g, "") || null;
    const rows = await this.database.query<PaperRow>(
      `SELECT id, external_id, title, authors, year, journal, abstract, study_location,
              study_population, methodology, sample_size, scope, disease_tags, source_url,
              pdf_url, findings, limitations, created_at
       FROM papers
       WHERE ($1::text IS NULL OR scope = $1)
         AND ($2::int IS NULL OR year >= $2)
         AND ($3::int IS NULL OR year <= $3)
         AND ($4::text IS NULL OR $4 = ANY(disease_tags))
         AND ($5::text IS NULL OR title ILIKE '%' || $5 || '%')
       ORDER BY year DESC NULLS LAST, title ASC
       LIMIT 100`,
      [scope, yearFrom, yearTo, tag, text],
    );
    return rows.map((row) => this.toSummary(row));
  }

  async get(id: string): Promise<PaperDetail> {
    if (!UUID_PATTERN.test(id)) throw new NotFoundException("Paper not found.");
    const rows = await this.database.query<PaperRow>(
      `SELECT id, external_id, title, authors, year, journal, abstract, study_location,
              study_population, methodology, sample_size, scope, disease_tags, source_url,
              pdf_url, findings, limitations, created_at
       FROM papers WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException("Paper not found.");
    const passages = await this.database.query<PassageRow>(
      `SELECT id, section, chunk_index, content
       FROM chunks
       WHERE paper_id = $1
       ORDER BY chunk_index ASC`,
      [id],
    );
    return {
      ...this.toSummary(rows[0]),
      abstract: rows[0].abstract,
      studyLocation: rows[0].study_location,
      studyPopulation: rows[0].study_population,
      methodology: rows[0].methodology,
      sampleSize: rows[0].sample_size,
      pdfUrl: rows[0].pdf_url,
      findings: rows[0].findings,
      limitations: rows[0].limitations,
      createdAt: rows[0].created_at.toISOString(),
      passages: passages.map((passage) => ({
        id: passage.id,
        section: passage.section,
        chunkIndex: passage.chunk_index,
        content: passage.content,
      })),
    };
  }

  async ingest(file: Express.Multer.File | undefined, body: Record<string, unknown>): Promise<{
    paperId: string;
    externalId: string | null;
    action: string;
  }> {
    if (file) {
      if (!looksLikePdf(file.buffer)) {
        throw new BadRequestException("Upload a PDF.");
      }
      const rawMetadata = typeof body.metadata === "string" ? safeJson(body.metadata) : body.metadata;
      const metadata = parseBody(ingestMetadataSchema, rawMetadata);
      const upload = writeUpload(file.buffer, metadata);
      try {
        return await runIngest(["--pdf", upload.pdfPath, "--metadata", upload.metadataPath]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ingest failed.";
        throw new BadRequestException(message);
      } finally {
        removeUpload(upload.directory);
      }
    }
    const parsed = parseBody(ingestJsonSchema, body);
    if (!parsed.externalId) {
      throw new BadRequestException("Provide externalId for a seed paper, or upload an open-access PDF with metadata.");
    }
    try {
      return await runIngest(["--external-id", parsed.externalId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ingest failed.";
      throw new BadRequestException(message);
    }
  }

  private toSummary(row: PaperRow): PaperSummary {
    return {
      id: row.id,
      externalId: row.external_id,
      title: row.title,
      authors: Array.isArray(row.authors) ? row.authors : [],
      year: row.year,
      journal: row.journal,
      scope: row.scope,
      diseaseTags: row.disease_tags ?? [],
      sourceUrl: row.source_url,
    };
  }
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestException("metadata must be JSON.");
  }
}
