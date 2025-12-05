import { useMemo, useState } from "react";
import {
  Clock,
  Globe,
  Lock,
  Zap,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Timer,
} from "lucide-react";
import type { WaterfallSegment } from "./types";

interface TimingWaterfallProps {
  segments: WaterfallSegment[];
  title?: string;
}

interface TimingBar {
  name: string;
  label: string;
  start: number;
  duration: number;
  color: string;
  icon: React.ReactNode;
  status: "normal" | "warning" | "critical";
  description: string;
}

export default function TimingWaterfall({
  segments,
  title = "Request Timing Breakdown",
}: TimingWaterfallProps) {
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);

  const timings = useMemo(() => {
    if (!segments || segments.length === 0) return null;

    const getIcon = (type: string) => {
      switch (type) {
        case "dns":
          return <Globe className="w-4 h-4" />;
        case "tcp":
          return <Zap className="w-4 h-4" />;
        case "ssl":
          return <Lock className="w-4 h-4" />;
        case "ttfb":
        case "http":
          return <Clock className="w-4 h-4" />;
        case "download":
          return <Download className="w-4 h-4" />;
        default:
          return <Timer className="w-4 h-4" />;
      }
    };

    const getColor = (type: string, status: string) => {
      if (status === "critical") return "bg-red-500";
      if (status === "warning") return "bg-yellow-500";
      
      switch (type) {
        case "dns":
          return "bg-blue-500";
        case "tcp":
          return "bg-green-500";
        case "ssl":
          return "bg-purple-500";
        case "ttfb":
        case "http":
          return "bg-orange-500";
        case "download":
          return "bg-cyan-500";
        default:
          return "bg-gray-500";
      }
    };

    const getDescription = (type: string) => {
      switch (type) {
        case "dns":
          return "Phân giải domain → IP address";
        case "tcp":
          return "Thiết lập kết nối TCP (3-way handshake)";
        case "ssl":
          return "Thiết lập mã hóa SSL/TLS";
        case "ttfb":
        case "http":
          return "Thời gian chờ phản hồi từ server";
        case "download":
          return "Tải nội dung response";
        default:
          return "Other processing time";
      }
    };

    const bars: TimingBar[] = segments.map((segment) => ({
      name: segment.type,
      label: segment.label,
      start: segment.start_ms,
      duration: segment.duration_ms,
      color: getColor(segment.type, segment.status),
      icon: getIcon(segment.type),
      status: segment.status,
      description: segment.details?.description || getDescription(segment.type),
    }));

    const totalTime = segments.reduce((sum, s) => sum + s.duration_ms, 0);

    return { bars, totalTime };
  }, [segments]);

  if (!timings || timings.bars.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-8 text-center">
        <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No timing data available</p>
      </div>
    );
  }

  const { bars, totalTime } = timings;
  const getWidth = (duration: number) => `${(duration / totalTime) * 100}%`;
  const getLeft = (start: number) => `${(start / totalTime) * 100}%`;

  // Find the slowest segment
  const slowestSegment = bars.reduce((prev, curr) =>
    curr.duration > prev.duration ? curr : prev
  );

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-xs text-gray-400">
                Tổng thời gian: {totalTime.toFixed(0)}ms
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Slowest Phase</div>
            <div className="text-sm font-medium text-red-400">
              {slowestSegment.label}: {slowestSegment.duration.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Waterfall chart */}
        <div className="relative h-8 bg-slate-800 rounded overflow-hidden">
          {bars.map((timing) => (
            <div
              key={timing.name}
              className={`absolute h-full ${timing.color} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
              style={{
                left: getLeft(timing.start),
                width: getWidth(timing.duration),
              }}
              title={`${timing.label}: ${timing.duration.toFixed(1)}ms`}
            />
          ))}
          {/* Time markers */}
          <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
            <span className="text-xs text-white/70">0ms</span>
            <span className="text-xs text-white/70">
              {totalTime.toFixed(0)}ms
            </span>
          </div>
        </div>

        {/* Detailed breakdown */}
        <div className="space-y-2">
          {bars.map((timing) => {
            const isExpanded = expandedSegment === timing.name;
            
            return (
              <div
                key={timing.name}
                className={`rounded-lg border transition-all ${
                  timing.status === "critical"
                    ? "bg-red-500/10 border-red-500/30"
                    : timing.status === "warning"
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : "bg-slate-800/50 border-slate-700/50"
                }`}
              >
                <button
                  onClick={() => setExpandedSegment(isExpanded ? null : timing.name)}
                  className="w-full p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <div className={`p-1.5 rounded ${timing.color} bg-opacity-20`}>
                      {timing.icon}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {timing.label}
                        </span>
                        {timing.status === "critical" && (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                        {timing.status === "normal" && (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-mono text-lg ${
                        timing.status === "critical"
                          ? "text-red-400"
                          : timing.status === "warning"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {timing.duration.toFixed(0)}ms
                    </div>
                    <div className="text-xs text-gray-500">
                      {((timing.duration / totalTime) * 100).toFixed(0)}% of total
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-700/30">
                    <div className="pt-3 text-sm text-gray-400">
                      {timing.description}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${timing.color} transition-all duration-500`}
                        style={{
                          width: `${Math.min((timing.duration / 500) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-700/50">
          {bars.slice(0, 3).map((bar) => (
            <div key={bar.name} className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-mono text-white">
                {bar.duration.toFixed(0)}
                <span className="text-sm text-gray-400">ms</span>
              </div>
              <div className="text-xs text-gray-400">{bar.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
