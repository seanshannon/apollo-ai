
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table as TableIcon, MapPin, Lightbulb, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Dynamically import HeatMap with SSR disabled
const HeatMap = dynamic(
  () => import('./heat-map').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="relative w-full h-[600px] rounded-lg overflow-hidden border-2 border-primary/40 shadow-xl bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-sm text-primary font-semibold">Loading Map...</p>
        </div>
      </div>
    ),
  }
);

interface DataVisualizationProps {
  data: any[];
  query?: string;
  onGenerateAnswer?: () => void;
  isGeneratingAnswer?: boolean;
  naturalLanguageAnswer?: string;
}

type ChartType = 'answer' | 'table' | 'bar' | 'line' | 'pie' | 'map';

const COLORS = ['#00ff00', '#00cc00', '#00aa00', '#008800', '#00ff88', '#00ffcc'];

export function DataVisualization({ data, query, onGenerateAnswer, isGeneratingAnswer = false, naturalLanguageAnswer }: DataVisualizationProps) {
  // Auto-detect if query contains "map" and we have location data
  const hasLocationData = useMemo(() => {
    if (!data || data.length === 0) return false;
    const firstRow = data[0];
    return !!(firstRow && (
      ('latitude' in firstRow && 'longitude' in firstRow) ||
      ('lat' in firstRow && ('lon' in firstRow || 'lng' in firstRow))
    ));
  }, [data]);

  const shouldShowMap = query && query.toLowerCase().includes('map') && hasLocationData;
  const [chartType, setChartType] = useState<ChartType>('answer');
  const [customerMapData, setCustomerMapData] = useState<any[]>([]);
  const [isLoadingMapData, setIsLoadingMapData] = useState(false);
  const dataIdRef = useRef<string>('');

  // Extract next steps from data (look for [NEXT_STEPS] markers in descriptions)
  const nextSteps = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const steps: string[] = [];
    data.forEach(row => {
      // Check all string fields for NEXT_STEPS markers
      Object.values(row).forEach(value => {
        if (typeof value === 'string' && value.includes('[NEXT_STEPS]:')) {
          const match = value.match(/\[NEXT_STEPS\]:\s*(.+)/);
          if (match && match[1]) {
            const step = match[1].trim();
            if (!steps.includes(step)) {
              steps.push(step);
            }
          }
        }
      });
    });
    
    return steps;
  }, [data]);

  // Check if data has geographic coordinates
  const hasGeoData = useMemo(() => {
    if (!data || data.length === 0) return false;
    
    const sampleRow = data[0];
    const hasLatLon = (
      ('latitude' in sampleRow && 'longitude' in sampleRow) ||
      ('lat' in sampleRow && 'lon' in sampleRow) ||
      ('lat' in sampleRow && 'lng' in sampleRow)
    );
    
    if (!hasLatLon) return false;
    
    const hasValidCoords = data.some(row => {
      const lat = row.latitude || row.lat;
      const lon = row.longitude || row.lon || row.lng;
      return lat != null && lon != null && !isNaN(lat) && !isNaN(lon);
    });
    
    return hasLatLon && hasValidCoords;
  }, [data]);
  
  // Map view is always available - we'll fetch customer locations if needed
  const canShowMap = true;

  // Auto-select appropriate view when NEW data arrives
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // Create a unique ID for this data set (using first 100 chars to avoid long strings)
    const dataSnapshot = JSON.stringify(data[0]).substring(0, 100) + data.length;
    
    // Only auto-select if this is a completely different dataset
    if (dataSnapshot !== dataIdRef.current) {
      dataIdRef.current = dataSnapshot;
      
      // Clear cached customer map data for new queries
      setCustomerMapData([]);
      
      // PRIORITY 1: Check if query contains "map" and we have location data - show map first
      if (shouldShowMap) {
        setChartType('map');
      }
      // PRIORITY 2: Otherwise start with answer view for new queries - summary comes first
      else {
        setChartType('answer');
      }
      
      // Auto-trigger answer generation if the callback is provided
      if (onGenerateAnswer && !isGeneratingAnswer && !naturalLanguageAnswer) {
        // Small delay to ensure UI is ready
        setTimeout(() => {
          onGenerateAnswer();
        }, 100);
      }
    }
  }, [data, shouldShowMap]); // Depend on both data and shouldShowMap

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const numericColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return columns.filter((col) => {
      // Check if at least 80% of values are numeric
      const numericCount = data.filter((row) => {
        const value = row[col];
        return value !== null && value !== undefined && !isNaN(parseFloat(String(value)));
      }).length;
      return numericCount >= data.length * 0.8;
    });
  }, [data, columns]);

  const categoryColumn = useMemo(() => {
    if (!data || data.length === 0) return null;
    // Find the first non-numeric column to use as category
    return columns.find((col) => !numericColumns.includes(col));
  }, [data, columns, numericColumns]);

  const chartData = useMemo(() => {
    if (!categoryColumn || numericColumns.length === 0) return [];

    // Limit to first 30 rows for better chart readability
    const dataToChart = data.slice(0, 30);
    
    return dataToChart.map((row) => {
      const item: any = { name: String(row[categoryColumn]) };
      numericColumns.forEach((col) => {
        item[col] = parseFloat(row[col]) || 0;
      });
      return item;
    });
  }, [data, categoryColumn, numericColumns]);

  const canShowChart = chartData.length > 0 && numericColumns.length > 0;

  const getDisabledReason = (type: ChartType): string | null => {
    if (type === 'table') return null;
    if (type === 'map') {
      return null; // Map is always available - will fetch customer data if needed
    }
    if (!canShowChart) {
      return 'Charts require data with both categories and numeric values';
    }
    if (type === 'pie' && numericColumns.length !== 1) {
      return 'Pie chart requires exactly one numeric column';
    }
    return null;
  };

  // Fetch customer location data for map view
  const fetchCustomerMapData = async () => {
    setIsLoadingMapData(true);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'show me all customers with their city, state, country, latitude and longitude',
          databaseId: 'sales',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer locations');
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
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'completed' && parsed.result.status === 'success') {
                setCustomerMapData(parsed.result.data);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching customer map data:', error);
    } finally {
      setIsLoadingMapData(false);
    }
  };

  const chartButtons = [
    { type: 'answer' as ChartType, icon: Sparkles, label: 'Answer', disabled: false },
    { type: 'table' as ChartType, icon: TableIcon, label: 'Table', disabled: false },
    { type: 'bar' as ChartType, icon: BarChart3, label: 'Bar Chart', disabled: !canShowChart },
    { type: 'line' as ChartType, icon: LineChartIcon, label: 'Line Chart', disabled: !canShowChart },
    { type: 'pie' as ChartType, icon: PieChartIcon, label: 'Pie Chart', disabled: !canShowChart || numericColumns.length !== 1 },
    { type: 'map' as ChartType, icon: MapPin, label: 'Map View', disabled: false }, // Always available
  ];

  const renderChart = () => {
    if (!canShowChart && chartType !== 'table' && chartType !== 'map' && chartType !== 'answer') {
      return (
        <div className="flex items-center justify-center py-12 px-4">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto glow-green">
              <BarChart3 className="w-8 h-8 text-green" />
            </div>
            <p className="text-lg font-medium text-foreground">
              Chart not available for this data
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Charts require numeric data with categorical labels. Try the table view instead.
            </p>
          </div>
        </div>
      );
    }

    switch (chartType) {
      case 'answer':
        if (isGeneratingAnswer) {
          return (
            <div className="flex items-center justify-center py-12 px-4">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto glow-green animate-pulse">
                  <Loader2 className="w-8 h-8 text-green animate-spin" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  Generating natural language answer...
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Our AI is analyzing your results to provide a clear summary
                </p>
              </div>
            </div>
          );
        }
        
        if (!naturalLanguageAnswer) {
          return (
            <div className="flex items-center justify-center py-12 px-4">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto glow-green">
                  <Sparkles className="w-8 h-8 text-green" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  Generating answer...
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Please wait while we create a summary of your results
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/50 rounded-lg glow-green">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center glow-green">
                  <Sparkles className="w-6 h-6 text-green" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-xl font-bold text-green text-glow">Summary</h3>
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground text-base leading-relaxed whitespace-pre-line">
                    {naturalLanguageAnswer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'bar':
        return (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#282828" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#404040"
              />
              <YAxis 
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#404040"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f0f0f',
                  border: '2px solid #00ff00',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                  color: '#ffffff',
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px', color: '#ffffff' }}
                iconType="circle"
              />
              {numericColumns.map((col, idx) => (
                <Bar
                  key={col}
                  dataKey={col}
                  fill={COLORS[idx % COLORS.length]}
                  radius={[8, 8, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          </div>
        );

      case 'line':
        return (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#282828" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#404040"
              />
              <YAxis 
                tick={{ fill: '#a3a3a3', fontSize: 12 }}
                stroke="#404040"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f0f0f',
                  border: '2px solid #00ff00',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                  color: '#ffffff',
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px', color: '#ffffff' }}
                iconType="circle"
              />
              {numericColumns.map((col, idx) => (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={3}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          </div>
        );

      case 'pie':
        const CustomPieTooltip = ({ active, payload }: any) => {
          if (active && payload && payload.length) {
            const data = payload[0];
            return (
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  border: '2px solid #00ff00',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  boxShadow: '0 0 20px rgba(0, 255, 0, 0.5)',
                }}
              >
                <p style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
                  {data.name}
                </p>
                <p style={{ color: '#ffffff', fontSize: '13px' }}>
                  <span style={{ color: '#cccccc' }}>Value: </span>
                  <span style={{ fontWeight: 'bold' }}>{typeof data.value === 'number' ? data.value.toLocaleString() : data.value}</span>
                </p>
                <p style={{ color: '#ffffff', fontSize: '13px' }}>
                  <span style={{ color: '#cccccc' }}>Percentage: </span>
                  <span style={{ fontWeight: 'bold' }}>{data.percent ? `${(data.percent * 100).toFixed(1)}%` : 'N/A'}</span>
                </p>
              </div>
            );
          }
          return null;
        };

        return (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }: any) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={120}
                fill="#8884d8"
                dataKey={numericColumns[0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ color: '#ffffff' }} />
            </PieChart>
          </ResponsiveContainer>
          </div>
        );

      case 'map':
        if (!hasGeoData) {
          // If no geo data in current results, fetch customer locations
          if (customerMapData.length === 0 && !isLoadingMapData) {
            // Trigger fetch
            fetchCustomerMapData();
          }
          
          if (isLoadingMapData) {
            return (
              <div className="flex items-center justify-center py-12 px-4">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto glow-green animate-pulse">
                    <MapPin className="w-8 h-8 text-green" />
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    Loading customer locations...
                  </p>
                </div>
              </div>
            );
          }
          
          if (customerMapData.length > 0) {
            return <HeatMap key={`customer-map-${customerMapData.length}`} data={customerMapData} />;
          }
          
          return (
            <div className="flex items-center justify-center py-12 px-4">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto glow-green">
                  <MapPin className="w-8 h-8 text-green" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  No geographic data available
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Unable to load location data for mapping.
                </p>
              </div>
            </div>
          );
        }
        return <HeatMap key={`data-map-${data.length}`} data={data} />;

      case 'table':
      default:
        return (
          <div className="border-2 border-border rounded-lg overflow-hidden glow-green">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="font-bold text-green text-sm uppercase tracking-wide">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-border">
                      {columns.map((col) => (
                        <TableCell key={col} className="font-medium text-foreground">
                          {row[col] !== null && row[col] !== undefined
                            ? String(row[col])
                            : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
    }
  };

  if (!data || data.length === 0) {
    return (
      <Card className="p-12 text-center border-2 border-dashed border-border">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center glow-green">
            <TableIcon className="w-8 h-8 text-green" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">No data to display</p>
            <p className="text-sm text-muted-foreground">
              Your query returned no results
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Extract issue summary for login/support queries
  const issueSummary = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const issues: Array<{name: string, issue: string, resolution: string}> = [];
    
    data.forEach(row => {
      const resolution = row.resolution || row.RESOLUTION || '';
      const subject = row.subject || row.SUBJECT || '';
      const status = row.status || row.STATUS || '';
      
      // Try to extract name from various fields
      const nameFields = ['name', 'NAME', 'customer_name', 'user_name', 'username'];
      let name = '';
      for (const field of nameFields) {
        if (row[field]) {
          name = row[field];
          break;
        }
      }
      
      if (resolution || subject) {
        issues.push({
          name: name || 'User',
          issue: subject || 'Login Issue',
          resolution: resolution || 'No resolution provided'
        });
      }
    });
    
    return issues.length > 0 ? issues : null;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Issue Summary for Login/Support Queries */}
      {issueSummary && issueSummary.length > 0 && (
        <Alert className="bg-primary/10 border-2 border-primary/50 shadow-lg">
          <div className="space-y-4">
            <div className="font-semibold text-lg text-foreground flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-primary" />
              Issues Found ({issueSummary.length})
            </div>
            <div className="space-y-3">
              {issueSummary.map((issue, idx) => (
                <div key={idx} className="bg-background/50 rounded-lg p-4 border border-border/50">
                  <div className="space-y-2">
                    {issue.name !== 'User' && (
                      <div className="font-semibold text-foreground">
                        {issue.name}
                      </div>
                    )}
                    <div className="text-sm text-foreground/90">
                      <span className="font-medium text-primary">Issue:</span> {issue.issue}
                    </div>
                    <div className="text-sm text-foreground/90">
                      <span className="font-medium text-primary">Resolution:</span> {issue.resolution.replace(/\[NEXT_STEPS\]:.*/, '').trim()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Alert>
      )}

      {/* Chart Type Selector */}
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          {chartButtons.map((btn) => {
            const Icon = btn.icon;
            const disabledReason = getDisabledReason(btn.type);
            
            const button = (
              <Button
                key={btn.type}
                variant={chartType === btn.type ? 'default' : 'outline'}
                onClick={() => {
                  if (!btn.disabled) {
                    setChartType(btn.type);
                  }
                }}
                disabled={btn.disabled}
                className={`gap-2 transition-all ${
                  chartType === btn.type
                    ? 'bg-primary text-primary-foreground hover-glow'
                    : btn.disabled
                    ? 'border-2 border-border/30 opacity-40 cursor-not-allowed'
                    : 'border-2 border-border hover:border-primary hover-glow cursor-pointer'
                }`}
              >
                <Icon className="w-4 h-4" />
                {btn.label}
              </Button>
            );

            if (disabledReason) {
              return (
                <UITooltip key={btn.type}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-popover border-2 border-primary/50 text-sm">
                    <p>{disabledReason}</p>
                  </TooltipContent>
                </UITooltip>
              );
            }

            return button;
          })}
        </div>
      </TooltipProvider>

      {/* Chart Display */}
      <div className="bg-card/50 backdrop-blur-sm rounded-lg p-6">
        {renderChart()}
      </div>

      {/* Next Steps Section */}
      {nextSteps.length > 0 && (
        <Alert className="bg-primary/10 border-2 border-primary/50 shadow-lg">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1 space-y-3">
              <div className="font-semibold text-lg text-foreground flex items-center gap-2">
                Recommended Next Steps
              </div>
              <AlertDescription>
                <ul className="space-y-2">
                  {nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-foreground">
                      <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
}
