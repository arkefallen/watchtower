export interface ZonedTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getZonedTimeParts(date: Date, timezone: string): ZonedTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const dayOfWeek = WEEKDAYS[partMap.weekday] ?? 0;
  const hour = parseInt(partMap.hour ?? "0", 10);
  const minute = parseInt(partMap.minute ?? "0", 10);
  const day = parseInt(partMap.day ?? "1", 10);
  const month = parseInt(partMap.month ?? "1", 10);
  const year = parseInt(partMap.year ?? "1970", 10);

  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek,
  };
}

export interface HeatmapData {
  habitual: number[][]; // 7 rows (Sun=0..Sat=6) × 24 cols (0..23 hr)
  recent7d: number[][]; // 7 rows (day 0..6 in window) × 24 cols
  timezone: string;
  recentWindow: {
    start: string;
    end: string;
  };
}

export function computeHeatmaps(
  timestamps: Date[],
  timezone: string,
  now: Date = new Date()
): HeatmapData {
  // Habitual 7x24 matrix (dayOfWeek x hour)
  const habitual: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  // Rolling 7-day 7x24 matrix (dayOffset 0..6 x hour)
  const recent7d: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const ts of timestamps) {
    const parts = getZonedTimeParts(ts, timezone);
    // Habitual: full history by dayOfWeek (0-6) and hour (0-23)
    if (parts.dayOfWeek >= 0 && parts.dayOfWeek < 7 && parts.hour >= 0 && parts.hour < 24) {
      habitual[parts.dayOfWeek][parts.hour]++;
    }

    // Recent 7d: rolling 7-day window
    if (ts.getTime() >= windowStart.getTime() && ts.getTime() <= windowEnd.getTime()) {
      const dayOffset = Math.min(
        6,
        Math.max(0, Math.floor((ts.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000)))
      );
      recent7d[dayOffset][parts.hour]++;
    }
  }

  return {
    habitual,
    recent7d,
    timezone,
    recentWindow: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    },
  };
}
