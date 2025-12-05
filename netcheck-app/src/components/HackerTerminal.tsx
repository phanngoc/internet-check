import { useEffect, useRef, useState } from "react";
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Download,
  Copy,
  CheckCircle2,
} from "lucide-react";
import type { TraceLogEntry } from "./types";

interface HackerTerminalProps {
  logs: TraceLogEntry[];
  isRunning: boolean;
  onClear?: () => void;
}

export default function HackerTerminal({
  logs,
  isRunning,
  onClear,
}: HackerTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLevelColor = (level: TraceLogEntry["level"]) => {
    switch (level) {
      case "success":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      case "debug":
        return "text-purple-400";
      default:
        return "text-blue-400";
    }
  };

  const getLevelIcon = (level: TraceLogEntry["level"]) => {
    switch (level) {
      case "success":
        return "[✓]";
      case "warning":
        return "[!]";
      case "error":
        return "[✗]";
      case "debug":
        return "[#]";
      default:
        return "[*]";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "dns":
        return "text-blue-300";
      case "tcp":
        return "text-green-300";
      case "ssl":
        return "text-purple-300";
      case "http":
        return "text-cyan-300";
      case "trace":
        return "text-orange-300";
      case "stability":
        return "text-pink-300";
      default:
        return "text-gray-300";
    }
  };

  const copyToClipboard = () => {
    const text = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${
            log.raw_data ? `\n    ${log.raw_data}` : ""
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    const text = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${
            log.raw_data ? `\n    ${log.raw_data}` : ""
          }`
      )
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netcheck-trace-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-black rounded-xl border border-green-500/30 overflow-hidden font-mono text-sm">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <Terminal className="w-4 h-4" />
            <span>netcheck@trace</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Play className="w-3 h-3 animate-pulse" />
                RUNNING
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              autoScroll ? "text-green-400" : "text-gray-500"
            }`}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            {autoScroll ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={copyToClipboard}
            className="p-1.5 rounded hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
            title="Copy logs"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={downloadLogs}
            className="p-1.5 rounded hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="p-1.5 rounded hover:bg-slate-700 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={terminalRef}
        className="p-4 h-[300px] overflow-y-auto bg-gradient-to-b from-black to-slate-950 scrollbar-thin scrollbar-thumb-green-500/30 scrollbar-track-transparent"
      >
        {logs.length === 0 ? (
          <div className="text-green-500/50 flex items-center gap-2">
            <span className="animate-pulse">▌</span>
            Waiting for diagnostic to start...
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="flex gap-2 group">
                {/* Timestamp */}
                <span className="text-gray-600 shrink-0">{log.timestamp}</span>

                {/* Level indicator */}
                <span className={`shrink-0 ${getLevelColor(log.level)}`}>
                  {getLevelIcon(log.level)}
                </span>

                {/* Category */}
                <span
                  className={`shrink-0 ${getCategoryColor(log.category)} uppercase`}
                >
                  [{log.category.padEnd(8)}]
                </span>

                {/* Message */}
                <span className="text-gray-200">{log.message}</span>
              </div>
            ))}

            {/* Cursor */}
            {isRunning && (
              <div className="flex items-center gap-2 text-green-400">
                <span className="animate-pulse">▌</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="px-4 py-2 bg-slate-900/50 border-t border-green-500/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-gray-500">
          <span>Lines: {logs.length}</span>
          <span>|</span>
          <span
            className={`${
              logs.filter((l) => l.level === "error").length > 0
                ? "text-red-400"
                : "text-gray-500"
            }`}
          >
            Errors: {logs.filter((l) => l.level === "error").length}
          </span>
          <span>|</span>
          <span
            className={`${
              logs.filter((l) => l.level === "warning").length > 0
                ? "text-yellow-400"
                : "text-gray-500"
            }`}
          >
            Warnings: {logs.filter((l) => l.level === "warning").length}
          </span>
        </div>

        <div className="text-gray-600">
          Press Ctrl+C to stop • Auto-scroll {autoScroll ? "ON" : "OFF"}
        </div>
      </div>
    </div>
  );
}
