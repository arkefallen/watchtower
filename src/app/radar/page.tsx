// src/app/radar/page.tsx
"use client";

import React from "react";
import { trpc } from "@/lib/trpc/client";
import { MovementFeed } from "@/components/radar/MovementFeed";
import { MovementGroupCard } from "@/components/radar/MovementGroupCard";
import { RadarToolbar } from "@/components/radar/RadarToolbar";

export default function RadarPage() {
  const [timeWindow, setTimeWindow] = React.useState(24);
  const [streaming, setStreaming] = React.useState(false);

  const feedQuery = trpc.radar.feed.useQuery(
    { timeWindowHours: timeWindow },
    { enabled: true, refetchInterval: streaming ? 10000 : false }
  );

  const groupsQuery = trpc.radar.group.useQuery(
    { timeWindowHours: timeWindow },
    { enabled: true }
  );

  const handleRefresh = () => {
    trpc.radar.evaluate.useMutation().mutate({ timeWindowHours: timeWindow });
  };

  // Transform raw feed records into the shape expected by MovementFeed
  const movements = (feedQuery.data?.data ?? []).map((ev) => ({
    id: ev.id.toString(),
    timestamp: ev.timestamp as string | Date,
    fromAddress: ev.transaction?.fromAddress ?? "",
    toAddress: ev.transaction?.toAddress ?? "",
    chain: ev.transaction?.chain ?? "",
    kind: ev.kind as string,
    amountUsd: Number(ev.amountUsd ?? 0),
    blockNumber: ev.blockNumber?.toString() ?? "0",
  }));

  return (
    <div className="p-4 space-y-4">
      <RadarToolbar
        timeWindow={timeWindow}
        onTimeWindowChange={setTimeWindow}
        streaming={streaming}
        onStreamingToggle={setStreaming}
        onRefresh={handleRefresh}
      />
      <MovementFeed data={movements} isLoading={feedQuery.isLoading} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {groupsQuery.data?.map((group) => (
          <MovementGroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
