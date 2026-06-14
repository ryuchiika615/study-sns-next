"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .single();
      setIsAdmin(!!profile?.is_admin);
    });
  }, []);

  const closeSidebar = () => {
    document.getElementById("sidebar")!.style.width = "0";
    document.getElementById("overlay")!.style.display = "none";
  };

  return (
    <>
      <button
        type="button"
        className="fixed top-4 left-4 text-2xl text-gray-900 z-50 cursor-pointer bg-white/90 border-none w-10 h-10 rounded-full shadow flex items-center justify-center"
        onClick={() => {
          document.getElementById("sidebar")!.style.width = "250px";
          document.getElementById("overlay")!.style.display = "block";
        }}
      >
        <i className="fas fa-bars" />
      </button>

      <div id="sidebar" className="fixed top-0 left-0 h-full w-0 z-[10000] bg-dark overflow-hidden transition-all duration-300 pt-16 shadow-lg">
        <a href="javascript:void(0)" className="closebtn absolute top-0 right-4 text-4xl text-white no-underline p-2.5"
          onClick={closeSidebar}>
          &times;
        </a>
        <Link href="/" onClick={closeSidebar} className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-home w-6 text-center mr-3" /> ホーム
        </Link>
        <Link href="/rankings" onClick={closeSidebar} className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-trophy w-6 text-center mr-3" /> ランキング
        </Link>
        <Link href="/analytics" onClick={closeSidebar} className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-chart-pie w-6 text-center mr-3" /> 分析
        </Link>
        <Link href="/gacha" onClick={closeSidebar} className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="far fa-calendar-check w-6 text-center mr-3" style={{ color: "#4ade80" }} /> ログインボーナス
        </Link>
        <Link href="/profile/edit" onClick={closeSidebar} className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-user-gear w-6 text-center mr-3" /> 設定
        </Link>
        {isAdmin && (
          <>
            <hr className="border-gray-700 my-5 mx-6" />
            <Link href="/admin" onClick={closeSidebar} className="block text-lg text-yellow-400 no-underline py-4 px-6 hover:bg-gray-800 font-bold">
              <i className="fas fa-shield-alt w-6 text-center mr-3" /> 管理者画面
            </Link>
          </>
        )}
        <hr className="border-gray-700 my-5 mx-6" />
        <a href="javascript:void(0)" className="block text-lg text-red-400 no-underline py-4 px-6 hover:bg-gray-800 font-bold"
          onClick={() => {
            fetch("/auth/logout", { method: "POST" }).then(() => { window.location.href = "/auth/login"; });
          }}>
          <i className="fas fa-sign-out-alt w-6 text-center mr-3" /> ログアウト
        </a>
      </div>

      <div id="overlay" className="fixed inset-0 bg-black/60 z-[9999] hidden"
        onClick={closeSidebar} />
    </>
  );
}
