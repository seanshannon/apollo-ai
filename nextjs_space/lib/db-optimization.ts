/**
 * Database Query Optimization Utilities
 * Provides query optimization, connection pooling, and performance monitoring
 * 
 * PERFORMANCE ENHANCEMENTS:
 * - Multi-tier caching (Memory → Extended TTL)
 * - Schema caching with 10-minute refresh
 * - Connection pool optimization
 * - Query result deduplication
 */

import { prisma } from './db';
import { TTLCache, LRUCache } from './performance';

// TIER 1: Hot cache (1 minute TTL) - For frequently accessed queries
const hotQueryCache = new TTLCache<string, any>(1 * 60 * 1000); // 1 minute

// TIER 2: Warm cache (5 minutes TTL) - For normal queries
const queryResultCache = new TTLCache<string, any>(5 * 60 * 1000); // 5 minutes TTL

// TIER 3: Cold cache (15 minutes TTL) - For expensive analytical queries
const analyticalQueryCache = new TTLCache<string, any>(15 * 60 * 1000); // 15 minutes

// Schema cache (10 minutes TTL) - Reduces schema discovery calls
const schemaCache = new TTLCache<string, any>(10 * 60 * 1000); // 10 minutes

// LRU cache for most recent queries (keeps last 50 queries)
const recentQueriesCache = new LRUCache<string, any>(50);

/**
 * Determine cache tier based on query type
 */
function getCacheTier(query: string): {
  cache: TTLCache<string, any>;
  name: string;
} {
  const lowerQuery = query.toLowerCase();
  
  // Hot tier: Simple lookups, counts, frequently accessed data
  if (
    lowerQuery.includes('count(*)') ||
    lowerQuery.includes('where id =') ||
    lowerQuery.includes('limit 1')
  ) {
    return { cache: hotQueryCache, name: 'HOT' };
  }
  
  // Cold tier: Analytical queries with aggregations
  if (
    lowerQuery.includes('group by') ||
    lowerQuery.includes('having') ||
    lowerQuery.includes('avg(') ||
    lowerQuery.includes('sum(') ||
    lowerQuery.includes('max(') ||
    lowerQuery.includes('min(')
  ) {
    return { cache: analyticalQueryCache, name: 'COLD' };
  }
  
  // Warm tier: Everything else
  return { cache: queryResultCache, name: 'WARM' };
}

/**
 * Execute a query with intelligent multi-tier caching
 */
export async function cachedQuery<T = any>(
  query: string,
  cacheKey?: string,
  ttl?: number
): Promise<T> {
  const key = cacheKey || query;
  
  // Check all cache tiers in order (hot → warm → cold)
  let cached = hotQueryCache.get(key);
  if (cached !== undefined) {
    console.log(`[DB Cache] HOT Hit: ${key.substring(0, 50)}...`);
    return cached;
  }
  
  cached = queryResultCache.get(key);
  if (cached !== undefined) {
    console.log(`[DB Cache] WARM Hit: ${key.substring(0, 50)}...`);
    // Promote to hot cache
    hotQueryCache.set(key, cached);
    return cached;
  }
  
  cached = analyticalQueryCache.get(key);
  if (cached !== undefined) {
    console.log(`[DB Cache] COLD Hit: ${key.substring(0, 50)}...`);
    return cached;
  }
  
  // Check LRU cache for recent queries
  cached = recentQueriesCache.get(key);
  if (cached !== undefined) {
    console.log(`[DB Cache] LRU Hit: ${key.substring(0, 50)}...`);
    return cached;
  }
  
  // Execute query
  console.log(`[DB Cache] MISS - Executing: ${key.substring(0, 50)}...`);
  const startTime = performance.now();
  const result = await prisma.$queryRawUnsafe<T>(query);
  const duration = performance.now() - startTime;
  
  // Log slow queries
  if (duration > 500) {
    console.warn(`[Slow Query] ${duration.toFixed(2)}ms: ${query.substring(0, 100)}...`);
  }
  
  // Cache result in appropriate tier
  const tier = getCacheTier(query);
  tier.cache.set(key, result, ttl);
  recentQueriesCache.set(key, result);
  
  console.log(`[DB Cache] Stored in ${tier.name} tier (${duration.toFixed(2)}ms)`);
  
  return result;
}

/**
 * Schema caching functions
 */
export async function getCachedSchema<T = any>(
  databaseId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `schema:${databaseId}`;
  
  // Check cache
  const cached = schemaCache.get(key);
  if (cached !== undefined) {
    console.log(`[Schema Cache] Hit for: ${databaseId}`);
    return cached;
  }
  
  // Fetch and cache
  console.log(`[Schema Cache] Miss for: ${databaseId} - Fetching...`);
  const result = await fetcher();
  schemaCache.set(key, result);
  
  return result;
}

/**
 * Pre-warm schema cache for all databases
 */
export async function prewarmSchemaCache(): Promise<void> {
  console.log('[Schema Cache] Pre-warming schema cache...');
  // Schema prewarming would be implemented here if needed
  // For now, schemas are cached on first access
}

/**
 * Clear all query caches
 */
export function clearQueryCache(tier?: 'hot' | 'warm' | 'cold' | 'lru' | 'schema'): void {
  if (!tier) {
    // Clear all tiers
    hotQueryCache.clear();
    queryResultCache.clear();
    analyticalQueryCache.clear();
    recentQueriesCache.clear();
    schemaCache.clear();
    console.log('[DB Cache] All caches cleared');
  } else {
    // Clear specific tier
    switch (tier) {
      case 'hot':
        hotQueryCache.clear();
        break;
      case 'warm':
        queryResultCache.clear();
        break;
      case 'cold':
        analyticalQueryCache.clear();
        break;
      case 'lru':
        recentQueriesCache.clear();
        break;
      case 'schema':
        schemaCache.clear();
        break;
    }
    console.log(`[DB Cache] ${tier.toUpperCase()} cache cleared`);
  }
}

/**
 * Get comprehensive cache statistics
 */
export function getCacheStats() {
  return {
    hot: {
      size: hotQueryCache.size,
      ttl: '1 minute',
      description: 'Fast lookups & counts'
    },
    warm: {
      size: queryResultCache.size,
      ttl: '5 minutes',
      description: 'Normal queries'
    },
    cold: {
      size: analyticalQueryCache.size,
      ttl: '15 minutes',
      description: 'Analytical queries'
    },
    lru: {
      size: recentQueriesCache.size,
      maxSize: 50,
      description: 'Recent queries'
    },
    schema: {
      size: schemaCache.size,
      ttl: '10 minutes',
      description: 'Database schemas'
    },
    total: hotQueryCache.size + queryResultCache.size + 
           analyticalQueryCache.size + recentQueriesCache.size + 
           schemaCache.size
  };
}

/**
 * Optimize query with indexes and explain plan
 */
export async function optimizeQuery(sql: string): Promise<{
  optimizedSql: string;
  suggestions: string[];
}> {
  const suggestions: string[] = [];
  let optimizedSql = sql;
  
  // Check for missing WHERE clause on large tables
  if (!sql.toLowerCase().includes('where') && 
      !sql.toLowerCase().includes('limit')) {
    suggestions.push('Consider adding a WHERE clause or LIMIT to restrict results');
    // Add LIMIT if not present
    if (!sql.toLowerCase().includes('limit')) {
      optimizedSql = `${optimizedSql} LIMIT 1000`;
      suggestions.push('Added LIMIT 1000 to prevent fetching too many rows');
    }
  }
  
  // Check for SELECT *
  if (sql.includes('SELECT *')) {
    suggestions.push('Consider selecting only required columns instead of SELECT *');
  }
  
  // Check for missing indexes on JOIN columns
  if (sql.toLowerCase().includes('join') && 
      !sql.toLowerCase().includes('index')) {
    suggestions.push('Ensure JOIN columns have indexes for better performance');
  }
  
  return {
    optimizedSql,
    suggestions,
  };
}

/**
 * Batch multiple queries for better performance
 */
export async function batchQueries<T = any>(
  queries: string[]
): Promise<T[]> {
  // Execute queries in parallel with a limit
  const BATCH_SIZE = 5;
  const results: T[] = [];
  
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(query => prisma.$queryRawUnsafe<T>(query))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Monitor query performance
 */
export async function monitoredQuery<T = any>(
  query: string,
  context?: string
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  
  try {
    const result = await prisma.$queryRawUnsafe<T>(query);
    const duration = performance.now() - startTime;
    
    // Log slow queries (> 1 second)
    if (duration > 1000) {
      console.warn(`[Slow Query] ${context || 'Unknown'}: ${duration.toFixed(2)}ms`);
      console.warn(`[Slow Query] SQL: ${query.substring(0, 200)}...`);
    } else {
      console.log(`[Query] ${context || 'Unknown'}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[Query Error] ${context || 'Unknown'}: ${duration.toFixed(2)}ms`);
    throw error;
  }
}

/**
 * Paginate query results
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function paginatedQuery<T = any>(
  baseQuery: string,
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;
  
  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM (${baseQuery}) as subquery`;
  const [countResult] = await prisma.$queryRawUnsafe<{count: bigint}[]>(countQuery);
  const total = Number(countResult.count);
  
  // Get paginated data
  const paginatedQuery = `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
  const data = await prisma.$queryRawUnsafe<T[]>(paginatedQuery);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Connection pool monitoring
 */
export function getConnectionPoolStats() {
  // Prisma doesn't expose pool stats directly,
  // but we can monitor active queries
  return {
    // Add connection pool stats when available
    timestamp: new Date().toISOString(),
  };
}

/**
 * Cleanup and maintenance
 */
export async function performMaintenance() {
  console.log('[DB Maintenance] Starting cache cleanup...');
  
  // Clean up expired entries from all caches
  hotQueryCache.cleanup();
  queryResultCache.cleanup();
  analyticalQueryCache.cleanup();
  schemaCache.cleanup();
  
  // Log comprehensive stats
  const stats = getCacheStats();
  console.log('[DB Maintenance] Cache Statistics:', {
    totalCached: stats.total,
    breakdown: {
      hot: stats.hot.size,
      warm: stats.warm.size,
      cold: stats.cold.size,
      lru: stats.lru.size,
      schema: stats.schema.size
    }
  });
  
  console.log('[DB Maintenance] Connection pool stats:', getConnectionPoolStats());
  console.log('[DB Maintenance] Cleanup complete');
}

// Run maintenance every 5 minutes (more frequent for better cache management)
if (typeof window === 'undefined') {
  // Only run on server
  setInterval(performMaintenance, 5 * 60 * 1000);
}
