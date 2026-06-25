"use client";

import { useEffect, useRef } from "react";
import { Chart } from "@/lib/chart-registry";

export function WeeklyChart({ labels, datasets }: { labels: string[]; datasets: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h > 0 && r > 0) return `${h}時間${r}分`;
    if (h > 0) return `${h}時間`;
    return `${r}分`;
  };

  const totalMinutes = datasets.reduce((sum, d) => sum + d.data.reduce((a: number, b: number) => a + b, 0), 0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: (value: any) => fmt(value),
            },
          },
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.parsed.y ?? ctx.parsed;
                return `${ctx.dataset.label}: ${fmt(val)}`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [labels, datasets]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-center mb-2">
        <strong>直近7日 科目別</strong>
        <span className="text-primary text-sm font-bold">合計 {fmt(totalMinutes)}</span>
      </div>
      <canvas ref={canvasRef} height={210} />
    </div>
  );
}
