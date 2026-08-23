"use client";

/**
 * Re-export chart primitives for next/dynamic (F04-E).
 * Keeps recharts out of the critical first-paint chunk.
 */
export {
  ActivityHeatmap,
  AgentRadarChart,
  ChartAreaInteractive,
  PlatformGrowthChart,
  ResponseHistogram,
  SentimentOverTimeChart,
  SentimentShareChart,
  StackedSentimentChart,
  TopicMixChart,
  VolumeTrendChart,
  WorkloadChart,
} from "@/components/analytics/WorkspaceCharts";
