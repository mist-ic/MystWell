import { Session } from '@supabase/supabase-js';

// This service might now be used for other chat-related HTTP calls if needed in the future,
// like fetching summaries of past chats, but the core send/receive logic moves to WebSockets.

console.log("chatService.ts loaded (HTTP sendMessage removed, use WebSocket hook).");

// Example of a function that might remain or be added later:
// export const getChatSummaries = async (session: Session | null): Promise<any[]> => {
//   // ... implementation to fetch summaries via HTTP ...
//   return [];
// }; 