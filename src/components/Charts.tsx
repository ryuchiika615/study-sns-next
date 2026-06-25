"use client";

import { useEffect, useRef } from "react";
import { Chart } from "@/lib/chart-registry";

export function PieChart({ labels, data, colors }: { labels: string; data: string; colors: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parsedLabels = JSON.parse(labels || "[]");
  const parsedData = JSON.parse(data || "[]");
  const parsedColors = JSON.parse(colors || "[]");

  useEffect(() => {
    if (!canvasRef.current || parsedLabels.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: parsedLabels,
        datasets: [{ data: parsedData, backgroundColor: parsedColors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const m = ctx.parsed as number;
                const h = Math.floor(m / 60);
                const r = m % 60;
                if (h > 0 && r > 0) return `${h}時間${r}分`;
                if (h > 0) return `${h}時間`;
                return `${r}分`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [labels, data, colors]);

  if (parsedLabels.length === 0) return <p className="text-gray-500 text-center py-8">データがありません</p>;

  return (
    <div className="max-w-sm mx-auto">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function BarChart({ labels, data }: { labels: string; data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parsedLabels = JSON.parse(labels || "[]");
  const parsedData = JSON.parse(data || "[]");

  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h > 0 && r > 0) return `${h}時間${r}分`;
    if (h > 0) return `${h}時間`;
    return `${r}分`;
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: parsedLabels,
        datasets: [{
          label: "勉強時間",
          data: parsedData,
          backgroundColor: "#1877f2",
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: any) => fmt(value),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => fmt(ctx.parsed.y ?? ctx.parsed),
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [labels, data]);

  return (
    <div>
      <canvas ref={canvasRef} height={200} />
    </div>
  );
}
