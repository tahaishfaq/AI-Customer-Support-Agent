"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";

export function MessageList({ messages, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          responseTime={msg.responseTime}
        />
      ))}
      {loading ? (
        <MessageBubble role="ASSISTANT" pending />
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
