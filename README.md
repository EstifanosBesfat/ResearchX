# Ethiopian Health Research Intelligence

ResearchX answers natural-language Ethiopian health questions with a citation-grounded report. The checked corpus is maternal health and malaria, Ethiopian and international, 2015–2026. Tuberculosis is intentionally absent so an off-corpus question returns insufficient evidence.

The build spec is in [docs/implementation-plan.md](docs/implementation-plan.md).

## Layout

- `apps/web` — Next.js App Router, TypeScript, Tailwind CSS 4
- `apps/api` — NestJS retrieval, citation checks, and structured synthesis
- `packages/shared` — request and report types, scope rules, and grounding
- `services/ingest` — Python CLI: Europe PMC full text, PyMuPDF, chunking, embeddings, upsert

There are no accounts, payments, or a separate vector size. Ingest and query call the same OpenAI-compatible embeddings endpoint at 1536 dimensions.

## Setup

```bash
cp .env.example .env
npm install
python3 -m venv services/ingest/.venv
services/ingest/.venv/bin/pip install -r services/ingest/requirements.txt
npm run migrate
npm run build -w @researchx/shared
npm run dev:api
npm run dev:web
```

Ingest the seed after `DATABASE_URL` and `EMBEDDING_API_KEY` are set:

```bash
services/ingest/.venv/bin/python -m ingest
```

Run that command from `services/ingest`. One manifest entry:

```bash
python -m ingest --external-id 10.1371/journal.pone.0214848
```

`POST /api/papers/ingest` accepts `{ "externalId": "..." }` or a multipart open-access PDF field `file` plus a `metadata` JSON field.

## API

- `POST /api/research/ask`
- `GET /api/research/history`
- `GET /api/research/:id`
- `GET /api/research/:id/sources`
- `POST /api/papers/ingest`
- `GET /api/papers`
- `GET /api/papers/:id`

Ethiopian rows are kept when the question or filter mentions Ethiopia. International rows are included only when `includeInternational` is true. Fewer than two chunks above the similarity floor, or a distinctive topic missing from the passages, stores an `insufficient` report and does not answer from model memory. Statistics that are not copied from the cited passages are dropped. A `paperId` that was not retrieved cannot remain in the stored findings.

## Environment

See `.env.example`. `EMBEDDING_DIMENSION` must stay `1536` to match `chunks.embedding vector(1536)`. A Neon AI Gateway can be used by pointing `EMBEDDING_BASE_URL` and `LLM_BASE_URL` at `${NEON_AI_GATEWAY_BASE_URL}/v1` with the gateway token. Do not commit `.env`.

## Checks still blocked here

This environment has no `DATABASE_URL`, no local Postgres with pgvector, and no embedding or chat key. These checks were not run:

- Applying the migration and creating the HNSW cosine index on Neon
- Ingesting the 34-paper seed (Europe PMC full text, PyMuPDF, embeddings, study-metadata extraction)
- The four demo questions against retrieved passages
- A ready report with citation cards, Ethiopian versus international labels, and a comparison table
- The insufficient-evidence screen produced because tuberculosis is absent from the corpus, rather than because the database is missing

What did run: shared grounding, scope, and topic-coverage tests; ingest clean, chunk, XML, and title-normalization tests; API and web production builds; and a browser pass of the workspace, filters, demo chips, the ask error when the database is not configured, and the missing-report screen.
