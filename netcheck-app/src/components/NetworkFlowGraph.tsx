import { useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Monitor,
  Server,
  Globe,
  AlertTriangle,
  Wifi,
  Cloud,
  Building2,
  Zap,
} from "lucide-react";
import type { NetworkFlowNode, FlowConnection } from "./types";

interface NetworkFlowGraphProps {
  flowNodes: NetworkFlowNode[];
  connections: FlowConnection[];
  onNodeClick?: (node: NetworkFlowNode) => void;
}

// Node data type for ReactFlow - using index signature
interface HopNodeData {
  [key: string]: unknown;
  nodeType: string;
  status: string;
  hopNumber?: number;
  label: string;
  ip?: string;
  latency?: number;
  delta?: number;
  packetLoss?: number;
  isBottleneck?: boolean;
}

// Custom node component for hops
const HopNode = ({ data }: NodeProps) => {
  const nodeData = data as HopNodeData;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
      case "success":
        return "border-green-500 bg-green-500/10";
      case "warning":
        return "border-yellow-500 bg-yellow-500/10";
      case "critical":
      case "error":
        return "border-red-500 bg-red-500/10 animate-pulse";
      default:
        return "border-gray-500 bg-gray-500/10";
    }
  };

  const getIcon = () => {
    switch (nodeData.nodeType) {
      case "client":
      case "user":
        return <Monitor className="w-5 h-5" />;
      case "local":
        return <Wifi className="w-5 h-5" />;
      case "isp":
        return <Building2 className="w-5 h-5" />;
      case "backbone":
        return <Zap className="w-5 h-5" />;
      case "cdn":
        return <Cloud className="w-5 h-5" />;
      case "destination":
      case "server":
        return <Globe className="w-5 h-5" />;
      case "bottleneck":
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 ${getStatusColor(
        nodeData.status
      )} backdrop-blur-sm min-w-[160px]`}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-500" />
      
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`p-1.5 rounded ${
            nodeData.status === "critical" || nodeData.status === "error"
              ? "bg-red-500/20 text-red-400"
              : nodeData.status === "warning"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-blue-500/20 text-blue-400"
          }`}
        >
          {getIcon()}
        </div>
        <div>
          <div className="text-xs text-gray-400 font-mono">
            {nodeData.nodeType === "client" || nodeData.nodeType === "user" ? "YOU" : nodeData.hopNumber ? `HOP ${nodeData.hopNumber}` : nodeData.nodeType?.toUpperCase()}
          </div>
          <div className="text-sm font-medium text-white truncate max-w-[120px]">
            {nodeData.label}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {nodeData.ip && (
          <div className="flex justify-between">
            <span className="text-gray-400">IP:</span>
            <span className="text-gray-200 font-mono">{nodeData.ip}</span>
          </div>
        )}
        {nodeData.latency && nodeData.latency > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">RTT:</span>
            <span
              className={`font-mono ${
                nodeData.latency > 100
                  ? "text-red-400"
                  : nodeData.latency > 50
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              {nodeData.latency.toFixed(1)}ms
            </span>
          </div>
        )}
        {nodeData.delta && nodeData.delta > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">Δ Latency:</span>
            <span
              className={`font-mono ${
                nodeData.delta > 50
                  ? "text-red-400"
                  : nodeData.delta > 20
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              +{nodeData.delta.toFixed(1)}ms
            </span>
          </div>
        )}
        {nodeData.packetLoss && nodeData.packetLoss > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">Loss:</span>
            <span className="text-red-400 font-mono">{nodeData.packetLoss}%</span>
          </div>
        )}
      </div>

      {nodeData.isBottleneck && (
        <div className="mt-2 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-300 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          BOTTLENECK
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500"
      />
    </div>
  );
};

// Custom node types
const nodeTypes = {
  hopNode: HopNode,
};

export default function NetworkFlowGraph({
  flowNodes,
}: NetworkFlowGraphProps) {
  // Build nodes and edges from flowNodes
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    flowNodes.forEach((flowNode, index) => {
      // Calculate position - horizontal flow
      const xPos = index * 220;
      const yPos = 200 + Math.sin(index * 0.5) * 50;

      // Determine status color
      let status = "good";
      if (flowNode.status === "error") {
        status = "critical";
      } else if (flowNode.status === "warning") {
        status = "warning";
      }

      nodeList.push({
        id: flowNode.id,
        type: "hopNode",
        position: { x: xPos, y: yPos },
        data: {
          label: flowNode.label,
          ip: flowNode.ip,
          latency: flowNode.latency,
          delta: flowNode.delta,
          packetLoss: flowNode.packetLoss,
          status: status,
          nodeType: flowNode.type,
          hopNumber: index,
          isBottleneck: flowNode.isBottleneck,
        },
      });

      // Add edge from previous node
      if (index > 0) {
        const prevNode = flowNodes[index - 1];
        const isBottleneck = flowNode.isBottleneck;
        const latencyDelta = flowNode.latency && prevNode.latency 
          ? flowNode.latency - prevNode.latency 
          : 0;
        
        edgeList.push({
          id: `edge-${prevNode.id}-${flowNode.id}`,
          source: prevNode.id,
          target: flowNode.id,
          type: "smoothstep",
          animated: isBottleneck || flowNode.status === "error",
          style: {
            stroke: isBottleneck || flowNode.status === "error" 
              ? "#ef4444" 
              : flowNode.status === "warning" 
                ? "#eab308" 
                : "#3b82f6",
            strokeWidth: isBottleneck ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isBottleneck ? "#ef4444" : "#3b82f6",
          },
          label: latencyDelta > 0 ? `+${latencyDelta.toFixed(0)}ms` : undefined,
          labelStyle: {
            fill: isBottleneck ? "#ef4444" : "#9ca3af",
            fontSize: 10,
          },
          labelBgStyle: {
            fill: "#1e293b",
            fillOpacity: 0.8,
          },
        });
      }
    });

    return { nodes: nodeList, edges: edgeList };
  }, [flowNodes]);

  const [nodesState, , onNodesChange] = useNodesState(nodes);
  const [edgesState, , onEdgesChange] = useEdgesState(edges);

  // Statistics
  const stats = useMemo(() => {
    const nodesWithLatency = flowNodes.filter((n) => n.latency && n.latency > 0);
    if (nodesWithLatency.length === 0) return null;

    const latencies = nodesWithLatency.map((h) => h.latency!);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    const bottleneckCount = flowNodes.filter((n) => n.isBottleneck).length;
    const totalPacketLoss = flowNodes.reduce((sum, n) => sum + (n.packetLoss || 0), 0);

    return {
      totalHops: flowNodes.length,
      avgLatency,
      maxLatency,
      minLatency,
      bottleneckCount,
      totalPacketLoss,
    };
  }, [flowNodes]);

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header with stats */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Network Path Trace</h3>
            <p className="text-xs text-gray-400">
              Visualizing network route ({flowNodes.length} nodes)
            </p>
          </div>
        </div>

        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-400 text-xs">Nodes</div>
              <div className="text-white font-mono">{stats.totalHops}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs">Avg RTT</div>
              <div className="text-white font-mono">
                {stats.avgLatency.toFixed(0)}ms
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs">Max RTT</div>
              <div
                className={`font-mono ${
                  stats.maxLatency > 200 ? "text-red-400" : "text-white"
                }`}
              >
                {stats.maxLatency.toFixed(0)}ms
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs">Bottlenecks</div>
              <div
                className={`font-mono ${
                  stats.bottleneckCount > 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {stats.bottleneckCount}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flow graph */}
      <div className="h-[400px] bg-slate-950">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls className="!bg-slate-800 !border-slate-700" />
          <MiniMap
            className="!bg-slate-800"
            nodeColor={(node) => {
              if (node.data.status === "critical") return "#ef4444";
              if (node.data.status === "warning") return "#eab308";
              return "#3b82f6";
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-slate-700/50 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-400">Good (&lt;50ms)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-400">Warning (50-100ms)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-gray-400">Bottleneck (&gt;100ms)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-500" />
          <span className="text-gray-400">Normal link</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-red-500" />
          <span className="text-gray-400">Slow link</span>
        </div>
      </div>
    </div>
  );
}
