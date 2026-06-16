"use client";

type DayData = { date: string; minutes: number };

export default function StudyCalendar({ data, year }: { data: DayData[]; year?: number }) {
  const y = year ?? new Date().getFullYear();
  const startDate = new Date(y, 0, 1);
  const endDate = new Date(y, 11, 31);
  const startDay = startDate.getDay();

  const dayMap = new Map<string, number>();
  for (const d of data) {
    dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.minutes);
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

  const colors = ["bg-gray-100", "bg-blue-200", "bg-blue-400", "bg-blue-600", "bg-blue-800"];

  return (
    <div>
      <div className="flex gap-[2px]" style={{ minWidth: weeks.length * 14 }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {week.map((day, di) => (
              <div
                key={day.date}
                className={`w-3.5 h-3.5 rounded-[3px] ${colors[day.level]}`}
                title={`${day.date}: ${dayMap.get(day.date) || 0}分`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
        <span>少</span>
        {colors.map((c, i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-[3px] ${c}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
