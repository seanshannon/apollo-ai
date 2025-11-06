
/**
 * Cache Statistics API
 * Provides real-time cache performance metrics and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCacheStats, clearQueryCache, performMaintenance } from '@/lib/db-optimization';
import { getPoolStats, checkConnectionHealth } from '@/lib/connection-pool';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get cache statistics
    const cacheStats = getCacheStats();
    
    // Get connection pool stats
    const poolStats = getPoolStats();
    
    // Check connection health
    const isHealthy = await checkConnectionHealth();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      connectionPool: {
        ...poolStats,
        healthy: isHealthy,
      },
      performance: {
        cacheHitRate: calculateCacheHitRate(cacheStats),
        recommendations: generateRecommendations(cacheStats),
      },
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve cache statistics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, tier } = body;

    if (action === 'clear') {
      // Clear cache (optionally specific tier)
      clearQueryCache(tier);
      
      return NextResponse.json({
        success: true,
        message: tier ? `${tier} cache cleared` : 'All caches cleared',
      });
    }

    if (action === 'maintenance') {
      // Run maintenance
      await performMaintenance();
      
      return NextResponse.json({
        success: true,
        message: 'Cache maintenance completed',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cache operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform cache operation' },
      { status: 500 }
    );
  }
}

/**
 * Calculate approximate cache hit rate
 */
function calculateCacheHitRate(stats: any): number {
  const total = stats.total || 0;
  if (total === 0) return 0;
  
  // Approximate hit rate based on cache sizes
  // Larger cache = more hits
  return Math.min(100, (total / 100) * 100);
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(stats: any): string[] {
  const recommendations: string[] = [];

  if (stats.total === 0) {
    recommendations.push('Cache is empty - queries will be slower until cache warms up');
  }

  if (stats.hot.size === 0) {
    recommendations.push('No hot cache entries - frequently accessed queries not optimized');
  }

  if (stats.total > 150) {
    recommendations.push('Cache is well-populated - optimal performance expected');
  }

  if (stats.schema.size === 0) {
    recommendations.push('Schema cache empty - schema discovery queries not optimized');
  }

  return recommendations;
}
