import { Client, TextChannel, NewsChannel } from 'discord.js';
import { listAllReminders, markFired, deleteReminderById } from '../store/reminderStore';
import { getCurrentTimeInZone } from '../utils/time';
import { completeOneShot } from '../ai/chatRouter';
import { buildSystemPrompt, getActivePersona } from '../ai/promptBuilder';
import { getPersona } from '../personas';
import { resolveEmojis } from '../emoji/appEmojis';
import { sendAsPersona } from '../webhooks/webhookManager';
import { logger } from '../logger';
import { Reminder } from '../types';

const TICK_INTERVAL_MS = 30_000; // check every 30 seconds — cheap and precise enough for minute-granularity reminders

function isWebhookCapable(channel: unknown): channel is TextChannel | NewsChannel {
  return channel instanceof TextChannel || channel instanceof NewsChannel;
}

async function fireReminder(client: Client, reminder: Reminder): Promise<void> {
  const user = await client.users.fetch(reminder.userId).catch(() => null);
  const username = user?.username ?? 'there';
  const persona = getPersona(reminder.personaId) ?? getActivePersona();

  let text = reminder.message;
  if (reminder.aiFlavor) {
    try {
      const systemPrompt = buildSystemPrompt(reminder.userId, username, persona);
      const prompt =
        `Send a short, in-character reminder message to ${username} with this note in mind: "${reminder.message}". ` +
        'Keep it to 1-2 sentences and make it feel personal, not generic.';
      text = await completeOneShot(prompt, systemPrompt);
    } catch (err) {
      logger.warn(`AI reminder generation failed for ${reminder.id}, using literal message`, err);
    }
  }
  text = resolveEmojis(text);

  try {
    if (reminder.channelId) {
      const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
      if (isWebhookCapable(channel)) {
        const sent = await sendAsPersona(channel, persona, text, reminder.userId);
        if (sent) return;
      }
      if (channel?.isTextBased() && 'send' in channel) {
        await (channel as TextChannel).send(`<@${reminder.userId}> ${text}`);
        return;
      }
    }
    if (user) await user.send(text);
  } catch (err) {
    logger.error(`Failed to deliver reminder ${reminder.id}`, err);
  }
}

export function startReminderScheduler(client: Client): void {
  setInterval(() => {
    void (async () => {
      const reminders = listAllReminders();
      for (const r of reminders) {
        const { hour, minute, dateStr } = getCurrentTimeInZone(r.timezone);
        if (hour === r.hour && minute === r.minute && r.lastFiredOn !== dateStr) {
          logger.info(`Firing reminder ${r.id} for user ${r.userId}`);
          await fireReminder(client, r);
          markFired(r.id, dateStr);
          if (r.repeat === 'once') deleteReminderById(r.id);
        }
      }
    })();
  }, TICK_INTERVAL_MS);
  logger.info('Reminder scheduler started (checking every 30s)');
}
