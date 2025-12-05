import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Globe,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Network,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Terminal,
  Activity,
  Map,
  Timer,
  BarChart3,
  Crosshair,
} from "lucide-react";
import type {
  DiagnosticStep,
  DiagnosticReport,
  DiagnosticStatus,
} from "./types";
import type {
  NetworkFlowNode,
  HopAnalysis,
  WaterfallSegment,
  TraceLogEntry,
} from "./components/types";
import NetworkFlowGraph from "./components/NetworkFlowGraph";
import TimingWaterfall from "./components/TimingWaterfall";
import HopDetailPanel from "./components/HopDetailPanel";
import StabilityChart from "./components/StabilityChart";
import HackerTerminal from "./components/HackerTerminal";

// Tab types
type TabId = "overview" | "flow" | "timing" | "hops" | "stability" | "terminal";

// Status icon component
const StatusIcon = ({ status }: { status: DiagnosticStatus }) => {
  switch (status) {
    case "pending":
      return <Clock className="w-5 h-5 text-gray-400" />;
    case "running":
      return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
    case "success":
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    case "warning":
      return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    case "error":
      return <XCircle className="w-5 h-5 text-red-400" />;
  }
};

// Step item component
const DiagnosticStepItem = ({
  step,
  isExpanded,
  onToggle,
}: {
  step: DiagnosticStep;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const bgColor = {
    pending: "bg-slate-800/50",
    running: "bg-blue-900/30 border border-blue-500/30",
    success: "bg-green-900/20",
    warning: "bg-yellow-900/20",
    error: "bg-red-900/20",
  }[step.status];

  return (
    <div className={`rounded-lg ${bgColor} transition-all duration-300`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <StatusIcon status={step.status} />
          <div>
            <h3 className="font-medium text-white">{step.name}</h3>
            {step.result && (
              <p className="text-sm text-gray-400">{step.result}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {step.duration_ms !== undefined && (
            <span className="text-sm text-gray-500">
              {step.duration_ms.toFixed(0)}ms
            </span>
          )}
          {step.details && (
            isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )
          )}
        </div>
      </button>
      {isExpanded && step.details && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-gray-400 bg-slate-900/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {step.details}
          </pre>
          {step.recommendation && (
            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                💡 {step.recommendation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main App Component
function App() {
  const [url, setUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[]>([]);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<TraceLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Generate trace logs for terminal
  const addLog = useCallback((level: TraceLogEntry["level"], category: string, message: string, rawData?: string) => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs((prev) => [...prev, { timestamp, level, category, message, raw_data: rawData }]);
  }, []);

  const updateStep = useCallback(
    (
      id: string,
      updates: Partial<DiagnosticStep>
    ) => {
      setSteps((prev) =>
        prev.map((step) =>
          step.id === id ? { ...step, ...updates } : step
        )
      );
    },
    []
  );

  const toggleStepExpand = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const runDiagnostic = useCallback(async () => {
    if (!url.trim()) return;

    // Normalize URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }

    setIsRunning(true);
    setReport(null);
    setLogs([]);
    addLog("info", "system", `Bắt đầu chẩn đoán: ${targetUrl}`);

    // Initialize steps
    const initialSteps: DiagnosticStep[] = [
      { id: "dns", name: "🔍 DNS Resolution", status: "pending" },
      { id: "tcp", name: "🔌 TCP Connection", status: "pending" },
      { id: "ssl", name: "🔒 SSL/TLS Handshake", status: "pending" },
      { id: "http", name: "🌐 HTTP Response", status: "pending" },
      { id: "routing", name: "🛤️ Network Routing", status: "pending" },
      { id: "stability", name: "📊 Connection Stability", status: "pending" },
    ];
    setSteps(initialSteps);

    try {
      // Listen for diagnostic events
      const unlisten = await listen<{
        step: string;
        status: DiagnosticStatus;
        message: string;
        data?: unknown;
      }>("diagnostic-progress", (event) => {
        const { step, status, message, data } = event.payload;
        
        // Determine log level based on status
        const logLevel: TraceLogEntry["level"] = 
          status === "error" ? "error" :
          status === "warning" ? "warning" :
          status === "success" ? "success" : "info";
        
        addLog(logLevel, step, message);
        
        updateStep(step, {
          status,
          result: message,
          ...(data as Partial<DiagnosticStep>),
        });
      });

      // Run diagnostic
      const result = await invoke<DiagnosticReport>("run_diagnostic", {
        targetUrl,
      });

      unlisten();
      setReport(result);
      addLog("success", "system", "Hoàn thành chẩn đoán!");

      // Auto-expand steps with issues
      const stepsWithIssues = new Set<string>();
      result.issues.forEach((issue) => {
        stepsWithIssues.add(issue.category);
      });
      setExpandedSteps(stepsWithIssues);
    } catch (error) {
      addLog("error", "system", `Lỗi: ${error}`);
      console.error("Diagnostic error:", error);
    } finally {
      setIsRunning(false);
    }
  }, [url, addLog, updateStep]);

  const getOverallStatusBadge = () => {
    if (!report) return null;

    const colors = {
      excellent: "bg-green-500/20 text-green-400 border-green-500/30",
      good: "bg-green-500/20 text-green-400 border-green-500/30",
      acceptable: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      poor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    const labels = {
      excellent: "Xuất sắc",
      good: "Tốt",
      acceptable: "Chấp nhận được",
      poor: "Kém",
      failed: "Thất bại",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full border text-sm font-medium ${colors[report.overall_status]}`}
      >
        {labels[report.overall_status]}
      </span>
    );
  };

  // Generate flow nodes from report data
  const flowNodes = useMemo((): NetworkFlowNode[] => {
    if (!report) return [];

    const nodes: NetworkFlowNode[] = [
      {
        id: "user",
        type: "user",
        label: "Your Device",
        status: "success",
      },
      {
        id: "router",
        type: "router",
        label: "Local Router",
        status: steps.find(s => s.id === "routing")?.status === "error" ? "error" : "success",
        latency: 2,
      },
    ];

    // Add DNS node
    const dnsStep = steps.find(s => s.id === "dns");
    if (dnsStep) {
      nodes.push({
        id: "dns",
        type: "dns",
        label: "DNS Server",
        ip: report.routing?.target_ip || "8.8.8.8",
        status: dnsStep.status === "success" ? "success" : dnsStep.status === "error" ? "error" : "warning",
        latency: dnsStep.duration_ms,
      });
    }

    // Add intermediate hops (mock data for visualization)
    nodes.push({
      id: "isp",
      type: "router",
      label: "ISP Gateway",
      status: "success",
      latency: 15,
    });

    nodes.push({
      id: "cdn",
      type: "router",
      label: "CDN/Edge",
      status: "success",
      latency: 25,
    });

    // Add target server
    const tcpStep = steps.find(s => s.id === "tcp");
    nodes.push({
      id: "target",
      type: "server",
      label: report.target_url || url,
      ip: report.routing?.target_ip,
      status: tcpStep?.status === "success" ? "success" : tcpStep?.status === "error" ? "error" : "warning",
      latency: tcpStep?.duration_ms,
    });

    return nodes;
  }, [report, steps, url]);

  // Generate timing waterfall data from report.tcp
  const waterfallData = useMemo((): WaterfallSegment[] => {
    if (!report?.tcp) return [];

    const segments: WaterfallSegment[] = [];
    let currentOffset = 0;

    // DNS Resolution
    if (report.tcp.dns_time_ms > 0) {
      segments.push({
        type: "dns",
        label: "DNS Resolution",
        start_ms: currentOffset,
        duration_ms: report.tcp.dns_time_ms,
        status: report.tcp.dns_time_ms > 100 ? "warning" : "normal",
      });
      currentOffset += report.tcp.dns_time_ms;
    }

    // TCP Connect
    const tcpDuration = report.tcp.connect_time_ms - report.tcp.dns_time_ms;
    if (tcpDuration > 0) {
      segments.push({
        type: "tcp",
        label: "TCP Connect",
        start_ms: currentOffset,
        duration_ms: tcpDuration,
        status: tcpDuration > 200 ? "warning" : "normal",
      });
      currentOffset += tcpDuration;
    }

    // SSL/TLS Handshake
    const sslDuration = report.tcp.ssl_time_ms - report.tcp.connect_time_ms;
    if (sslDuration > 0) {
      segments.push({
        type: "ssl",
        label: "SSL/TLS Handshake",
        start_ms: currentOffset,
        duration_ms: sslDuration,
        status: sslDuration > 300 ? "warning" : "normal",
      });
      currentOffset += sslDuration;
    }

    // TTFB (Time to First Byte)
    const ttfbDuration = report.tcp.ttfb_ms - report.tcp.ssl_time_ms;
    if (ttfbDuration > 0) {
      segments.push({
        type: "ttfb",
        label: "Time to First Byte",
        start_ms: currentOffset,
        duration_ms: ttfbDuration,
        status: ttfbDuration > 500 ? "critical" : ttfbDuration > 200 ? "warning" : "normal",
      });
      currentOffset += ttfbDuration;
    }

    // Download (remaining time)
    const downloadDuration = report.tcp.total_time_ms - report.tcp.ttfb_ms;
    if (downloadDuration > 0) {
      segments.push({
        type: "download",
        label: "Content Download",
        start_ms: currentOffset,
        duration_ms: downloadDuration,
        status: "normal",
      });
    }

    return segments;
  }, [report]);

  // Generate hop analysis data (mock for visualization demo)
  const hopData = useMemo((): HopAnalysis[] => {
    if (!report) return [];

    return [
      {
        id: "hop-1",
        hop_number: 1,
        ip_address: "192.168.1.1",
        hostname: "router.local",
        avg_rtt: 1.2,
        min_rtt: 0.8,
        max_rtt: 2.1,
        packet_loss: 0,
        status: "ok",
        isp: "Local Network",
        location: "Local",
      },
      {
        id: "hop-2",
        hop_number: 2,
        ip_address: "10.0.0.1",
        hostname: "gateway.isp.vn",
        avg_rtt: 8.5,
        min_rtt: 6.2,
        max_rtt: 15.3,
        packet_loss: 0,
        status: "ok",
        asn: "7552",
        isp: "VNPT",
        location: "Vietnam",
      },
      {
        id: "hop-3",
        hop_number: 3,
        ip_address: "203.113.0.1",
        hostname: "core-vnpt.vn",
        avg_rtt: 25.3,
        min_rtt: 22.1,
        max_rtt: 35.7,
        packet_loss: 0,
        status: "ok",
        asn: "7552",
        isp: "VNPT",
        location: "Ho Chi Minh, VN",
      },
      {
        id: "hop-4",
        hop_number: 4,
        ip_address: null,
        status: "timeout",
        packet_loss: 100,
        notes: ["Router doesn't respond to ICMP - may be configured to drop ping"],
      },
      {
        id: "hop-5",
        hop_number: 5,
        ip_address: "72.14.209.81",
        hostname: "google-edge.net",
        avg_rtt: 45.2,
        min_rtt: 42.0,
        max_rtt: 52.8,
        packet_loss: 0,
        status: "ok",
        asn: "15169",
        isp: "Google",
        location: "Singapore",
      },
      {
        id: "hop-6",
        hop_number: 6,
        ip_address: report.routing?.target_ip || "13.213.164.176",
        hostname: report.target_url || "target.com",
        avg_rtt: 55.8,
        min_rtt: 50.2,
        max_rtt: 68.4,
        packet_loss: 0,
        status: "ok",
        asn: "16509",
        isp: "Amazon",
        location: "Singapore",
      },
    ];
  }, [report]);

  // Generate stability data (mock for demo)
  const stabilityData = useMemo(() => {
    if (!report) return [];

    return Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(Date.now() - (20 - i) * 1000).toISOString(),
      latency: 45 + Math.random() * 30 + (i > 15 ? Math.random() * 20 : 0),
      success: Math.random() > 0.05,
      requestNumber: i + 1,
    }));
  }, [report]);

  // Tabs configuration
  const tabs = [
    { id: "overview" as const, label: "Tổng quan", icon: Shield },
    { id: "flow" as const, label: "Network Flow", icon: Map },
    { id: "timing" as const, label: "Timing", icon: Timer },
    { id: "hops" as const, label: "Hop Analysis", icon: Crosshair },
    { id: "stability" as const, label: "Stability", icon: BarChart3 },
    { id: "terminal" as const, label: "Terminal", icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg border border-cyan-500/30">
                <Network className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">NetCheck</h1>
                <p className="text-sm text-gray-400">
                  Network Diagnostic Tool • White-hat Edition
                </p>
              </div>
            </div>
            {report && getOverallStatusBadge()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* URL Input */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nhập URL hoặc tên miền cần kiểm tra
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runDiagnostic()}
                placeholder="ví dụ: slack.com, claude.ai, github.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 font-mono"
                disabled={isRunning}
              />
            </div>
            <button
              onClick={runDiagnostic}
              disabled={isRunning || !url.trim()}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed rounded-lg font-medium text-white flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Diagnose
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        {steps.length > 0 && (
          <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30"
                      : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : ""}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Content */}
        {steps.length > 0 && (
          <div className="min-h-[500px]">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Diagnostic Steps */}
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    Quá trình chẩn đoán
                  </h2>

                  <div className="space-y-2">
                    {steps.map((step) => (
                      <DiagnosticStepItem
                        key={step.id}
                        step={step}
                        isExpanded={expandedSteps.has(step.id)}
                        onToggle={() => toggleStepExpand(step.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Issues and Recommendations */}
                {report && report.issues.length > 0 && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      Vấn đề phát hiện được ({report.issues.length})
                    </h2>

                    <div className="space-y-4">
                      {report.issues.map((issue, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${
                            issue.severity === "error"
                              ? "bg-red-900/20 border-red-500/30"
                              : issue.severity === "warning"
                              ? "bg-yellow-900/20 border-yellow-500/30"
                              : "bg-blue-900/20 border-blue-500/30"
                          }`}
                        >
                          <h3 className="font-medium text-white mb-2">{issue.title}</h3>
                          <p className="text-sm text-gray-300 mb-3">
                            {issue.description}
                          </p>

                          {issue.possible_causes.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-400 uppercase mb-1">
                                Nguyên nhân có thể:
                              </p>
                              <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                                {issue.possible_causes.map((cause, i) => (
                                  <li key={i}>{cause}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {issue.solutions.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-400 uppercase mb-1">
                                Giải pháp:
                              </p>
                              <ul className="text-sm text-green-300 list-disc list-inside space-y-1">
                                {issue.solutions.map((solution, i) => (
                                  <li key={i}>{solution}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations Summary */}
                {report && report.recommendations.length > 0 && (
                  <div className="bg-gradient-to-br from-cyan-900/30 to-purple-900/20 rounded-xl p-4 border border-cyan-500/30">
                    <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      💡 Khuyến nghị tổng quan
                    </h2>
                    <ul className="space-y-2">
                      {report.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <span className="text-cyan-400 mt-1">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Network Flow Tab */}
            {activeTab === "flow" && (
              <NetworkFlowGraph
                flowNodes={flowNodes}
                connections={[]}
                onNodeClick={(node: NetworkFlowNode) => console.log("Node clicked:", node)}
              />
            )}

            {/* Timing Tab */}
            {activeTab === "timing" && (
              <TimingWaterfall
                segments={waterfallData}
                title="Request Timing Breakdown"
              />
            )}

            {/* Hop Analysis Tab */}
            {activeTab === "hops" && (
              <HopDetailPanel
                hops={hopData}
                onHopSelect={(hop) => console.log("Hop selected:", hop)}
              />
            )}

            {/* Stability Tab */}
            {activeTab === "stability" && (
              <StabilityChart
                data={stabilityData}
                title="Connection Stability Analysis"
              />
            )}

            {/* Terminal Tab */}
            {activeTab === "terminal" && (
              <HackerTerminal
                logs={logs}
                isRunning={isRunning}
                onClear={() => setLogs([])}
              />
            )}
          </div>
        )}

        {/* Empty State */}
        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-slate-800/50 rounded-full mb-4">
              <Activity className="w-12 h-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Sẵn sàng chẩn đoán
            </h3>
            <p className="text-gray-400 max-w-md">
              Nhập URL hoặc tên miền vào ô trên và nhấn "Diagnose" để bắt đầu phân tích network.
              Công cụ sẽ chạy song song nhiều kiểm tra để tìm ra vấn đề.
            </p>
          </div>
        )}

        {/* Quick Actions */}
        {!isRunning && steps.length > 0 && (
          <div className="flex justify-center gap-4">
            <button
              onClick={runDiagnostic}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-sm text-gray-300 flex items-center gap-2 transition-colors border border-slate-600/50"
            >
              <RefreshCw className="w-4 h-4" />
              Kiểm tra lại
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          NetCheck v1.0 - Parallel Network Diagnostic Tool • Built with Tauri + React
        </div>
      </footer>
    </div>
  );
}

export default App;
