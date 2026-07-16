interface ThreadInfo {
  personaId: string;
  channelId: string;
}

// messageId -> which persona sent it, so replies can continue that persona's
// conversation without needing another @mention. In-memory only — resets on
// restart, consistent with how conversation history already behaves.
const tracker = new Map<string, ThreadInfo>();

export function recordPersonaMessage(messageId: string, personaId: string, channelId: string): void {
  tracker.set(messageId, { personaId, channelId });
}

export function getPersonaForMessage(messageId: string): ThreadInfo | undefined {
  return tracker.get(messageId);
}
