
/**
 * Shared Query View Page
 * Displays shared query results via deep link
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Share2, 
  Download, 
  Database, 
  Clock, 
  User, 
  ExternalLink,
  AlertCircle 
} from 'lucide-react'
import { DataVisualization } from '@/components/data-visualization'
import { exportToCSV, exportToJSON, exportToPDF } from '@/lib/data-export'

interface SharedQuery {
  naturalQuery: string
  databaseName: string
  results: any[]
  resultsSummary: string
  generatedSql: string
  executionTime: number
  createdAt: string
  sharedBy: string
}

export default function SharedQueryPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [query, setQuery] = useState<SharedQuery | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      loadSharedQuery()
    }
  }, [token])

  const loadSharedQuery = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/share-query?token=${encodeURIComponent(token)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load shared query')
      }

      setQuery(data.query)
    } catch (err) {
      console.error('Error loading shared query:', err)
      setError(err instanceof Error ? err.message : 'Failed to load shared query')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    if (!query?.results) return

    const filename = `picard-shared-query-${Date.now()}`

    try {
      switch (format) {
        case 'csv':
          exportToCSV(query.results, `${filename}.csv`)
          break
        case 'json':
          exportToJSON(query.results, `${filename}.json`, {
            query: query.naturalQuery,
            database: query.databaseName,
            sharedBy: query.sharedBy
          })
          break
        case 'pdf':
          exportToPDF(query.results, `${filename}.pdf`, {
            title: 'Picard.ai Shared Query Results',
            summary: query.resultsSummary
          })
          break
      }
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-6 text-center">
            <Button onClick={() => router.push('/')}>
              Go to Picard.ai
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!query) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-2xl">Shared Query Results</CardTitle>
                </div>
                <CardDescription className="text-base">
                  {query.naturalQuery}
                </CardDescription>
              </div>
              <Button onClick={() => router.push('/')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Picard.ai
              </Button>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Shared by {query.sharedBy}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <Badge variant="outline">{query.databaseName}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{new Date(query.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Summary */}
        {query.resultsSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{query.resultsSummary}</p>
            </CardContent>
          </Card>
        )}

        {/* Data Visualization */}
        {query.results && query.results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Results ({query.results.length} rows)</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('json')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('pdf')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataVisualization data={query.results} />
            </CardContent>
          </Card>
        )}

        {/* SQL Query */}
        {query.generatedSql && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generated SQL</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{query.generatedSql}</code>
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Powered by Picard.ai - Natural Language Intelligence for Data Access</p>
        </div>
      </div>
    </div>
  )
}
