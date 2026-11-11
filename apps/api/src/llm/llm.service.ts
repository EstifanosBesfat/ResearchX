import { Injectable } from "@nestjs/common";
import type { LlmDraft } from "@researchx/shared";
import { loadEnv } from "../env";

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

@Injectable()
export class LlmService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    loadEnv();
    this.baseUrl = (
      process.env.LLM_BASE_URL ||
      process.env.EMBEDDING_BASE_URL ||
      "https://api.openai.com/v1"
    ).replace(/\/$/, "");
    this.apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY || "";
    this.model = process.env.LLM_MODEL || "gpt-4o-mini";
  }

  configured(): boolean {
    return this.apiKey.length > 0;
  }

  async completeJson(system: string, user: string): Promise<LlmDraft> {
    if (!this.apiKey) {
      throw new Error("LLM_API_KEY is not set.");
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Synthesis request failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as ChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Synthesis response did not include JSON content.");
    }
    return parseDraft(content);
  }
}

export function parseDraft(content: string): LlmDraft {
  const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(trimmed) as LlmDraft;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Synthesis JSON was not an object.");
  }
  return parsed;
}
