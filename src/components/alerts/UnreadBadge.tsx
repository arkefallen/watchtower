"use client";

import React from "react";
import { trpc } from "@/lib/trpc/client";

export function UnreadBadge() {
  const { data } = trpc.alert.unreadCount.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const count = data?.count ?? 0;
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} unread alerts`}
      className="px-1.5 py-0.5 text-[9px] font-mono border border-[#D7A84B] bg-[#101214] text-[#D7A84B] rounded-none font-bold tracking-wider"
    >
      [{count}]
    </span>
  );
}
