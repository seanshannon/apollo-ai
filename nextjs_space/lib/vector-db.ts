
/**
 * Pinecone Vector Database Integration
 * Semantic search and query pattern storage
 */

import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import { generateEmbedding } from './embeddings';

// Load Pinecone API key from auth secrets
function getPineconeApiKey(): string {
  try {
    const secretsPath = '/home/ubuntu/.config/abacusai_auth_secrets.json';
    const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
    return secrets.pinecone?.secrets?.api_key?.value || '';
  } catch (error) {
    console.error('Error loading Pinecone API key:', error);
    throw new Error('Pinecone API key not found');
  }
}

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = getPineconeApiKey();
    pineconeClient = new Pinecone({
      apiKey: apiKey
    });
  }
  return pineconeClient;
}

// Index name for query patterns
const INDEX_NAME = 'picard-query-patterns';

/**
 * Query pattern metadata stored in Pinecone
 */
export interface QueryMetadata {
  query: string;
  sql: string;
  database: string;
  databaseType: string;
  success: boolean;
  executionTime?: number;
  rowCount?: number;
  confidence?: number;
  userId: string;
  timestamp: string;
  error?: string;
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
  id: string;
  score: number;
  metadata: QueryMetadata;
}

/**
 * Initialize Pinecone index (create if doesn't exist)
 */
export async function initializeVectorDB(): Promise<void> {
  try {
    const pc = getPineconeClient();
    
    // Check if index exists
    const indexes = await pc.listIndexes();
    const indexExists = indexes.indexes?.some(idx => idx.name === INDEX_NAME);
    
    if (!indexExists) {
      console.log(`Creating Pinecone index: ${INDEX_NAME}`);
      await pc.createIndex({
        name: INDEX_NAME,
        dimension: 1536, // text-embedding-3-small dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      
      // Wait for index to be ready
      console.log('Waiting for index to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    console.log('Vector DB initialized successfully');
  } catch (error) {
    console.error('Error initializing vector DB:', error);
    throw error;
  }
}

/**
 * Store a query pattern in the vector database
 */
export async function storeQueryPattern(
  metadata: QueryMetadata
): Promise<string> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME);
    
    // Generate embedding for the query
    const { embedding } = await generateEmbedding(metadata.query);
    
    // Create unique ID
    const id = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in Pinecone
    await index.upsert([
      {
        id,
        values: embedding,
        metadata: {
          ...metadata,
          // Convert bigint/date values to strings for JSON serialization
          executionTime: metadata.executionTime?.toString(),
          rowCount: metadata.rowCount?.toString()
        } as any
      }
    ]);
    
    return id;
  } catch (error) {
    console.error('Error storing query pattern:', error);
    throw error;
  }
}

/**
 * Search for similar queries using semantic search
 */
export async function searchSimilarQueries(
  query: string,
  topK: number = 5,
  filter?: Record<string, any>
): Promise<SemanticSearchResult[]> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME);
    
    // Generate embedding for the search query
    const { embedding } = await generateEmbedding(query);
    
    // Search in Pinecone
    const searchResults = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter
    });
    
    // Format results
    return searchResults.matches?.map(match => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as unknown as QueryMetadata
    })) || [];
  } catch (error) {
    console.error('Error searching similar queries:', error);
    throw error;
  }
}

/**
 * Get query suggestions based on partial input
 */
export async function getQuerySuggestions(
  partialQuery: string,
  database: string,
  limit: number = 5
): Promise<SemanticSearchResult[]> {
  try {
    // Search for similar successful queries from the same database
    const results = await searchSimilarQueries(
      partialQuery,
      limit * 2, // Get more results to filter
      {
        database: { $eq: database },
        success: { $eq: true }
      }
    );
    
    // Filter and sort by score
    return results
      .filter(r => r.score > 0.7) // Only highly relevant suggestions
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting query suggestions:', error);
    return [];
  }
}

/**
 * Find similar successful queries for error recovery
 */
export async function findAlternativeQueries(
  failedQuery: string,
  database: string,
  limit: number = 3
): Promise<SemanticSearchResult[]> {
  try {
    const results = await searchSimilarQueries(
      failedQuery,
      limit * 2,
      {
        database: { $eq: database },
        success: { $eq: true }
      }
    );
    
    return results
      .filter(r => r.score > 0.8) // Very similar queries
      .slice(0, limit);
  } catch (error) {
    console.error('Error finding alternative queries:', error);
    return [];
  }
}

/**
 * Get database-specific query patterns for context
 */
export async function getDatabaseContext(
  database: string,
  databaseType: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME);
    
    // Get recent successful queries for this database
    const results = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector for filter-only query
      topK: limit,
      includeMetadata: true,
      filter: {
        database: { $eq: database },
        databaseType: { $eq: databaseType },
        success: { $eq: true }
      }
    });
    
    return results.matches?.map(match => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as unknown as QueryMetadata
    })) || [];
  } catch (error) {
    console.error('Error getting database context:', error);
    return [];
  }
}

/**
 * Delete query patterns (for cleanup)
 */
export async function deleteQueryPattern(id: string): Promise<void> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME);
    await index.deleteOne(id);
  } catch (error) {
    console.error('Error deleting query pattern:', error);
    throw error;
  }
}

/**
 * Get vector database stats
 */
export async function getVectorDBStats(): Promise<{
  totalVectors: number;
  dimension: number;
}> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(INDEX_NAME);
    const stats = await index.describeIndexStats();
    
    return {
      totalVectors: stats.totalRecordCount || 0,
      dimension: stats.dimension || 1536
    };
  } catch (error) {
    console.error('Error getting vector DB stats:', error);
    return { totalVectors: 0, dimension: 1536 };
  }
}
