"use client";

import NextImage from "next/image";
import { getOptimizedIconUrl } from "@/lib/utils";

export default function ChallengePopup({
  incomingChallenge,
  onClose,
  onAccept,
  onDecline,
}: {
  incomingChallenge: any;
  onClose: () => void;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl mb-3">🔥</div>
        <h2 className="text-lg font-bold mb-1">勝負が仕掛けられました！</h2>
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 border-2 border-orange-300">
            {incomingChallenge.challenger?.icon_url ? (
              <NextImage src={getOptimizedIconUrl(incomingChallenge.challenger.icon_url, 160)} width={64} height={64} className="rounded-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fas fa-user text-xl" /></div>
            )}
          </div>
        </div>
        <p className="font-bold text-sm">{incomingChallenge.challenger?.display_name || incomingChallenge.challenger?.username}</p>
        <p className="text-sm text-gray-600 mt-2 mb-4">{incomingChallenge.message}</p>
        <div className="flex gap-2">
          <button onClick={onAccept}
            className="flex-1 bg-green-500 text-white rounded-full py-2.5 text-sm font-bold cursor-pointer hover:bg-green-600 transition active:scale-95">
            受ける！
          </button>
          <button onClick={onDecline}
            className="flex-1 border border-gray-200 text-gray-500 rounded-full py-2.5 text-sm cursor-pointer hover:bg-gray-50 transition active:scale-95">
            断る
          </button>
        </div>
      </div>
    </div>
  );
}
