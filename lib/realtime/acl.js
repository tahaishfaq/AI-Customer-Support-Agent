import { REALTIME_ROOMS } from "./constants.js";

export function authorizeRoom(claims, room) {
  if (!claims || typeof room !== "string") return false;

  if (claims.typ === "aide-realtime-owner") {
    if (room === REALTIME_ROOMS.user(claims.sub)) return true;

    const workspaceMatch = room.match(/^workspace:([^:]+):desk$/);
    if (workspaceMatch) return claims.workspaceIds.includes(workspaceMatch[1]);

    const conversationMatch = room.match(/^conversation:([^:]+):owner$/);
    if (conversationMatch) {
      return Array.isArray(claims.conversationIds)
        ? claims.conversationIds.includes(conversationMatch[1])
        : false;
    }

    return false;
  }

  if (claims.typ === "aide-realtime-public-conversation") {
    return room === REALTIME_ROOMS.conversationPublic(claims.conversationId);
  }

  return false;
}
