/** Long tokens that are too generic to mark a question as off-corpus. */
export const GENERIC_TOKENS = new Set([
  "associated",
  "association",
  "international",
  "interventions",
  "intervention",
  "comparison",
  "systematic",
  "prevalence",
  "determinants",
  "determinant",
  "utilization",
  "prevention",
  "treatment",
  "outcomes",
  "services",
  "evidence",
  "maternal",
  "mortality",
  "malaria",
  "ethiopia",
  "ethiopian",
  "studies",
  "factors",
  "analysis",
  "review",
  "health",
  "children",
  "women",
  "pregnant",
  "pregnancy",
  "antenatal",
  "delivery",
  "community",
  "national",
  "regional",
  "global",
  "findings",
  "results",
  "methods",
  "discussion",
  "patients",
  "population",
  "morbidity",
  "coverage",
  "effective",
  "effectiveness",
  "retrieved",
  "settings",
  "compare",
  "across",
  "among",
  "adults",
  "reduce",
  "default",
]);

export function distinctiveTokens(question: string): string[] {
  const tokens = question.toLowerCase().match(/[a-z]{10,}/g) ?? [];
  return [...new Set(tokens.filter((token) => !GENERIC_TOKENS.has(token)))];
}

export function countPassagesCovering(tokens: string[], passages: string[]): number {
  if (tokens.length === 0) return passages.length;
  return passages.filter((passage) => {
    const haystack = passage.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).length;
}

export function topicGap(tokens: string[]): string {
  const topic = tokens.slice(0, 3).join(", ");
  return `Fewer than two retrieved passages mention ${topic}. The corpus does not contain enough evidence to answer this question. No answer was written from model memory, and no statistics were produced.`;
}
