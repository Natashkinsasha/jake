CREATE INDEX IF NOT EXISTS "memory_embeddings_vector_idx"
  ON "memory_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);
