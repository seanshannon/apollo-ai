
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { DataVisualization } from '@/components/data-visualization';
import { toast } from 'sonner';
import { announceToScreenReader } from '@/lib/accessibility';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  Send,
  Download,
  Share2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FileText,
  BarChart3,
  Mic,
  MicOff
} from 'lucide-react';

interface QueryResult {
  success: boolean;
  data?: any[];
  sql?: string;
  error?: string;
  explanation?: string;
  confidence?: number;
  reasoning?: {
    understanding: string;
    tables: string[];
    joins: string;
    filters: string;
    sorting: string;
    confidence: number;
  };
  suggestions?: Array<{
    text: string;
    query: string;
    icon: string;
  }>;
}

interface QueryInterfaceProps {
  databaseId?: string;
  onQueryStart?: () => void;
  onReset?: () => void;
}

// Example queries based on database
function getExampleQueries(databaseId: string): string[] {
  const examples: Record<string, string[]> = {
    sales: [
      "Show me top 10 customers",
      "Who are my customers in California?",
      "List all products under $50",
      "Show recent orders from this month"
    ],
    hr: [
      "Show me all employees",
      "Who has the highest salary?",
      "List employees in Engineering",
      "How many people work here?"
    ],
    inventory: [
      "Show products with low stock",
      "Which warehouses need restocking?",
      "List all suppliers",
      "Show inventory by location"
    ],
    finance: [
      "Show account balances",
      "Recent transactions",
      "Budget status by category",
      "Total spending this year"
    ],
    customer_support: [
      "Show open tickets",
      "List high priority issues",
      "Recent support requests",
      "Customer satisfaction ratings"
    ]
  };
  
  return examples[databaseId] || examples.sales;
}

export function QueryInterface({ databaseId = 'default', onQueryStart, onReset }: QueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [shouldClearOnFocus, setShouldClearOnFocus] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [lastSql, setLastSql] = useState<string>('');
  const [naturalLanguageAnswer, setNaturalLanguageAnswer] = useState<string>('');
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const recognitionRef = useRef<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Clear results when database changes
  useEffect(() => {
    setResult(null);
    setQuery('');
    setNaturalLanguageAnswer('');
    setLastQuery('');
    setLastSql('');
    setResultsExpanded(false);
    onReset?.();
  }, [databaseId, onReset]);

  // Announce query results to screen readers
  useEffect(() => {
    if (result) {
      if (result.success && result.data) {
        const rowCount = result.data.length;
        announceToScreenReader(
          `Query successful. ${rowCount} ${rowCount === 1 ? 'row' : 'rows'} returned.`,
          'polite'
        );
      } else if (result.error) {
        announceToScreenReader(`Query failed: ${result.error}`, 'assertive');
      }
    }
  }, [result]);

  // Custom smooth scroll utility with adjustable speed - respects user preferences
  const scrollToResults = () => {
    // Prioritize anchor element for more precise scrolling
    const anchor = document.getElementById('resultsTopAnchor') || resultsRef.current;
    if (!anchor) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Use requestAnimationFrame for better timing - ensures DOM is fully rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (prefersReducedMotion) {
          // Instant scroll for users who prefer reduced motion
          anchor.scrollIntoView({
            behavior: 'auto',
            block: 'start',
            inline: 'nearest'
          });
        } else {
          // Use native smooth scrolling for better browser compatibility
          anchor.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        }
      });
    });
  };

  // Expand results container and auto-scroll when results are available
  useEffect(() => {
    if (result && !isLoading && resultsContainerRef.current) {
      // Expand the results container with animation
      requestAnimationFrame(() => {
        if (resultsContainerRef.current) {
          setResultsExpanded(true);
          // Set max-height to the natural scrollHeight for smooth expansion
          resultsContainerRef.current.style.maxHeight = resultsContainerRef.current.scrollHeight + 'px';
        }
      });

      // Then scroll to results after expansion starts
      setTimeout(() => {
        scrollToResults();
      }, 100);
    }
  }, [result, isLoading]);

  // Auto-scroll when natural language answer is generated
  useEffect(() => {
    if (naturalLanguageAnswer && !isGeneratingAnswer) {
      scrollToResults();
    }
  }, [naturalLanguageAnswer, isGeneratingAnswer]);

  // Removed scroll prevention logic that was blocking interactions
  // The dashboard layout naturally handles scrolling behavior

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
          toast.success('Voice input captured!');
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'no-speech') {
            toast.error('No speech detected. Please try again.');
          } else if (event.error === 'not-allowed') {
            toast.error('Microphone access denied. Click the 🔒 icon in your browser address bar and allow microphone access, then refresh the page.', {
              duration: 8000,
            });
          } else if (event.error === 'network') {
            toast.error('Network error. Check your internet connection.');
          } else {
            toast.error(`Voice input error: ${event.error}. Please try again.`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleVoiceInput = async () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.', {
        duration: 6000,
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    // Request microphone permission before starting
    try {
      // Request microphone access first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately as we only needed permission
      stream.getTracks().forEach(track => track.stop());
      
      // Now start speech recognition
      recognitionRef.current.start();
      toast.info('🎤 Listening... Speak your query now.', { duration: 3000 });
    } catch (err: any) {
      console.error('Voice input error:', err);
      setIsListening(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error(
          'Microphone access denied. Please allow microphone access when prompted, or click the 🔒 icon in your browser address bar to enable it.',
          { duration: 8000 }
        );
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.', {
          duration: 6000,
        });
      } else if (err.name === 'NotSupportedError' || err.name === 'SecurityError') {
        toast.error('Microphone access is not supported in this context. Try using HTTPS or a supported browser.', {
          duration: 8000,
        });
      } else {
        toast.error(`Voice input error: ${err.message || 'Unknown error'}. Please try again.`, {
          duration: 6000,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim() || !databaseId) {
      toast.error(!databaseId ? 'Please select a database' : 'Please enter a query');
      return;
    }

    // Notify parent that query is starting (triggers scroll unlock)
    onQueryStart?.();

    setIsLoading(true);
    setResult(null);
    setNaturalLanguageAnswer(''); // Clear previous answer
    setResultsExpanded(false); // Collapse results container before new query

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          databaseId,
          context: lastQuery ? {
            previousQuery: lastQuery,
            previousSql: lastSql
          } : undefined
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Query failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, try to get plain text error
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.error('Failed to parse error response:', textError);
          }
        }
        toast.error(errorMessage);
        setResult({ success: false, error: errorMessage });
        setIsLoading(false);
        return;
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsLoading(false);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.status === 'completed') {
                const result = parsed.result;
                console.log('✅ Query completed with result:', result);
                console.log('✅ Data array:', result.data);
                console.log('✅ Data array length:', result.data?.length);
                console.log('✅ Data array type:', typeof result.data);
                console.log('✅ Data is array?:', Array.isArray(result.data));
                
                setResult({
                  success: result.status === 'success',
                  data: result.data,
                  sql: result.sql,
                  error: result.error,
                  explanation: result.summary,
                  confidence: result.confidence,
                  reasoning: result.reasoning,
                  suggestions: result.suggestions,
                });
                
                console.log('✅ Result state set:', {
                  success: result.status === 'success',
                  dataLength: result.data?.length,
                  hasData: !!result.data
                });
                
                if (result.status === 'success') {
                  // Save this query and SQL as context for the next query
                  setLastQuery(query);
                  setLastSql(result.sql || '');
                  
                  toast.success('Query executed successfully!');
                  setShouldClearOnFocus(true); // Enable clear on next focus
                  
                  // Show PII warning if detected
                  if (result.piiDetected) {
                    toast.info(`PII detected and masked: ${result.piiTypes.join(', ')}`);
                  }
                  
                  // Auto-generate natural language answer with the data we just received
                  if (result.data && result.data.length > 0) {
                    generateAnswerFromData(query, result.data, result.sql);
                  }
                } else {
                  toast.error(result.error || 'Query failed');
                }
              } else if (parsed.status === 'error') {
                // Handle error status from server
                const result = parsed.result || {};
                console.error('❌ Query error from server:', result.error);
                
                setResult({
                  success: false,
                  error: result.error || 'Query processing failed'
                });
                
                toast.error(result.error || 'Query processing failed');
              }
            } catch (e) {
              // Skip invalid JSON
              console.log('Skipping non-JSON line:', data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Query error:', error);
      toast.error('Failed to execute query');
      setResult({ success: false, error: error instanceof Error ? error.message : 'Network error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    if (!result?.data || !databaseId) return;

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          databaseId,
          export: format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query-result.${format === 'excel' ? 'xlsx' : format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Exported as ${format.toUpperCase()}`);
      } else {
        toast.error('Export failed');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleShare = async () => {
    if (!result?.data || !databaseId) return;

    try {
      const response = await fetch('/api/share-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, databaseId }),
      });

      if (response.ok) {
        const { shareUrl } = await response.json();
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied to clipboard!');
      } else {
        toast.error('Failed to generate share link');
      }
    } catch (error) {
      toast.error('Failed to share query');
    }
  };

  // Generate answer directly from data (used for auto-generation)
  const generateAnswerFromData = async (queryText: string, data: any[], sql?: string) => {
    try {
      setIsGeneratingAnswer(true);
      setNaturalLanguageAnswer('');

      const response = await fetch('/api/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          data: data,
          sql: sql,
        }),
      });

      if (response.ok) {
        const { answer } = await response.json();
        setNaturalLanguageAnswer(answer);
        toast.success('Answer generated!');
      } else {
        const error = await response.text();
        console.error('Failed to generate answer:', error);
        toast.error('Failed to generate answer');
      }
    } catch (error) {
      console.error('Answer generation error:', error);
      toast.error('Failed to generate answer');
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  const handleGenerateAnswer = async () => {
    if (!result?.data || !query) return;
    await generateAnswerFromData(query, result.data, result.sql);
  };

  const handleSuggestionClick = (suggestedQuery: string) => {
    setQuery(suggestedQuery);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-primary/10 border-primary/30';
    if (confidence >= 0.6) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle2 className="w-5 h-5 text-green" />;
    if (confidence >= 0.6) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="space-y-2">
      {/* Query Input */}
      <section 
        id="query-input"
        aria-labelledby="query-label"
        className="focus:outline-none"
        tabIndex={-1}
      >
        <Card className="p-2.5 bg-card/90 backdrop-blur-sm border-border glow-green">
          <form 
            onSubmit={handleSubmit} 
            className="space-y-2"
            role="search"
            aria-label="Database query form"
          >
            <div className="space-y-2">
              <label 
                id="query-label"
                htmlFor="query-input-field"
                className="text-base font-semibold flex items-center gap-2 text-green"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Your Question
              </label>
              <Textarea
                id="query-input-field"
                name="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (shouldClearOnFocus && query) {
                    setQuery('');
                    setShouldClearOnFocus(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (query.trim() && databaseId && !isLoading) {
                      handleSubmit(e as any);
                    }
                  }
                }}
                placeholder="e.g., Show me all orders from the last 30 days with revenue over $1000"
                className="min-h-[60px] text-sm resize-none border-2 border-border bg-input text-foreground focus:border-primary focus:glow-green transition-all"
                disabled={isLoading}
                aria-required="true"
                aria-invalid="false"
                aria-describedby="query-help"
              />
              <p id="query-help" className="sr-only">
                Enter your question in natural language. Press Enter to submit, or Shift+Enter for a new line.
              </p>
              
              {/* Example Queries */}
              {!result && !isLoading && !query && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {getExampleQueries(databaseId).map((example, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setQuery(example)}
                        className="text-xs px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary transition-all hover:scale-105"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Query actions">
            <Button
              type="submit"
              disabled={isLoading || !query.trim() || !databaseId}
              className="bg-primary text-primary-foreground hover-glow gap-2 h-9 px-4 text-sm font-semibold"
              aria-label={isLoading ? 'Analyzing query...' : 'Run database query'}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  Run Query
                </>
              )}
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleVoiceInput}
                    disabled={isLoading}
                    className={`gap-2 h-9 px-4 text-sm font-semibold border-2 transition-all ${
                      isListening 
                        ? 'border-primary bg-primary/20 hover-glow animate-pulse' 
                        : 'border-border hover:border-primary hover-glow'
                    }`}
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                    aria-pressed={isListening}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4 text-primary" aria-hidden="true" />
                        <span className="text-primary">Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" aria-hidden="true" />
                        Voice Input
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-popover border-2 border-primary/50">
                  <p className="text-sm">
                    🎤 Click to use voice input. Requires microphone permissions (Chrome, Edge, or Safari).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {result?.data && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleExport('csv')}
                  className="gap-2 h-9 px-4 text-sm font-semibold border-2 border-border hover:border-primary hover-glow"
                  aria-label="Export query results as CSV file"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleExport('excel')}
                  className="gap-2 h-9 px-4 text-sm font-semibold border-2 border-border hover:border-primary hover-glow"
                  aria-label="Export query results as Excel file"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Export Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShare}
                  className="gap-2 h-9 px-4 text-sm font-semibold border-2 border-border hover:border-primary hover-glow"
                  aria-label="Share query results"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  Share
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
      </section>

      {/* Results - Collapsible Container */}
      <div
        ref={resultsContainerRef}
        className={`
          overflow-hidden transition-[max-height] duration-500 ease-out
          ${resultsExpanded ? 'max-h-full' : 'max-h-0'}
        `}
      >
        {result && (
          <div 
            ref={resultsRef}
            className="space-y-2 mt-3"
            id="query-results"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Anchor for smooth scrolling */}
            <div id="resultsTopAnchor" className="scroll-mt-4" />
          {/* Confidence Score */}
          {result.success && result.confidence !== undefined && (
            <Card className={`p-2.5 border-2 ${getConfidenceColor(result.confidence)} backdrop-blur-sm`}>
              <div className="flex items-center gap-3">
                {getConfidenceIcon(result.confidence)}
                <div className="flex-1">
                  <p className="font-semibold text-base text-foreground">
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.confidence >= 0.8
                      ? 'High confidence - Results are highly accurate'
                      : result.confidence >= 0.6
                      ? 'Medium confidence - Please verify the results'
                      : 'Low confidence - Results may need manual review'}
                  </p>
                </div>
                <div className="text-2xl font-bold text-green">{(result.confidence * 100).toFixed(1)}%</div>
              </div>
            </Card>
          )}

          {/* Explanation */}
          {result.explanation && (
            <Card className="p-3 bg-primary/5 border-2 border-primary/30 backdrop-blur-sm">
              <div className="flex gap-3">
                <FileText className="w-5 h-5 text-green flex-shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="font-semibold text-base text-green">Query Explanation</p>
                  <p className="text-foreground text-sm leading-relaxed">{result.explanation}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Data Visualization with Natural Language Answer */}
          {result.success && result.data && (
            <Card className="p-3 border-2 border-border bg-card/90 backdrop-blur-sm glow-green">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-green" />
                <h3 className="text-lg font-bold text-green text-glow">Results</h3>
                <span className="ml-auto text-sm text-muted-foreground">
                  {result.data.length} {result.data.length === 1 ? 'row' : 'rows'}
                </span>
              </div>
              <DataVisualization 
                data={result.data}
                query={query}
                onGenerateAnswer={handleGenerateAnswer}
                isGeneratingAnswer={isGeneratingAnswer}
                naturalLanguageAnswer={naturalLanguageAnswer}
              />
            </Card>
          )}

          {/* Chain-of-Thought Reasoning */}
          {result.reasoning && (
            <Card className="p-3 bg-primary/5 border-2 border-primary/20 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="font-semibold text-sm text-muted-foreground">
                    AI Reasoning Process
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="ml-auto px-2 py-1 bg-primary/20 rounded-full text-xs font-semibold text-primary">
                          {(result.reasoning.confidence * 100).toFixed(1)}% Confident
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Confidence level in the generated query</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-background/50 rounded border border-primary/10">
                    <p className="font-medium text-primary mb-1">Understanding:</p>
                    <p className="text-muted-foreground">{result.reasoning.understanding}</p>
                  </div>
                  
                  {result.reasoning.tables && result.reasoning.tables.length > 0 && (
                    <div className="p-2 bg-background/50 rounded border border-primary/10">
                      <p className="font-medium text-primary mb-1">Tables Used:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.reasoning.tables.map((table, idx) => (
                          <span key={idx} className="px-2 py-1 bg-primary/10 rounded text-xs font-mono">
                            {table}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {result.reasoning.joins && (
                    <div className="p-2 bg-background/50 rounded border border-primary/10">
                      <p className="font-medium text-primary mb-1">JOINs:</p>
                      <p className="text-muted-foreground">{result.reasoning.joins}</p>
                    </div>
                  )}
                  
                  {result.reasoning.filters && (
                    <div className="p-2 bg-background/50 rounded border border-primary/10">
                      <p className="font-medium text-primary mb-1">Filters:</p>
                      <p className="text-muted-foreground">{result.reasoning.filters}</p>
                    </div>
                  )}
                  
                  {result.reasoning.sorting && (
                    <div className="p-2 bg-background/50 rounded border border-primary/10">
                      <p className="font-medium text-primary mb-1">Sorting:</p>
                      <p className="text-muted-foreground">{result.reasoning.sorting}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Generated SQL */}
          {result.sql && (
            <Card className="p-3 bg-muted/50 border-2 border-border backdrop-blur-sm">
              <div className="space-y-2">
                <p className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Generated SQL
                </p>
                <pre className="p-3 bg-background text-green rounded-lg overflow-x-auto text-sm font-mono border border-primary/20 glow-green">
                  {result.sql}
                </pre>
              </div>
            </Card>
          )}

          {/* Error State */}
          {!result.success && result.error && (
            <Card className="p-3 border-2 border-red-500/30 bg-red-500/10 backdrop-blur-sm">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-base text-red-400 mb-1">Query Failed</p>
                  <p className="text-foreground text-sm">{result.error}</p>
                </div>
              </div>
            </Card>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
