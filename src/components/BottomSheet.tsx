"use client";

import { useEffect, useRef } from "react";

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return open ? (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-black/40 flex-1" />
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col animate-slide-up"
      >
        <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100 shrink-0">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="text-gray-500 text-xl cursor-pointer">
              <i className="fas fa-times" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  ) : null;
}
