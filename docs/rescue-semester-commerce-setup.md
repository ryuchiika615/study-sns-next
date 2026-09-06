# 締切レスキュー 学期版の販売設定

## 公開前に必要な設定

1. Supabase SQL Editorで `supabase/migrations/0124_digital_product_orders.sql` を実行する。
2. Stripe本番環境で「締切レスキュー 学期版」を作成する。
   - 価格: 500円
   - 種類: 1回限り
   - 通貨: JPY
3. 作成した価格ID（`price_...`）をVercelのProduction環境へ登録する。
   - Key: `STRIPE_RESCUE_SEMESTER_PRICE_ID`
   - Value: Stripeの価格ID
4. Vercelを再デプロイする。
5. Stripeの既存Webhookで `checkout.session.completed` が有効か確認する。

## 本番確認

- 未ログイン: 購入操作でログインが必要と表示される。
- ログイン済み・未購入: Stripe Checkoutへ移動する。
- 決済完了: `digital_product_orders` に1件作成される。
- 購入済み: 決済ボタンが再購入ではなくダウンロードになる。
- 別ユーザー: ダウンロードURLを直接開いても403になる。
- 決済メール: Stripe Checkoutで購入者が入力したメールに届く。

無料版は今後も登録不要で配布し、機能を削らない。有料版は学期・科目・試験の管理を追加した買い切り商品として扱う。RYUTTER Pro（月額240円）はアプリ内の継続支援機能、学期版（500円）はファイル商品として役割を分ける。
