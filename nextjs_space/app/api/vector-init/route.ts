
/**
 * API endpoint to initialize Pinecone vector database
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initializeVectorDB, getVectorDBStats } from '@/lib/vector-db';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Initialize the vector database
    await initializeVectorDB();
    
    // Get stats
    const stats = await getVectorDBStats();
    
    return NextResponse.json({
      success: true,
      message: 'Vector database initialized successfully',
      stats
    });
  } catch (error: any) {
    console.error('Vector DB initialization error:', error);
    return NextResponse.json({
      error: 'Failed to initialize vector database',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get stats
    const stats = await getVectorDBStats();
    
    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Vector DB stats error:', error);
    return NextResponse.json({
      error: 'Failed to get vector database stats',
      details: error.message
    }, { status: 500 });
  }
}
