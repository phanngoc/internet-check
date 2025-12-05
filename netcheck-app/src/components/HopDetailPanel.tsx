import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Globe,
  Server,
  Wifi,
  AlertTriangle,
  Clock,
  Signal,
  MapPin,
  Zap,
  Activity,
} from "lucide-react";
import type { HopAnalysis } from "./types";

interface HopDetailPanelProps {
  hops: HopAnalysis[];
  onHopSelect?: (hop: HopAnalysis) => void;
  selectedHopId?: string;
}

export default function HopDetailPanel({
  hops,
  onHopSelect,
  selectedHopId,
}: HopDetailPanelProps) {
  const [expandedHops, setExpandedHops] = useState<Set<string>>(new Set());

  const toggleHop = (hopId: string) => {
    const newExpanded = new Set(expandedHops);
    if (newExpanded.has(hopId)) {
      newExpanded.delete(hopId);
    } else {
      newExpanded.add(hopId);
    }
    setExpandedHops(newExpanded);
  };

  const getStatusColor = (status: HopAnalysis["status"]) => {
    switch (status) {
      case "ok":
        return "bg-green-500";
      case "slow":
        return "bg-yellow-500";
      case "timeout":
        return "bg-orange-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBgColor = (status: HopAnalysis["status"]) => {
    switch (status) {
      case "ok":
        return "bg-green-500/10 border-green-500/30";
      case "slow":
        return "bg-yellow-500/10 border-yellow-500/30";
      case "timeout":
        return "bg-orange-500/10 border-orange-500/30";
      case "error":
        return "bg-red-500/10 border-red-500/30";
      default:
        return "bg-gray-500/10 border-gray-500/30";
    }
  };

  const getHopIcon = (hop: HopAnalysis) => {
    if (hop.hop_number === 1) {
      return <Wifi className="w-5 h-5 text-blue-400" />;
    }
    if (hop.hop_number === hops.length) {
      return <Globe className="w-5 h-5 text-green-400" />;
    }
    if (hop.status === "timeout") {
      return <AlertTriangle className="w-5 h-5 text-orange-400" />;
    }
    return <Server className="w-5 h-5 text-slate-400" />;
  };

  const formatRtt = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 100) return `${ms.toFixed(1)}ms`;
    return `${ms.toFixed(0)}ms`;
  };

  const getRttQuality = (ms: number) => {
    if (ms <= 20) return { color: "text-green-400", label: "Excellent" };
    if (ms <= 50) return { color: "text-blue-400", label: "Good" };
    if (ms <= 100) return { color: "text-yellow-400", label: "Fair" };
    if (ms <= 200) return { color: "text-orange-400", label: "Poor" };
    return { color: "text-red-400", label: "Bad" };
  };

  const getPacketLossQuality = (loss: number) => {
    if (loss === 0) return { color: "text-green-400", label: "No loss" };
    if (loss <= 1) return { color: "text-yellow-400", label: "Minor" };
    if (loss <= 5) return { color: "text-orange-400", label: "Moderate" };
    return { color: "text-red-400", label: "Severe" };
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">Hop Analysis</h3>
          <span className="text-sm text-slate-400">({hops.length} hops)</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-slate-400">OK</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-slate-400">Slow</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-slate-400">Timeout</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-slate-400">Error</span>
          </div>
        </div>
      </div>

      {/* Hop list */}
      <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {hops.map((hop) => {
          const isExpanded = expandedHops.has(hop.id);
          const isSelected = selectedHopId === hop.id;
          const rttQuality = hop.avg_rtt
            ? getRttQuality(hop.avg_rtt)
            : { color: "text-gray-400", label: "N/A" };
          const lossQuality = getPacketLossQuality(hop.packet_loss);

          return (
            <div
              key={hop.id}
              className={`border-b border-slate-800 last:border-b-0 ${
                isSelected ? "bg-cyan-500/10" : ""
              }`}
            >
              {/* Hop header row */}
              <div
                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                  isSelected ? "border-l-2 border-l-cyan-400" : ""
                }`}
                onClick={() => {
                  toggleHop(hop.id);
                  onHopSelect?.(hop);
                }}
              >
                {/* Expand/collapse button */}
                <button className="text-slate-500 hover:text-white transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {/* Hop number */}
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-mono font-semibold text-slate-300">
                  {hop.hop_number}
                </div>

                {/* Status indicator */}
                <div
                  className={`w-2 h-2 rounded-full ${getStatusColor(hop.status)}`}
                />

                {/* Icon */}
                {getHopIcon(hop)}

                {/* IP and hostname */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">
                      {hop.ip_address || "* * *"}
                    </span>
                    {hop.hostname && hop.hostname !== hop.ip_address && (
                      <span className="text-slate-400 text-sm truncate">
                        ({hop.hostname})
                      </span>
                    )}
                  </div>
                  {hop.asn && (
                    <div className="text-xs text-slate-500">
                      AS{hop.asn} • {hop.isp}
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="flex items-center gap-4 text-sm">
                  {hop.avg_rtt !== undefined && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className={rttQuality.color}>
                        {formatRtt(hop.avg_rtt)}
                      </span>
                    </div>
                  )}
                  {hop.packet_loss > 0 && (
                    <div className="flex items-center gap-1">
                      <Signal className="w-3.5 h-3.5 text-slate-500" />
                      <span className={lossQuality.color}>
                        {hop.packet_loss.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div
                  className={`px-4 py-3 ml-8 border-l-2 ${getStatusBgColor(hop.status)}`}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {/* RTT Stats */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        Round Trip Time
                      </div>
                      {hop.avg_rtt !== undefined ? (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Avg:</span>
                            <span className={rttQuality.color}>
                              {formatRtt(hop.avg_rtt)}
                            </span>
                          </div>
                          {hop.min_rtt !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Min:</span>
                              <span className="text-green-400">
                                {formatRtt(hop.min_rtt)}
                              </span>
                            </div>
                          )}
                          {hop.max_rtt !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Max:</span>
                              <span className="text-orange-400">
                                {formatRtt(hop.max_rtt)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </div>

                    {/* Packet Loss */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">
                        <Signal className="w-3.5 h-3.5" />
                        Packet Loss
                      </div>
                      <div
                        className={`text-2xl font-bold ${lossQuality.color}`}
                      >
                        {hop.packet_loss.toFixed(1)}%
                      </div>
                      <div className={`text-xs ${lossQuality.color}`}>
                        {lossQuality.label}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">
                        <MapPin className="w-3.5 h-3.5" />
                        Location
                      </div>
                      {hop.location ? (
                        <div className="text-white">{hop.location}</div>
                      ) : (
                        <span className="text-slate-500">Unknown</span>
                      )}
                    </div>

                    {/* Jitter */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">
                        <Zap className="w-3.5 h-3.5" />
                        Jitter
                      </div>
                      {hop.jitter !== undefined ? (
                        <>
                          <div
                            className={`text-2xl font-bold ${
                              hop.jitter < 5
                                ? "text-green-400"
                                : hop.jitter < 20
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }`}
                          >
                            {hop.jitter.toFixed(1)}ms
                          </div>
                          <div className="text-xs text-slate-500">
                            {hop.jitter < 5
                              ? "Stable"
                              : hop.jitter < 20
                                ? "Moderate"
                                : "Unstable"}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </div>
                  </div>

                  {/* Analysis notes */}
                  {hop.notes && hop.notes.length > 0 && (
                    <div className="mt-3 p-2 bg-slate-800/30 rounded border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">
                        Analysis Notes:
                      </div>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {hop.notes.map((note: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-cyan-400">•</span>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="text-slate-400">
              Total:{" "}
              <span className="text-white font-semibold">{hops.length}</span>{" "}
              hops
            </div>
            <div className="text-slate-400">
              Timeouts:{" "}
              <span className="text-orange-400 font-semibold">
                {hops.filter((h) => h.status === "timeout").length}
              </span>
            </div>
            <div className="text-slate-400">
              Issues:{" "}
              <span className="text-red-400 font-semibold">
                {hops.filter((h) => h.status === "error" || h.status === "slow")
                  .length}
              </span>
            </div>
          </div>
          {hops.length > 0 && hops[hops.length - 1].avg_rtt && (
            <div className="text-slate-400">
              End-to-end:{" "}
              <span className="text-cyan-400 font-semibold">
                {formatRtt(hops[hops.length - 1].avg_rtt!)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
