"use client";

import { useRef, useState } from "react";

export default function BeeryualCamera({ userId, supabase, onResult }: { userId: string; supabase: any; onResult: (url: string) => void }) {
  const [step, setStep] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [photos, setPhotos] = useState<{ back: string | null; front: string | null }>({ back: null, front: null });
  const [firstSide, setFirstSide] = useState<'back' | 'front'>('back');
  const [secondSide, setSecondSide] = useState<'back' | 'front'>('front');
  const [capturedFirst, setCapturedFirst] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [showSmall, setShowSmall] = useState(true);
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number }>({ x: 16, y: 16 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const smallOverlayRef = useRef<HTMLImageElement>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facingMode: 'user' | 'environment') => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {}
  };

  const captureFrame = (): Promise<string> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    });
  };

  const handleStart = () => {
    setStep('camera');
    startCamera('environment');
  };

  const handleShutter = async () => {
    const dataUrl = await captureFrame();
    const side = firstSide;
    setPhotos(prev => ({ ...prev, [side]: dataUrl }));
    setCapturedFirst(true);
    stopStream();
    await startCamera(secondSide === 'back' ? 'environment' : 'user');
    let count = 3;
    setCountdown(count);
    countdownTimer.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        autoCaptureSecond();
      }
    }, 1000);
  };

  const autoCaptureSecond = async () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setCountdown(null);
    const dataUrl = await captureFrame();
    const side = secondSide;
    setPhotos(prev => ({ ...prev, [side]: dataUrl }));
    stopStream();
    setStep('preview');
  };

  const handleCancel = () => {
    stopStream();
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setStep('idle');
    setCountdown(null);
    setPhotos({ back: null, front: null });
    setCapturedFirst(false);
  };

  const composite = () => {
    const canvas = canvasRef.current;
    const { back, front } = photos;
    if (!canvas || !back || !front) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const largeKey = swapped ? 'front' : 'back';
    const smallKey = swapped ? 'back' : 'front';
    const largeImg = new Image();
    const smallImg = new Image();
    let loaded = 0;
    largeImg.onload = smallImg.onload = () => {
      loaded++;
      if (loaded < 2) return;
      const devW = window.innerWidth;
      const devH = window.innerHeight;
      const devRatio = devW / devH;
      const imgW = largeImg.naturalWidth;
      const imgH = largeImg.naturalHeight;
      canvas.width = Math.max(800, imgW);
      canvas.height = canvas.width / devRatio;
      let sx = 0, sy = 0, sw = imgW, sh = imgH;
      if (imgW / imgH > devRatio) {
        sw = imgH * devRatio;
        sx = (imgW - sw) / 2;
      } else {
        sh = imgW / devRatio;
        sy = (imgH - sh) / 2;
      }
      ctx.drawImage(largeImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      if (showSmall) {
        const rh = canvas.height * 0.28;
        const rw = rh * 0.7;
        const container = previewContainerRef.current;
        let ox: number, oy: number;
        if (container && overlayPos.x) {
          const cr = container.getBoundingClientRect();
          ox = (overlayPos.x / cr.width) * canvas.width;
          oy = (overlayPos.y / cr.height) * canvas.height;
        } else {
          ox = 16;
          oy = 16;
        }
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(ox, oy, rw, rh, 12);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(smallImg, ox, oy, rw, rh);
        ctx.restore();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(ox, oy, rw, rh, 12);
        ctx.stroke();
      }
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `beeryual-${Date.now()}.jpg`, { type: "image/jpeg" });
        const fileName = `${userId}/${Date.now()}-beeryual.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, file);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            onResult(urlData.publicUrl);
            handleCancel();
          }
        }
      }, "image/jpeg", 0.8);
    };
    largeImg.src = largeKey === 'back' ? back! : front!;
    smallImg.src = smallKey === 'front' ? front! : back!;
  };

  if (step === 'camera') {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
        <div className="relative flex-1 flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {capturedFirst && countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-6xl font-bold drop-shadow-lg">{countdown}</span>
            </div>
          )}
          {photos[firstSide] && (
            <img src={photos[firstSide]!}
              className="absolute top-4 left-4 w-20 h-20 rounded-full border-2 border-white object-cover shadow-lg" />
          )}
        </div>
        <div className="flex items-center justify-center gap-6 p-6">
          {!capturedFirst ? (
            <>
              <button type="button" onClick={handleShutter}
                className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 cursor-pointer active:scale-95 transition" />
              <button type="button" onClick={() => {
                const next = firstSide === 'back' ? 'front' : 'back';
                setFirstSide(next);
                setSecondSide(next === 'back' ? 'front' : 'back');
                startCamera(next === 'back' ? 'environment' : 'user');
              }} className="text-white text-sm px-3 py-1 rounded-full bg-white/20 cursor-pointer">
                切替
              </button>
            </>
          ) : (
            <button type="button" onClick={autoCaptureSecond}
              className="w-16 h-16 rounded-full bg-white border-4 border-yellow-400 cursor-pointer active:scale-95 transition" />
          )}
          <button type="button" onClick={handleCancel}
            className="absolute top-4 right-4 text-white text-2xl cursor-pointer">✕</button>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
        <canvas ref={canvasRef} className="hidden" />
        <div ref={previewContainerRef} className="relative flex-1 flex items-center justify-center overflow-hidden">
          {(() => {
            const largeKey = swapped ? 'front' : 'back';
            const smallKey = swapped ? 'back' : 'front';
            const largeUrl = photos[largeKey];
            const smallUrl = photos[smallKey];
            return (
              <>
                <img src={largeUrl!} className="w-full h-full object-cover cursor-pointer"
                  onClick={() => { if (showSmall) setSwapped(!swapped); else setShowSmall(true); }}
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={(e) => {
                    const timer = setTimeout(() => setShowSmall(false), 600);
                    const onUp = () => { clearTimeout(timer); document.removeEventListener('pointerup', onUp); };
                    document.addEventListener('pointerup', onUp);
                  }} />
                {smallUrl && showSmall && (
                  <img ref={smallOverlayRef} src={smallUrl}
                    className="absolute h-[28dvh] w-[20dvh] rounded-xl border-2 border-white object-cover shadow-lg cursor-grab"
                    style={{ top: overlayPos.y || 16, left: overlayPos.x || 16, touchAction: "none" }}
                    onPointerDown={(e) => {
                      const el = e.currentTarget;
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const parent = el.parentElement!;
                      const parentRect = parent.getBoundingClientRect();
                      const elRect = el.getBoundingClientRect();
                      const startLeft = elRect.left - parentRect.left;
                      const startTop = elRect.top - parentRect.top;
                      const onMove = (ev: PointerEvent) => {
                        ev.preventDefault();
                        const x = Math.max(0, Math.min(parentRect.width - elRect.width, startLeft + ev.clientX - startX));
                        const y = Math.max(0, Math.min(parentRect.height - elRect.height, startTop + ev.clientY - startY));
                        el.style.left = x + "px";
                        el.style.top = y + "px";
                      };
                      const onUp = () => {
                        setOverlayPos({ x: parseFloat(el.style.left || "16"), y: parseFloat(el.style.top || "16") });
                        document.removeEventListener('pointermove', onMove);
                        document.removeEventListener('pointerup', onUp);
                      };
                      document.addEventListener('pointermove', onMove);
                      document.addEventListener('pointerup', onUp);
                    }} />
                )}
              </>
            );
          })()}
        </div>
        <div className="flex items-center justify-center gap-4 p-4">
          <button type="button" onClick={handleCancel}
            className="px-6 py-2 rounded-full bg-white/20 text-white text-sm cursor-pointer">キャンセル</button>
          <button type="button" onClick={composite}
            className="px-6 py-2 rounded-full bg-purple-500 text-white text-sm font-bold cursor-pointer hover:bg-purple-600">
            合成して確定
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={handleStart}
      className="text-xs bg-purple-100 text-purple-700 rounded-full px-3 py-1.5 border border-purple-200 cursor-pointer hover:bg-purple-200">
      ビーリュアル
    </button>
  );
}
