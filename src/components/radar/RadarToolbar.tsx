// src/components/radar/RadarToolbar.tsx
import React from "react";

interface RadarToolbarProps {
  timeWindow: number;
  onTimeWindowChange: (value: number) => void;
  streaming: boolean;
  onStreamingToggle: (value: boolean) => void;
  onRefresh: () => void;
}

export const RadarToolbar: React.FC<RadarToolbarProps> = ({
  timeWindow,
  onTimeWindowChange,
  streaming,
  onStreamingToggle,
  onRefresh,
}) => {
  return (
    <div className="flex items-center gap-4 p-2 border-b border-[#30373D]">
      {/* Time window selector */}
      <label className="flex items-center space-x-2">
        <span className="text-sm font-medium text-[#D7A84B]">Time Window (hrs)</span>
        <select
          value={timeWindow}
          onChange={(e) => onTimeWindowChange(Number(e.target.value))}
          className="bg-[#171A1D] text-[#D7A84B] rounded-none border border-[#30373D] p-1"
        >
          {[12, 24, 48, 72, 168].map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>

      {/* Streaming toggle */}
      <button
        onClick={() => onStreamingToggle(!streaming)}
        className="px-3 py-1 bg-[#1E2327] text-[#D7A84B] border border-[#30373D]"
      >
        {streaming ? "Stop Streaming" : "Start Streaming"}
      </button>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        className="px-3 py-1 bg-[#1E2327] text-[#D7A84B] border border-[#30373D]"
      >
        Refresh
      </button>
    </div>
  );
};

export default RadarToolbar;
