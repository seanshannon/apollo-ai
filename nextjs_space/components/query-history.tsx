
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataVisualization } from '@/components/data-visualization';
import { toast } from 'sonner';
import {
  Clock,
  Database,
  ChevronDown,
  ChevronUp,
  Trash2,
  Play,
  Calendar,
  User,
  Search,
  Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface QueryRecord {
  id: string;
  query: string;
  result: any;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
  database: {
    name: string;
  };
}

export function QueryHistory() {
  const [history, setHistory] = useState<QueryRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<any[]>([]);
  const [showSemanticSearch, setShowSemanticSearch] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/query-history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/query-history?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setHistory(history.filter((item) => item.id !== id));
        toast.success('Query deleted from history');
      } else {
        toast.error('Failed to delete query');
      }
    } catch (error) {
      toast.error('Failed to delete query');
    }
  };

  const handleRerun = async (query: string, databaseId: string) => {
    toast.info('Rerunning query...');
    // This would typically trigger the query interface with the saved query
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setShowSemanticSearch(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          type: 'search',
          limit: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSemanticResults(data.results || []);
        setShowSemanticSearch(true);
        toast.success(`Found ${data.results?.length || 0} similar queries`);
      } else {
        toast.error('Failed to search queries');
      }
    } catch (error) {
      toast.error('Failed to search queries');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSemanticSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSemanticSearch(false);
    setSemanticResults([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">Loading your query history...</p>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-12 text-center border-2 border-dashed">
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Clock className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">No queries yet</h3>
            <p className="text-muted-foreground">
              Your query history will appear here once you start asking questions
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Semantic Search Bar */}
      <Card className="p-6 bg-gradient-to-r from-green-50 to-yellow-50 border-2 border-green-200">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">AI-Powered Semantic Search</h3>
              <p className="text-sm text-gray-600">Find queries by meaning, not just keywords</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="e.g., 'customer revenue analysis' or 'login issues last month'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="pl-10 h-12 text-base border-2"
              />
            </div>
            <Button
              onClick={handleSemanticSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="h-12 px-6 bg-green-600 hover:bg-green-700"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Search
                </>
              )}
            </Button>
            {showSemanticSearch && (
              <Button
                onClick={clearSearch}
                variant="outline"
                className="h-12 px-6"
              >
                Clear
              </Button>
            )}
          </div>

          {showSemanticSearch && semanticResults.length > 0 && (
            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-300">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Found {semanticResults.length} similar queries:
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {semanticResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 rounded border hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{result.metadata.query}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {result.metadata.database}
                          </span>
                          <span>Similarity: {(result.score * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showSemanticSearch && semanticResults.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <p className="text-sm text-gray-700">
                No similar queries found. Try a different search term.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Regular History */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Queries</h3>
        <div className="space-y-4">
          {history.map((item) => {
        const isExpanded = expandedId === item.id;
        const hasData = item.result?.data && Array.isArray(item.result.data);

        return (
          <Card
            key={item.id}
            className="overflow-hidden border-2 hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-white to-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                      <Database className="w-3.5 h-3.5" />
                      {item.database.name}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      {item.user.name || item.user.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 leading-relaxed">
                    {item.query}
                  </p>
                  {hasData && (
                    <p className="text-sm text-muted-foreground">
                      {item.result.data.length} {item.result.data.length === 1 ? 'result' : 'results'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {hasData && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      className="gap-2"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          View
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Results */}
            {isExpanded && hasData && (
              <div className="p-6 bg-white border-t-2">
                <DataVisualization data={item.result.data} />
              </div>
            )}

            {/* SQL Preview */}
            {item.result?.sql && (
              <div className="px-6 py-4 bg-gray-50 border-t">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    View Generated SQL
                  </summary>
                  <pre className="mt-3 p-4 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto text-sm font-mono">
                    {item.result.sql}
                  </pre>
                </details>
              </div>
            )}
          </Card>
        );
      })}
        </div>
      </div>
    </div>
  );
}
