/** Single vector size shared by ingest and query. Matches vector(1536). */
export const EMBEDDING_DIMENSION = 1536;

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export const DEFAULT_SIMILARITY_FLOOR = 0.22;

export const MIN_SUPPORTING_CHUNKS = 2;

export const TOP_STUDIES = 8;

export const PASSAGES_PER_PAPER = 3;

export const SCOPES = ["ethiopia", "international"] as const;
