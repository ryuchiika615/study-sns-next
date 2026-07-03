"use client";

import { useState, useCallback } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";

interface ImageCropperProps {
  imageUrl: string;
  aspect?: number;
  cropShape?: "rect" | "round";
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropper({
  imageUrl,
  aspect = 1,
  cropShape = "rect",
  onComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageUrl, croppedAreaPixels);
    if (blob) onComplete(blob);
  };

  const isRound = cropShape === "round";

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-black/80">
      <div className="flex-1 relative">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="flex items-center justify-center gap-6 p-4 bg-black/60">
        <button onClick={onCancel}
          className="text-white text-sm font-bold px-6 py-2 rounded-full bg-white/20 hover:bg-white/30 border-none cursor-pointer">
          キャンセル
        </button>
        <div className="flex items-center gap-3 text-white text-sm">
          <i className="fas fa-search-minus" />
          <input type="range" min={1} max={3} step={0.1} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-white" />
          <i className="fas fa-search-plus" />
        </div>
        <button onClick={handleConfirm}
          className="text-white text-sm font-bold px-6 py-2 rounded-full bg-primary hover:bg-primary/80 border-none cursor-pointer">
          {isRound ? "アイコンとして設定" : "切り抜き確定"}
        </button>
      </div>
    </div>
  );
}
