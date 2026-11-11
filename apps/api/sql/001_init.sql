CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  title text NOT NULL,
  title_normalized text NOT NULL UNIQUE,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  year integer,
  journal text,
  abstract text,
  study_location text,
  study_population text,
  methodology text,
  sample_size text,
  scope text NOT NULL CHECK (scope IN ('ethiopia', 'international')),
  disease_tags text[] NOT NULL DEFAULT '{}',
  source_url text,
  pdf_url text,
  content_hash text,
  findings text,
  limitations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES papers (id) ON DELETE CASCADE,
  section text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
  UNIQUE (paper_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_content_tsv_idx
  ON chunks USING gin (content_tsv);

CREATE INDEX IF NOT EXISTS chunks_paper_id_idx
  ON chunks (paper_id);

CREATE INDEX IF NOT EXISTS papers_scope_idx ON papers (scope);
CREATE INDEX IF NOT EXISTS papers_year_idx ON papers (year);
CREATE INDEX IF NOT EXISTS papers_disease_tags_idx ON papers USING gin (disease_tags);

CREATE TABLE IF NOT EXISTS research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('processing', 'ready', 'insufficient')),
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_reports_created_at_idx
  ON research_reports (created_at DESC);

CREATE TABLE IF NOT EXISTS report_sources (
  report_id uuid NOT NULL REFERENCES research_reports (id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES papers (id) ON DELETE CASCADE,
  rank integer NOT NULL,
  score double precision NOT NULL,
  PRIMARY KEY (report_id, paper_id)
);
