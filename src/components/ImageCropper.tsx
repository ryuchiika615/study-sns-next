"use client";

import { useState, useCallback } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";

interface ImageCropperProps {
  imageUrl: string;
  aspect?: number;
  cropShape?: "rect" | "round";
  allowAspectChange?: boolean;
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropper({
  imageUrl,
  aspect = 1,
  cropShape = "rect",
  allowAspectChange = false,
  onComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState({ horizontal: false, vertical: false });
  const [selectedAspect, setSelectedAspect] = useState(aspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageUrl, croppedAreaPixels, rotation, flip);
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
          aspect={selectedAspect}
          cropShape={cropShape}
          rotation={rotation}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="space-y-3 p-4 bg-black/70">
        {allowAspectChange && <div className="flex flex-wrap justify-center gap-2"><span className="self-center text-xs font-bold text-white/80">切り取り</span>{[[16 / 9, "横長"], [4 / 3, "標準"], [1, "正方形"], [3 / 4, "縦長"]].map(([value, label]) => <button key={label as string} type="button" onClick={() => setSelectedAspect(value as number)} className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${selectedAspect === value ? "bg-white text-slate-900" : "bg-white/20 text-white"}`}>{label as string}</button>)}</div>}
        <div className="flex items-center justify-center gap-3 text-white text-sm"><button type="button" onClick={() => setFlip((value) => ({ ...value, horizontal: !value.horizontal }))} className={`rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${flip.horizontal ? "bg-white text-slate-900" : "bg-white/20 text-white"}`}><i className="fas fa-left-right mr-1" />左右反転</button><button type="button" onClick={() => setFlip((value) => ({ ...value, vertical: !value.vertical }))} className={`rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${flip.vertical ? "bg-white text-slate-900" : "bg-white/20 text-white"}`}><i className="fas fa-up-down mr-1" />上下反転</button></div>
        <div className="flex items-center justify-center gap-3 text-white text-sm"><i className="fas fa-rotate-left" /><input type="range" min={-180} max={180} step={1} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-32 accent-white" aria-label="回転" /><i className="fas fa-rotate-right" /><span className="w-9 text-xs">{rotation}°</span></div>
        <div className="flex items-center justify-center gap-3 text-white text-sm"><i className="fas fa-search-minus" /><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-white" /><i className="fas fa-search-plus" /></div>
      </div>
      <div className="flex items-center justify-center gap-6 p-4 bg-black/80">
        <button onClick={onCancel}
          className="text-white text-sm font-bold px-6 py-2 rounded-full bg-white/20 hover:bg-white/30 border-none cursor-pointer">
          キャンセル
        </button>
        <button onClick={handleConfirm}
          className="text-white text-sm font-bold px-6 py-2 rounded-full bg-primary hover:bg-primary/80 border-none cursor-pointer">
          {isRound ? "アイコンとして設定" : "切り抜き確定"}
        </button>
      </div>
    </div>
  );
}
