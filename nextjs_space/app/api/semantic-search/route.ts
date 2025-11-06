
/**
 * Semantic search API endpoint
 * Search query history using vector similarity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { searchSimilarQueries, getQuerySuggestions } from '@/lib/vector-db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { query, database, type = 'search', limit = 5 } = body;
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    let results;
    
    if (type === 'suggestions') {
      // Get query suggestions for autocomplete
      results = await getQuerySuggestions(query, database, limit);
    } else {
      // Regular semantic search
      const filter: any = {};
      
      if (database) {
        filter.database = { $eq: database };
      }
      
      // Only show user's own queries for privacy
      filter.userId = { $eq: session.user.email };
      
      results = await searchSimilarQueries(query, limit, filter);
    }
    
    return NextResponse.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error: any) {
    console.error('Semantic search error:', error);
    return NextResponse.json({
      error: 'Failed to perform semantic search',
      details: error.message
    }, { status: 500 });
  }
}
