"use client";

import { useState } from "react";
import BgmPanel from "./BgmPanel";

interface BgmToggleProps {
  className?: string;
  iconOnly?: boolean;
}

export default function BgmToggle({ className, iconOnly }: BgmToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={className || "fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary/90 border-none text-xl"}>
        {iconOnly ? <i className="fas fa-music" /> : <><i className="fas fa-music mr-1" /> BGM管理</>}
      </button>
      {open && <BgmPanel onClose={() => setOpen(false)} />}
    </>
  );
}
