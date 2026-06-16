"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

type Toast = {
  id: number;
  message: string;
  type: "streak" | "info" | "like" | "reply" | "follow" | "follow_post" | "gift" | "error";
  streak?: number;
  bonus?: number;
  href?: string;
  exiting?: boolean;
};

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode; unreadCount?: number }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 inset-x-0 z-[99999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast, i) => (
          <div
            key={toast.id}
            onClick={() => { if (toast.href) window.location.href = toast.href; removeToast(toast.id); }}
            className={`pointer-events-auto px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-bold max-w-xs text-center ${
              toast.href ? "cursor-pointer" : ""
            } ${
              toast.exiting ? "animate-toast-exit" : "animate-toast-enter"
            } ${
              toast.type === "streak"
                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                : toast.type === "like"
                ? "bg-gradient-to-r from-pink-500 to-red-500"
                : toast.type === "reply"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                : toast.type === "gift"
                ? "bg-gradient-to-r from-purple-500 to-pink-500"
                : toast.type === "follow"
                ? "bg-gradient-to-r from-green-500 to-teal-500"
                : toast.type === "follow_post"
                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                : "bg-gradient-to-r from-gray-800 to-gray-700"
            }`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {toast.type === "streak" && (
              <div>
                <div className="text-lg">🎉 連続{toast.streak}日目達成！</div>
                <div className="text-sm opacity-90">+{toast.bonus}pt ボーナス獲得</div>
              </div>
            )}
            {toast.type !== "streak" && <div>{toast.message}</div>}
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes toast-enter {
          from { opacity: 0; transform: translateY(-24px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-exit {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-16px) scale(0.9); }
        }
        .animate-toast-enter {
          animation: toast-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-toast-exit {
          animation: toast-exit 0.25s ease-in forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
}
