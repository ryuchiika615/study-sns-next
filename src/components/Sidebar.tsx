"use client";

export function Sidebar() {
  return (
    <>
      <button
        type="button"
        className="absolute top-1/2 left-4 -translate-y-1/2 text-2xl text-gray-900 z-50 cursor-pointer bg-white/90 border-none w-10 h-10 rounded-full shadow flex items-center justify-center"
        onClick={() => {
          document.getElementById("sidebar")!.style.width = "250px";
          document.getElementById("overlay")!.style.display = "block";
        }}
      >
        <i className="fas fa-bars" />
      </button>

      <div id="sidebar" className="fixed top-0 left-0 h-full w-0 z-[10000] bg-dark overflow-hidden transition-all duration-300 pt-16 shadow-lg">
        <a href="javascript:void(0)" className="closebtn absolute top-0 right-4 text-4xl text-white no-underline p-2.5"
          onClick={() => {
            document.getElementById("sidebar")!.style.width = "0";
            document.getElementById("overlay")!.style.display = "none";
          }}>
          &times;
        </a>
        <a href="/" className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-home w-6 text-center mr-3" /> ホーム
        </a>
        <a href="/rankings" className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-trophy w-6 text-center mr-3" /> ランキング
        </a>
        <a href="/analytics" className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-chart-pie w-6 text-center mr-3" /> 分析
        </a>
        <a href="/gacha" className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="far fa-calendar-check w-6 text-center mr-3" style={{ color: "#4ade80" }} /> ログインボーナス
        </a>
        <a href="/profile/edit" className="block text-lg text-gray-300 no-underline py-4 px-6 hover:bg-gray-800 hover:text-white font-bold">
          <i className="fas fa-user-gear w-6 text-center mr-3" /> 設定
        </a>
        <hr className="border-gray-700 my-5 mx-6" />
        <form action="/auth/logout" method="POST" id="logout-form" className="hidden" />
        <a href="javascript:void(0)" className="block text-lg text-red-400 no-underline py-4 px-6 hover:bg-gray-800 font-bold"
          onClick={() => {
            fetch("/auth/logout", { method: "POST" }).then(() => { window.location.href = "/auth/login"; });
          }}>
          <i className="fas fa-sign-out-alt w-6 text-center mr-3" /> ログアウト
        </a>
      </div>

      <div id="overlay" className="fixed inset-0 bg-black/60 z-[9999] hidden"
        onClick={() => {
          document.getElementById("sidebar")!.style.width = "0";
          document.getElementById("overlay")!.style.display = "none";
        }} />
    </>
  );
}
