import type {
  AskRequest,
  AskResponse,
  HistoryItem,
  PaperDetail,
  ResearchRecord,
} from "@researchx/shared";

export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    return `Request failed (${response.status}).`;
  }
  return `Request failed (${response.status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export function askResearch(body: AskRequest): Promise<AskResponse> {
  return request<AskResponse>("/api/research/ask", { method: "POST", body: JSON.stringify(body) });
}

export function getReport(id: string): Promise<ResearchRecord> {
  return request<ResearchRecord>(`/api/research/${id}`);
}

export function getHistory(): Promise<HistoryItem[]> {
  return request<HistoryItem[]>("/api/research/history");
}

export function getPaper(id: string): Promise<PaperDetail> {
  return request<PaperDetail>(`/api/papers/${id}`);
}
