"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import Image from "next/image";

interface MentionAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onChange: (val: string) => void;
}

export default function MentionAutocomplete({ textareaRef, content, onChange }: MentionAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<{ username: string; display_name: string | null; icon_url: string | null }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const loadFollowedUsers = useCallback(async (q: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: follows } = await supabase
      .from("follows")
      .select("following:following_id(username, display_name, icon_url)")
      .eq("follower_id", user.id);
    if (!follows) return;
    const all = follows
      .map((f: any) => f.following)
      .filter(Boolean);
    if (!q) {
      setUsers(all);
    } else {
      const lower = q.toLowerCase();
      setUsers(all.filter((u: any) =>
        u.username.toLowerCase().includes(lower) ||
        (u.display_name || "").toLowerCase().includes(lower)
      ));
    }
    setSelectedIndex(0);
  }, [supabase]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handler = () => {
      const pos = textarea.selectionStart;
      const before = content.slice(0, pos);
      const match = before.match(/@([\p{L}\p{N}._-]*)$/u);
      if (match && match.index !== undefined) {
        const q = match[1];
        setQuery(q);
        setCursorPos(match.index);
        setOpen(true);
        loadFollowedUsers(q);
      } else {
        setOpen(false);
      }
    };

    textarea.addEventListener("input", handler);
    textarea.addEventListener("keyup", handler);
    textarea.addEventListener("click", handler);
    return () => {
      textarea.removeEventListener("input", handler);
      textarea.removeEventListener("keyup", handler);
      textarea.removeEventListener("click", handler);
    };
  }, [content, textareaRef, loadFollowedUsers]);

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const before = content.slice(0, cursorPos);
    const after = content.slice(textarea.selectionStart);
    const newVal = before + `@${username} ` + after;
    onChange(newVal);
    setOpen(false);
    const newPos = cursorPos + username.length + 2;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, users.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (users[selectedIndex]) {
        e.preventDefault();
        insertMention(users[selectedIndex].username);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!open || users.length === 0) return null;

  return (
    <div ref={dropdownRef} onKeyDown={handleKeyDown}
      className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
      {users.map((u, i) => (
        <button key={u.username} type="button"
          onMouseDown={(e) => { e.preventDefault(); insertMention(u.username); }}
          onMouseEnter={() => setSelectedIndex(i)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-none cursor-pointer transition ${
            i === selectedIndex ? "bg-primary/10 text-primary" : "bg-white text-gray-700 hover:bg-gray-50"
          }`}>
          {u.icon_url ? (
            <Image src={u.icon_url} width={22} height={22} className="rounded-full object-cover" alt="" />
          ) : (
            <i className="fas fa-user text-xs text-gray-400 w-[22px] text-center" />
          )}
          <span className="font-bold">{u.display_name || u.username}</span>
          <span className="text-xs text-gray-400">@{u.username}</span>
        </button>
      ))}
    </div>
  );
}
