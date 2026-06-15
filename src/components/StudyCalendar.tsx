"use client";

type DayData = { date: string; minutes: number };

export default function StudyCalendar({ data, year }: { data: DayData[]; year?: number }) {
  const y = year ?? new Date().getFullYear();
  const startDate = new Date(y, 0, 1);
  const endDate = new Date(y, 11, 31);
  const startDay = startDate.getDay();

  const dayMap = new Map<string, number>();
  for (const d of data) {
    dayMap.set(d.date, dayMap.get(d.date)! + d.minutes || d.minutes);
  }

  const days: { date: string; level: number }[] = [];
  const d = new Date(startDate);
  d.setDate(d.getDate() - startDay);
  while (d <= endDate) {
    const key = d.toISOString().split("T")[0];
    const mins = dayMap.get(key) || 0;
    let level = 0;
    if (mins > 0) level = mins <= 30 ? 1 : mins <= 60 ? 2 : mins <= 120 ? 3 : 4;
    days.push({ date: key, level });
    d.setDate(d.getDate() + 1);
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const colors = ["bg-gray-100", "bg-green-200", "bg-green-400", "bg-green-600", "bg-green-800"];
  const dayLabels = ["", "月", "", "水", "", "金", ""];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5" style={{ minWidth: weeks.length * 14 }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={day.date}
                className={`w-3 h-3 rounded-sm ${colors[day.level]} ${day.level === 0 ? "" : ""}`}
                title={`${day.date}: ${dayMap.get(day.date) || 0}分`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
        <span>少</span>
        {colors.map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
