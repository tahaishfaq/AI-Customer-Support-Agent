"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

export function ChartSkeleton({ className }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-[var(--color-bg)]", className)}
    />
  );
}

function lazyChart(name, skeletonClass) {
  return dynamic(
    () =>
      import("@/components/analytics/charts-dynamic").then((mod) => ({
        default: mod[name],
      })),
    {
      ssr: false,
      loading: () => <ChartSkeleton className={skeletonClass} />,
    }
  );
}

/** Deferred recharts wrappers — keep first paint light (F04-E). */
export const ChartAreaInteractive = lazyChart(
  "ChartAreaInteractive",
  "h-[240px] w-full"
);
export const ActivityHeatmap = lazyChart("ActivityHeatmap", "h-[188px] w-full");
export const TopicMixChart = lazyChart("TopicMixChart", "h-[188px] w-full");
export const StackedSentimentChart = lazyChart(
  "StackedSentimentChart",
  "h-[220px] w-full"
);
export const ResponseHistogram = lazyChart(
  "ResponseHistogram",
  "h-[220px] w-full"
);
export const WorkloadChart = lazyChart("WorkloadChart", "h-[280px] w-full");
export const AgentRadarChart = lazyChart("AgentRadarChart", "h-[220px] w-full");
export const VolumeTrendChart = lazyChart("VolumeTrendChart", "h-[220px] w-full");
export const SentimentOverTimeChart = lazyChart(
  "SentimentOverTimeChart",
  "h-[220px] w-full"
);
export const SentimentShareChart = lazyChart(
  "SentimentShareChart",
  "h-[220px] w-full"
);
export const PlatformGrowthChart = lazyChart(
  "PlatformGrowthChart",
  "h-[168px] w-full"
);
export const PlatformVolumeChart = lazyChart(
  "PlatformVolumeChart",
  "h-[168px] w-full"
);
