"use client";

import { useState } from "react";
import BgmPanel from "./BgmPanel";

export default function BgmToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary/90 border-none text-xl">
        <i className="fas fa-music" />
      </button>
      {open && <BgmPanel onClose={() => setOpen(false)} />}
    </>
  );
}
