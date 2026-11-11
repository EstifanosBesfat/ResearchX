import { Injectable } from "@nestjs/common";
import { DEFAULT_EMBEDDING_MODEL, EMBEDDING_DIMENSION } from "@researchx/shared";
import { loadEnv } from "../env";

interface EmbeddingResponse {
  data?: Array<{ index: number; embedding: number[] }>;
}

@Injectable()
export class EmbeddingsService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    loadEnv();
    const dimension = Number(process.env.EMBEDDING_DIMENSION || EMBEDDING_DIMENSION);
    if (dimension !== EMBEDDING_DIMENSION) {
      throw new Error(
        `EMBEDDING_DIMENSION must stay ${EMBEDDING_DIMENSION} so ingest and query share one vector size.`,
      );
    }
    this.baseUrl = (process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    this.apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || "";
    this.model = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  }

  configured(): boolean {
    return this.apiKey.length > 0;
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(inputs: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("EMBEDDING_API_KEY is not set.");
    }
    const body: Record<string, unknown> = {
      model: this.model,
      input: inputs.map((input) => input.slice(0, 12000)),
    };
    const sendDimensions =
      process.env.EMBEDDING_SEND_DIMENSIONS === "true" || this.model.startsWith("text-embedding-3");
    if (sendDimensions) body.dimensions = EMBEDDING_DIMENSION;
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Embedding request failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as EmbeddingResponse;
    const rows = [...(payload.data ?? [])].sort((left, right) => left.index - right.index);
    if (rows.length !== inputs.length) {
      throw new Error("The embedding response did not return a vector for every input.");
    }
    for (const row of rows) {
      if (!Array.isArray(row.embedding) || row.embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Expected ${EMBEDDING_DIMENSION} embedding dimensions.`);
      }
    }
    return rows.map((row) => row.embedding);
  }
}

export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected ${EMBEDDING_DIMENSION} embedding dimensions.`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite number.");
  }
  return `[${values.join(",")}]`;
}
