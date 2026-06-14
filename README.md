# リュッター Next.js 版

勉強SNS「リュッター」を Next.js 14 + TypeScript + Supabase で再現したプロジェクト。

## アーキテクチャ

```
User (Browser)
     │
     ▼
┌─────────────────────────────────────────┐
│          Vercel (Edge Network)          │
│  ┌───────────────────────────────────┐  │
│  │     Next.js 14 App Router        │  │
│  │  ┌─────────┐  ┌──────────────┐   │  │
│  │  │  Pages  │  │  API Routes   │   │  │
│  │  │  (SSR)  │  │  (Serverless) │   │  │
│  │  └─────────┘  └──────┬───────┘   │  │
│  └──────────────────────┼────────────┘  │
└─────────────────────────┼────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  Supabase  │  │  Supabase  │  │ Cloudinary │
   │   Auth     │  │PostgreSQL  │  │   Storage  │
   │(ログイン)   │  │  (データ)   │  │  (画像任意)  │
   └────────────┘  └────────────┘  └────────────┘
```

## 元のDjango版との比較

| 項目 | Django版 (現状) | Next.js版 (新) |
|------|----------------|----------------|
| 言語 | Python 3.12+10+ | TypeScript |
| フレームワーク | Django 6.0 | Next.js 14 |
| DB | SQLite / PostgreSQL | Supabase (PostgreSQL) |
| 認証 | Django Auth | Supabase Auth |
| 画像保存 | Cloudinary | Supabase Storage / Cloudinary |
| サーバー | Gunicorn (Render) | Vercel Edge Functions |
| コールドスタート | あり（13分おきPing必須） | **なし** |
| 静的ファイル | WhiteNoise | Vercel Edge |
| 管理画面 | Django Admin / Jazzmin | カスタム管理ページ |
| チャート | Chart.js (CDN) | Chart.js (npm) |
| CSS | カスタムCSS | Tailwind CSS |
| ホスティング料金 | 無料 (Render) | 無料 (Vercel) |

## 再現した全機能

### SNS基本機能
- [x] ユーザー登録・ログイン・ログアウト (Supabase Auth)
- [x] 投稿CRUD (140字 + 画像 + 科目 + 勉強時間)
- [x] AJAXいいね（トグル）
- [x] AJAXコメント
- [x] フォロー/フォロワー
- [x] 通知（いいね/リプライ/フォロー）
- [x] 投稿検索
- [x] ページネーション

### 勉強特化機能
- [x] 勉強時間ログ（科目別・日付指定）
- [x] 週間積み上げグラフ
- [x] 分析ページ（科目円グラフ・日別棒グラフ・期間指定）
- [x] ランキング（週間/月間/3ヶ月/年間）
- [x] 学習目標設定（目標日・目標時間）

### ゲーミフィケーション
- [x] ポイント2重通貨（通常ポイント + 交換ポイント）
- [x] 連続投稿ボーナス（1→2→4→8→16→32→64、7日ループ）
- [x] 称号システム（6段階レアリティ）
- [x] アバターシステム
- [x] ショップ（購入・一括売却）
- [x] 称号合成（精錬: 結合・部位カスタム合成）

### 管理機能
- [x] ログインアクティビティ監視
- [x] Health checkエンドポイント

## デプロイ手順

### 1. Supabase セットアップ

1. https://supabase.com でアカウント作成
2. プロジェクト作成
3. SQL Editor で `supabase/migrations/0001_schema.sql` を実行
4. Authentication > Settings でメール認証を有効化
5. Storage にバケット作成: `post-images`, `avatars`

### 2. Vercel デプロイ

```bash
# プロジェクトのルートで
npm install
npm run dev  # ローカル開発

# Vercel CLI でデプロイ
npx vercel
```

### 3. 環境変数設定 (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

### 4. Supabase Storage の CORS 設定

Storage > Settings で CORS を許可。

## ローカル開発

```bash
npm install
npm run dev
# http://localhost:3000
```

## ライセンス

MIT
