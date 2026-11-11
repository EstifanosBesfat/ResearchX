export interface RankedChunk {
  chunkId: string;
  paperId: string;
  section: string;
  chunkIndex: number;
  content: string;
  cosineSim: number;
  vectorRank: number | null;
  keywordRank: number | null;
  score: number;
}

interface RawHit {
  chunkId: string;
  paperId: string;
  section: string;
  chunkIndex: number;
  content: string;
  cosineSim: number;
  vectorRank?: number | null;
  keywordRank?: number | null;
}

export function fuseChunks(vectorHits: RawHit[], keywordHits: RawHit[], k = 60): RankedChunk[] {
  const merged = new Map<string, RawHit>();
  vectorHits.forEach((hit, index) => {
    merged.set(hit.chunkId, { ...hit, vectorRank: index + 1, keywordRank: null });
  });
  keywordHits.forEach((hit, index) => {
    const existing = merged.get(hit.chunkId);
    if (existing) {
      existing.keywordRank = index + 1;
      if (!Number.isFinite(existing.cosineSim)) existing.cosineSim = hit.cosineSim;
      return;
    }
    merged.set(hit.chunkId, { ...hit, vectorRank: null, keywordRank: index + 1 });
  });
  return [...merged.values()]
    .map((hit) => {
      const vectorScore = hit.vectorRank ? 1 / (k + hit.vectorRank) : 0;
      const keywordScore = hit.keywordRank ? 1 / (k + hit.keywordRank) : 0;
      return {
        chunkId: hit.chunkId,
        paperId: hit.paperId,
        section: hit.section,
        chunkIndex: hit.chunkIndex,
        content: hit.content,
        cosineSim: Number(hit.cosineSim) || 0,
        vectorRank: hit.vectorRank ?? null,
        keywordRank: hit.keywordRank ?? null,
        score: vectorScore + keywordScore,
      };
    })
    .sort((left, right) => right.score - left.score || right.cosineSim - left.cosineSim);
}

export interface PaperGroup {
  paperId: string;
  score: number;
  passages: RankedChunk[];
}

export function groupStudies(chunks: RankedChunk[], perPaper: number, studyLimit: number): PaperGroup[] {
  const groups = new Map<string, RankedChunk[]>();
  for (const chunk of chunks) {
    const list = groups.get(chunk.paperId) ?? [];
    list.push(chunk);
    groups.set(chunk.paperId, list);
  }
  return [...groups.entries()]
    .map(([paperId, passages]) => {
      const ranked = [...passages].sort((left, right) => right.score - left.score).slice(0, perPaper);
      return {
        paperId,
        score: ranked[0]?.score ?? 0,
        passages: ranked,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, studyLimit);
}

export function keywordQueryText(question: string): string | null {
  const cleaned = question.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned.length >= 3 ? cleaned.slice(0, 500) : null;
}
