import type { AskFilters, Scope } from "./types";

export function mentionsEthiopia(question: string, filters?: AskFilters): boolean {
  if (filters?.includeEthiopia === true) return true;
  if ((filters?.country ?? "").trim().toLowerCase() === "ethiopia") return true;
  return /\bethiopia(?:n)?\b/i.test(question);
}

/**
 * Ethiopian rows stay when the question or filter mentions Ethiopia.
 * International rows are included only when includeInternational is true.
 */
export function resolveScopes(question: string, filters?: AskFilters): Scope[] {
  const scopes: Scope[] = [];
  if (mentionsEthiopia(question, filters)) scopes.push("ethiopia");
  if (filters?.includeInternational === true) scopes.push("international");
  return scopes;
}
