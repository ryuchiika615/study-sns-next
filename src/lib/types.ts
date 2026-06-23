export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  department: string | null;
  theme_color: string;
  icon_url: string | null;
  target_date: string | null;
  target_minutes: number;
  /** @deprecated 合併により exchange_points を使用 */
  points: number;
  exchange_points: number;
  consecutive_post_days: number;
  last_post_date: string | null;
  current_title_id: string | null;
  current_avatar_id: string | null;
  created_at: string;
  is_admin?: boolean;
  is_banned?: boolean;
}

export interface GachaItem {
  id: string;
  name: string;
  rarity: Rarity;
  category: "title" | "icon";
  created_at: string;
}

export interface PostWithDetails {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  image_urls: string[] | null;
  subject: string;
  study_minutes: number;
  study_date: string | null;
  reply_to_id: string | null;
  quote_post_id: string | null;
  created_at: string;
  updated_at: string | null;
  user: Profile;
  current_title: GachaItem | null;
  current_avatar: GachaItem | null;
  likes_count: number;
  is_liked: boolean;
  comments_count: number;
  reactions_count: { reaction: string; count: number }[];
  my_reaction: string | null;
  display_study_time: string;
  subject_color: string;
  formatted_time: string;
  quoted_post: {
    id: string;
    content: string;
    user_id: string;
    user: { id: string; display_name: string | null; username: string | null; icon_url: string | null };
  } | null;
}

export interface NotificationSettings {
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  daily_summary: boolean;
  vibrate_like: boolean;
  vibrate_reply: boolean;
  vibrate_follow: boolean;
  vibrate_mention: boolean;
  vibrate_gift: boolean;
  vibrate_follow_post: boolean;
  vibrate_admin_announcement: boolean;
}

export interface MutedUser {
  muted_user_id: string;
  created_at: string;
}

export interface CommentWithUser {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  user: Profile;
}

export interface NotificationWithSender {
  id: string;
  recipient_id: string;
  sender_id: string;
  post_id: string | null;
  notification_type: "like" | "reply" | "follow" | "follow_post" | "gift" | "mention" | "admin_announcement" | "repost";
  is_read: boolean;
  created_at: string;
  sender: Profile;
}

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR" | "LR";

export interface RankingEntry {
  rank: number;
  user: Profile;
  total_minutes: number;
  post_count: number;
  display_time: string;
}

export interface SubjectBreakdown {
  subject: string;
  total: number;
  count: number;
  display_time: string;
  color: string;
}

export interface StudyingSession {
  user_id: string;
  heartbeat_at: string;
  user: {
    id: string;
    display_name: string | null;
    username: string | null;
    icon_url: string | null;
  } | null;
}

export interface WeeklyBadge {
  id: string;
  user_id: string;
  week_start: string;
  created_at: string;
}

export interface UserFeedback {
  id: number;
  user_id: string;
  content: string;
  type: string;
  image_url: string | null;
  created_at: string;
  user: {
    id: string;
    display_name: string | null;
    username: string | null;
    icon_url: string | null;
  } | null;
}

export interface WeeklyChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
  }[];
}
