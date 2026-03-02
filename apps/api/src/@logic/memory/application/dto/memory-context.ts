export interface MemoryContext {
  facts: Array<{ category: string; fact: string }>;
  recentEmotions: Array<{ tone: string; content: string }>;
}
