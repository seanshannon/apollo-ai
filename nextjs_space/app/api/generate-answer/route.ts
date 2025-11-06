

/**
 * Natural Language Answer Generation API
 * Generates human-readable explanations of query results using LLM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const maxDuration = 30; // Allow up to 30 seconds for answer generation

const ABACUS_API_KEY = process.env.ABACUSAI_API_KEY;
const ABACUS_API_URL = 'https://apps.abacus.ai/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { query, data, sql } = await request.json();

    if (!query || !data) {
      return NextResponse.json(
        { error: 'Query and data are required' },
        { status: 400 }
      );
    }

    // Prepare data summary for the LLM
    const dataSummary = prepareDataSummary(data);

    // Generate natural language answer using LLM
    const answer = await generateNaturalLanguageAnswer(query, dataSummary, sql);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Answer generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate answer' },
      { status: 500 }
    );
  }
}

/**
 * Prepare a concise summary of the data for the LLM
 */
function prepareDataSummary(data: any[]): string {
  if (!data || data.length === 0) {
    return 'No data returned';
  }

  const columns = Object.keys(data[0]);
  const rowCount = data.length;

  // For small datasets, include all rows
  if (rowCount <= 10) {
    return JSON.stringify(data, null, 2);
  }

  // For larger datasets, include sample rows and statistics
  const sampleRows = data.slice(0, 5);
  
  // Calculate basic statistics for numeric columns
  const statistics: Record<string, any> = {};
  columns.forEach(col => {
    const values = data.map(row => row[col]);
    const numericValues = values.filter(v => typeof v === 'number');
    
    if (numericValues.length > 0) {
      statistics[col] = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
      };
    }
  });

  return JSON.stringify({
    totalRows: rowCount,
    columns,
    sampleRows,
    statistics,
  }, null, 2);
}

/**
 * Generate natural language answer using LLM
 */
async function generateNaturalLanguageAnswer(
  query: string,
  dataSummary: string,
  sql?: string
): Promise<string> {
  try {
    const prompt = `You are a friendly data analyst helping non-technical business users understand their database query results in simple, everyday language.

User's Question: "${query}"

${sql ? `SQL Query Used:\n${sql}\n` : ''}

Data Summary:
${dataSummary}

IMPORTANT INSTRUCTIONS:
1. Start with a direct, clear answer to their question - no technical jargon
2. Use friendly, conversational language like you're explaining to a colleague
3. Include specific numbers, names, and values from the data
4. For lists, mention the top 3-5 items with their key details
5. For counts, state the exact number clearly
6. For location queries, mention the cities/states found
7. If the data shows patterns or trends, point them out
8. Keep it concise (under 150 words) but informative
9. DON'T mention SQL, databases, or technical terms
10. DO use phrases like "You have...", "There are...", "Your top customers are..."

Example style: "You have 156 customers in California. The top spenders are Sarah Johnson ($45,230), Michael Chen ($38,920), and Jennifer Smith ($32,450). Most of them are concentrated in Los Angeles (45 customers) and San Francisco (38 customers)."

Answer:`;

    // Create an AbortController with timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 25000); // 25 second timeout
    
    let response;
    try {
      response = await fetch(ABACUS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ABACUS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful data analyst who explains query results in clear, natural language.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
        signal: abortController.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Answer generation timed out');
        throw new Error('Answer generation timed out. Please try again.');
      }
      
      if (fetchError.cause?.code === 'ECONNREFUSED') {
        console.error('Connection to AI service refused');
        throw new Error('Unable to connect to AI service. Please try again later.');
      }
      
      console.error('Answer generation fetch error:', fetchError);
      throw new Error(`Failed to connect to AI service: ${fetchError.message}`);
    }
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`AI service error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content || 'Unable to generate answer';

    return answer.trim();
  } catch (error) {
    console.error('LLM generation error:', error);
    throw error;
  }
}
