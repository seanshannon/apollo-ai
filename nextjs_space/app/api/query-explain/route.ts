
/**
 * Query Explanation API
 * Provides detailed explanations of SQL queries and their execution
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { sql, databaseId, naturalQuery } = body

    if (!sql || !databaseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'QUERY_EXPLAIN',
      resource: `database:${databaseId}`,
      details: { sql, naturalQuery },
      ipAddress,
      userAgent,
      success: true
    })

    // Call LLM to explain the query
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{
          role: 'user',
          content: `You are a helpful database expert. Explain the following SQL query in simple terms that a non-technical person can understand.

Database: ${databaseId}
Natural Language Query: "${naturalQuery}"
SQL Query: ${sql}

Provide a detailed explanation covering:
1. What data is being retrieved
2. What tables are being accessed
3. Any filters or conditions applied
4. How the data is being sorted or grouped
5. Expected performance considerations

Respond in JSON format:
{
  "explanation": "Simple, easy-to-understand explanation here",
  "technical_details": "More technical details for power users",
  "tables_accessed": ["table1", "table2"],
  "performance_notes": "Performance considerations",
  "security_notes": "Any security considerations"
}

Respond with raw JSON only.`
        }],
        max_tokens: 1500,
        response_format: { type: "json_object" }
      })
    })

    const result = await response.json()
    const explanation = JSON.parse(result.choices[0].message.content)

    return NextResponse.json({
      success: true,
      ...explanation
    })

  } catch (error) {
    console.error('Query explanation error:', error)
    return NextResponse.json(
      { error: 'Failed to explain query' },
      { status: 500 }
    )
  }
}
