"use client";

import { useEffect, useRef } from "react";
import { Chart } from "@/lib/chart-registry";

export function WeeklyChart({ labels, datasets }: { labels: string[]; datasets: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
          y: { stacked: true, beginAtZero: true },
        },
        plugins: { legend: { position: "bottom" } },
      },
    });

    return () => chart.destroy();
  }, [labels, datasets]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-center mb-2">
        <strong>直近7日 科目別</strong>
        <span className="text-primary text-sm font-bold">合計 {datasets.reduce((sum, d) => sum + d.data.reduce((a: number, b: number) => a + b, 0), 0)}分</span>
      </div>
      <canvas ref={canvasRef} height={210} />
    </div>
  );
}
