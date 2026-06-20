"use client";

import PostCard from "@/components/PostCard";
import type { PostWithDetails } from "@/lib/types";

export default function PostDetailClient({
  post,
  currentUserId,
  comments,
}: {
  post: PostWithDetails;
  currentUserId: string;
  comments: any[];
}) {
  return (
    <div className="mx-4 my-4">
        <PostCard
          post={post}
          currentUserId={currentUserId}
          defaultShowComments={true}
          initialComments={comments}
        />
      </div>
  );
}
