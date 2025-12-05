import { useMemo } from "react";
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface StabilityDataPoint {
  timestamp: string;
  latency: number;
  success: boolean;
  requestNumber: number;
}

interface StabilityChartProps {
  data: StabilityDataPoint[];
  title?: string;
}

export default function StabilityChart({ data, title = "Connection Stability" }: StabilityChartProps) {
  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const successfulRequests = data.filter(d => d.success);
    const latencies = successfulRequests.map(d => d.latency);
    
    if (latencies.length === 0) return null;

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const variance = latencies.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);
    const successRate = (successfulRequests.length / data.length) * 100;
    
    // Calculate jitter (average difference between consecutive measurements)
    let jitterSum = 0;
    for (let i = 1; i < latencies.length; i++) {
      jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    const jitter = latencies.length > 1 ? jitterSum / (latencies.length - 1) : 0;

    // Determine trend
    const recentAvg = latencies.slice(-Math.ceil(latencies.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(latencies.length / 3);
    const oldAvg = latencies.slice(0, Math.ceil(latencies.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(latencies.length / 3);
    const trend = recentAvg > oldAvg * 1.1 ? 'degrading' : recentAvg < oldAvg * 0.9 ? 'improving' : 'stable';

    return {
      avg,
      min,
      max,
      stdDev,
      jitter,
      successRate,
      trend,
      totalRequests: data.length,
      failedRequests: data.length - successfulRequests.length
    };
  }, [data]);

  const chartHeight = 200;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const { points, gridLines } = useMemo(() => {
    if (data.length === 0) return { points: [], gridLines: [] };

    const successfulData = data.filter(d => d.success);
    if (successfulData.length === 0) return { points: [], gridLines: [] };

    const latencies = successfulData.map(d => d.latency);
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    const range = maxLatency - minLatency;
    
    // Add 10% padding to y-axis
    const yMin = Math.max(0, minLatency - range * 0.1);
    const yMax = maxLatency + range * 0.1;

    const xScaleValue = graphWidth / (data.length - 1 || 1);

    const pts = data.map((d, i) => ({
      x: padding.left + i * xScaleValue,
      y: d.success 
        ? padding.top + graphHeight - ((d.latency - yMin) / (yMax - yMin)) * graphHeight
        : null,
      success: d.success,
      latency: d.latency,
      requestNumber: d.requestNumber
    }));

    // Generate grid lines
    const numGridLines = 5;
    const gridLines = Array.from({ length: numGridLines }, (_, i) => {
      const value = yMin + ((yMax - yMin) * i) / (numGridLines - 1);
      const y = padding.top + graphHeight - (i / (numGridLines - 1)) * graphHeight;
      return { value, y };
    });

    return { 
      points: pts, 
      gridLines
    };
  }, [data, graphWidth, graphHeight, padding]);

  // Generate path for the line
  const linePath = useMemo(() => {
    const validPoints = points.filter(p => p.success && p.y !== null);
    if (validPoints.length < 2) return '';

    return validPoints.reduce((path, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      return `${path} L ${point.x} ${point.y}`;
    }, '');
  }, [points]);

  // Generate area path
  const areaPath = useMemo(() => {
    if (!linePath) return '';
    const validPoints = points.filter(p => p.success && p.y !== null);
    if (validPoints.length < 2) return '';

    const baseline = padding.top + graphHeight;
    return `${linePath} L ${validPoints[validPoints.length - 1].x} ${baseline} L ${validPoints[0].x} ${baseline} Z`;
  }, [linePath, points, graphHeight, padding]);

  const getStabilityGrade = () => {
    if (!stats) return { grade: 'N/A', color: 'text-gray-400', bgColor: 'bg-gray-500/20' };
    
    const score = (stats.successRate * 0.4) + 
                  (Math.max(0, 100 - stats.jitter) * 0.3) + 
                  (Math.max(0, 100 - stats.stdDev) * 0.3);
    
    if (score >= 90) return { grade: 'A+', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (score >= 80) return { grade: 'A', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    if (score >= 50) return { grade: 'D', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
    return { grade: 'F', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };

  const stabilityGrade = getStabilityGrade();

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
        {stats && (
          <div className={`px-3 py-1 rounded-full ${stabilityGrade.bgColor} ${stabilityGrade.color} font-bold`}>
            Grade: {stabilityGrade.grade}
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="p-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-slate-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No stability data available</p>
              <p className="text-sm">Run a diagnostic to collect data</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <svg width={chartWidth} height={chartHeight} className="w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              {/* Grid lines */}
              <g className="grid-lines">
                {gridLines.map((line, i) => (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={line.y}
                      x2={chartWidth - padding.right}
                      y2={line.y}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={line.y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-xs"
                    >
                      {line.value.toFixed(0)}ms
                    </text>
                  </g>
                ))}
              </g>

              {/* Area fill */}
              {areaPath && (
                <path
                  d={areaPath}
                  fill="url(#areaGradient)"
                  opacity="0.3"
                />
              )}

              {/* Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((point, i) => (
                point.success && point.y !== null ? (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    className="fill-cyan-400 hover:fill-cyan-300 cursor-pointer transition-colors"
                  >
                    <title>Request #{point.requestNumber}: {point.latency.toFixed(1)}ms</title>
                  </circle>
                ) : (
                  <g key={i}>
                    <line
                      x1={point.x}
                      y1={padding.top}
                      x2={point.x}
                      y2={padding.top + graphHeight}
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.5"
                    />
                    <circle
                      cx={point.x}
                      cy={padding.top + graphHeight / 2}
                      r="4"
                      className="fill-red-500"
                    >
                      <title>Request #{point.requestNumber}: Failed</title>
                    </circle>
                  </g>
                )
              ))}

              {/* Gradients */}
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* X-axis label */}
            <div className="flex justify-between text-xs text-slate-500 mt-1 px-12">
              <span>Request #1</span>
              <span>Request #{data.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Average Latency */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Avg Latency</div>
              <div className="text-xl font-bold text-cyan-400">{stats.avg.toFixed(1)}ms</div>
            </div>

            {/* Min/Max */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Min / Max</div>
              <div className="text-sm">
                <span className="text-green-400">{stats.min.toFixed(1)}ms</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-orange-400">{stats.max.toFixed(1)}ms</span>
              </div>
            </div>

            {/* Jitter */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Jitter</div>
              <div className={`text-xl font-bold ${stats.jitter < 10 ? 'text-green-400' : stats.jitter < 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.jitter.toFixed(1)}ms
              </div>
            </div>

            {/* Std Deviation */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Std Dev</div>
              <div className={`text-xl font-bold ${stats.stdDev < 20 ? 'text-green-400' : stats.stdDev < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                ±{stats.stdDev.toFixed(1)}ms
              </div>
            </div>

            {/* Success Rate */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Success Rate</div>
              <div className="flex items-center gap-2">
                {stats.successRate === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                )}
                <span className={`text-xl font-bold ${stats.successRate === 100 ? 'text-green-400' : stats.successRate >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {stats.successRate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Trend */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Trend</div>
              <div className="flex items-center gap-2">
                {stats.trend === 'improving' ? (
                  <>
                    <TrendingDown className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-semibold">Improving</span>
                  </>
                ) : stats.trend === 'degrading' ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-semibold">Degrading</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-400 font-semibold">Stable</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
