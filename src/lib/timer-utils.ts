import { toIsoDate } from "@/lib/time/periods";

export type TimerSaveSegment = {
  entryDate: string;
  startTime: string;
  endTime: string;
  overnight?: boolean;
};

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** ISO date helpers for midnight split (client may also split; exported for tests). */
export function splitTimerAtMidnight(
  startedAt: Date,
  endedAt: Date,
): TimerSaveSegment[] {
  const startDate = toIsoDate(startedAt);
  const endDate = toIsoDate(endedAt);

  if (startDate === endDate) {
    return [
      {
        entryDate: startDate,
        startTime: formatTime(startedAt),
        endTime: formatTime(endedAt),
      },
    ];
  }

  const endOfDay = new Date(startedAt);
  endOfDay.setHours(23, 59, 59, 0);

  const startOfNext = new Date(endedAt);
  startOfNext.setHours(0, 0, 0, 0);

  return [
    {
      entryDate: startDate,
      startTime: formatTime(startedAt),
      endTime: "23:59",
    },
    {
      entryDate: endDate,
      startTime: "00:00",
      endTime: formatTime(endedAt),
    },
  ];
}
