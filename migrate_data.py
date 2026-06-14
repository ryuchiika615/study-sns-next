"""
勉強SNS データ移行スクリプト
Django (SQLite) → Supabase (PostgreSQL)

使い方:
  1. Supabaseプロジェクトを作成し、マイグレーションSQLを実行しておく
  2. このスクリプトの接続情報を設定
  3. python migrate_data.py

必要なパッケージ: pip install supabase psycopg2-binary
"""

import sqlite3
import json
import os
from datetime import datetime

# ===== 設定 =====
SQLITE_PATH = r"C:\Users\ryuch\PycharmProjects\study_app_new\db.sqlite3"

SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_SERVICE_KEY = "your-service-role-key"  # Supabase Dashboard → Settings → API → service_role key
# ※service_role keyは秘密鍵。絶対公開しないこと！

# ===== SQLite接続 =====
sqlite = sqlite3.connect(SQLITE_PATH)
sqlite.row_factory = sqlite3.Row
cur = sqlite.cursor()

def fetch(table):
    cur.execute(f"SELECT * FROM {table}")
    return [dict(row) for row in cur.fetchall()]

# ===== データ抽出 =====
print("=== SQLiteからデータ抽出 ===")

# 1. ユーザー
users = fetch("auth_user")
print(f"ユーザー: {len(users)}人")

# 2. プロフィール
profiles = fetch("sns_profile")
print(f"プロフィール: {len(profiles)}件")

# 3. 投稿
posts = fetch("sns_post")
print(f"投稿: {len(posts)}件")

# 4. コメント
comments = fetch("sns_comment")
print(f"コメント: {len(comments)}件")

# 5. 通知
notifications = fetch("sns_notification")
print(f"通知: {len(notifications)}件")

# 6. ガチャアイテム
gacha_items = fetch("sns_gachaitem")
print(f"ガチャアイテム: {len(gacha_items)}件")

# 7. いいね (中間テーブル)
likes = fetch("sns_post_liked_by")
print(f"いいね: {len(likes)}件")

# 8. 所持アイテム (中間テーブル)
profile_items = fetch("sns_profile_items")
print(f"所持アイテム: {len(profile_items)}件")

# 9. フォロー (Profile.followsのManyToMany)
# DjangoのManyToManyフィールド用中間テーブル名を確認
try:
    follows = fetch("sns_profile_follows")
    print(f"フォロー: {len(follows)}件")
except:
    follows = []
    print("フォロー: 0件")

# 10. ログインセッション
sessions = fetch("sns_userloginsession")
print(f"ログインセッション: {len(sessions)}件")

# ===== Supabase投入 =====
print("\n=== Supabaseにデータ投入 ===")

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def safe_insert(table, rows, batch_size=50):
    """安全にINSERT（重複スキップ）"""
    success = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        try:
            supabase.table(table).upsert(batch, ignore_duplicates=True).execute()
            success += len(batch)
        except Exception as e:
            print(f"  ⚠ {table}: {e}")
    return success

# 1. ガチャアイテム（依存なし、最初に投入）
print("\n1. ガチャアイテム投入...")
gacha_rows = [
    {
        "id": str(item["id"]),
        "name": item["name"],
        "rarity": item["rarity"],
        "category": "icon" if ("【アイコン】" in item["name"] or "icon" in item["name"].lower()) else "title",
    }
    for item in gacha_items
]
safe_insert("gacha_items", gacha_rows)
print(f"   → {len(gacha_rows)}件")

# 2. ユーザー（Supabase Authに作成 → profilesに連携）
# ※Supabase Auth経由で作成する必要あり
print("\n2. ユーザー移行...")
user_id_map = {}  # old_id -> new_id
for u in users:
    try:
        # Supabase Authにユーザー作成
        resp = supabase.auth.admin.create_user({
            "email": u["email"] or f"user{u['id']}@example.com",
            "password": "resetme123",  # 仮パスワード、後で変更させる
            "email_confirm": True,
        })
        new_user = resp.user
        user_id_map[u["id"]] = new_user.id
        print(f"   ✓ {u['username']} -> {new_user.id}")
    except Exception as e:
        print(f"   ⚠ {u['username']}: {e}")
        # すでに存在する場合は検索
        existing = supabase.auth.admin.list_users()
        for eu in existing:
            if eu.email == u["email"] or eu.email == f"user{u['id']}@example.com":
                user_id_map[u["id"]] = eu.id
                print(f"   → 既存ユーザー: {eu.id}")
                break

# 3. プロフィール
print("\n3. プロフィール投入...")
profile_rows = []
for p in profiles:
    new_id = user_id_map.get(p["user_id"])
    if not new_id:
        print(f"   ⚠ ユーザーid={p['user_id']}が見つからないためスキップ")
        continue
    profile_rows.append({
        "id": new_id,
        "display_name": p.get("display_name"),
        "bio": p.get("bio"),
        "department": p.get("department"),
        "theme_color": p.get("theme_color", "dark"),
        "icon_url": p.get("icon"),
        "target_date": p.get("target_date"),
        "target_minutes": p.get("target_minutes", 0),
        "points": p.get("points", 0),
        "exchange_points": p.get("exchange_points", 0),
        "consecutive_post_days": p.get("consecutive_post_days", 0),
        "last_post_date": p.get("last_post_date"),
    })
safe_insert("profiles", profile_rows)
print(f"   → {len(profile_rows)}件")

# 4. 投稿
print("\n4. 投稿投入...")
post_rows = []
for p in posts:
    new_uid = user_id_map.get(p["user_id"])
    if not new_uid:
        continue
    post_rows.append({
        "id": str(p["id"]),
        "user_id": new_uid,
        "content": p["content"],
        "image_url": p.get("image"),
        "subject": p.get("subject", "その他"),
        "study_minutes": p.get("study_minutes", 0),
        "reply_to_id": str(p["reply_to_id"]) if p.get("reply_to_id") else None,
        "created_at": p["created_at"],
    })
safe_insert("posts", post_rows)
print(f"   → {len(post_rows)}件")

# 5. コメント
print("\n5. コメント投入...")
comment_rows = []
for c in comments:
    new_uid = user_id_map.get(c["user_id"])
    if not new_uid:
        continue
    comment_rows.append({
        "id": str(c["id"]),
        "post_id": str(c["post_id"]),
        "user_id": new_uid,
        "text": c["text"],
        "created_at": c["created_at"],
    })
safe_insert("comments", comment_rows)
print(f"   → {len(comment_rows)}件")

# 6. いいね
print("\n6. いいね投入...")
like_rows = []
for lk in likes:
    new_uid = user_id_map.get(lk["user_id"])
    new_pid = str(lk["post_id"])
    if not new_uid:
        continue
    like_rows.append({
        "user_id": new_uid,
        "post_id": new_pid,
    })
safe_insert("likes", like_rows)
print(f"   → {len(like_rows)}件")

# 7. 所持アイテム
print("\n7. 所持アイテム投入...")
item_rows = []
for pi in profile_items:
    new_uid = user_id_map.get(pi["profile_id"])
    if not new_uid:
        continue
    item_rows.append({
        "user_id": new_uid,
        "item_id": str(pi["gachaitem_id"]),
    })
safe_insert("user_items", item_rows)
print(f"   → {len(item_rows)}件")

# 8. フォロー
print("\n8. フォロー投入...")
follow_rows = []
for f in follows:
    follower_uid = user_id_map.get(f["from_profile_id"])
    following_uid = user_id_map.get(f["to_profile_id"])
    if not follower_uid or not following_uid:
        continue
    follow_rows.append({
        "follower_id": follower_uid,
        "following_id": following_uid,
    })
safe_insert("follows", follow_rows)
print(f"   → {len(follow_rows)}件")

# 9. 通知
print("\n9. 通知投入...")
notif_rows = []
for n in notifications:
    new_recip = user_id_map.get(n["recipient_id"])
    new_sender = user_id_map.get(n["sender_id"])
    if not new_recip or not new_sender:
        continue
    notif_rows.append({
        "id": str(n["id"]),
        "recipient_id": new_recip,
        "sender_id": new_sender,
        "post_id": str(n["post_id"]) if n.get("post_id") else None,
        "notification_type": n["notification_type"],
        "is_read": bool(n["is_read"]),
        "created_at": n["created_at"],
    })
safe_insert("notifications", notif_rows)
print(f"   → {len(notif_rows)}件")

# 10. 称号・アバターの紐付け
print("\n10. 称号・アバターの紐付け...")
for p in profile_rows:
    updates = {}
    # 該当するprofileからcurrent_title, current_avatarを復元
    old_p = next((op for op in profiles if user_id_map.get(op["user_id"]) == p["id"]), None)
    if old_p:
        title_name = old_p.get("current_title")
        avatar_name = old_p.get("current_avatar")
        if title_name:
            item = supabase.table("gacha_items").select("id").eq("name", title_name).execute()
            if item.data:
                updates["current_title_id"] = item.data[0]["id"]
        if avatar_name:
            item = supabase.table("gacha_items").select("id").eq("name", avatar_name).execute()
            if item.data:
                updates["current_avatar_id"] = item.data[0]["id"]
        if updates:
            supabase.table("profiles").update(updates).eq("id", p["id"]).execute()
print("   ✓ 完了")

print("\n=== 移行完了！ ===")
print("注意: ユーザーには仮パスワード 'resetme123' が設定されています。")
print("初回ログイン後に各自パスワード変更をお願いしてください。")
sqlite.close()
