// Mock embedding service
export async function generateEmbedding(text: string): Promise<number[]> {
  // Return mock embedding vector
  return new Array(1536).fill(0).map(() => Math.random());
}

export async function searchSimilarDocuments(
  embedding: number[],
  options?: {
    limit?: number;
    threshold?: number;
    location?: any;
    type?: string;
  }
): Promise<Array<{
  id: string;
  content: string;
  similarity: number;
  metadata?: any;
}>> {
  // Return mock similar documents
  return [
    {
      id: 'doc1',
      content: 'Sample document content for testing',
      similarity: 0.85,
      metadata: { type: 'place', category: 'tourist_attraction' }
    }
  ];
}