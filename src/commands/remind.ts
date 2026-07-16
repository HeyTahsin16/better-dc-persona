import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { SlashCommand } from './types';
import { Role } from '../types';
import { addReminder, listRemindersFor, removeReminder, setUserTimezone, getUserTimezone } from '../store/reminderStore';
import { isValidTimezone } from '../utils/time';
import { searchPersonas, getPersona, isValidPersonaId, listVersions } from '../personas';
import { resolvePersonaForUser } from '../ai/promptBuilder';
import { hasRole } from '../permissions/roles';
import { replyChunked } from '../utils/interactionReply';

function parseTime(input: string): { hour: number; minute: number } | null {
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return { hour, minute };
}

// Common suggested times shown via autocomplete — the field still accepts any free-typed
// value like "14:37", these are just quick-pick shortcuts.
const TIME_SUGGESTIONS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM', '12:00 AM',
];

export const remindCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Schedule the bot to mention you at a specific time (only for yourself)')
    .addSubcommand(s => s.setName('set').setDescription('Create a reminder')
      .addStringOption(o => o.setName('time').setDescription('Time — pick a suggestion or type your own, e.g. 8:00am, 20:00').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('message').setDescription('What to say/ask').setRequired(true))
      .addStringOption(o => o.setName('repeat').setDescription('Once or every day (default: once)')
        .addChoices({ name: 'Once', value: 'once' }, { name: 'Daily', value: 'daily' }))
      .addStringOption(o => o.setName('persona').setDescription('Who delivers it (default: your current persona)').setAutocomplete(true))
      .addStringOption(o => {
        o.setName('persona-version').setDescription('Optional: browse only personas added in a specific version first');
        for (const v of listVersions()) o.addChoices({ name: v, value: v });
        return o;
      })
      .addChannelOption(o => o.setName('channel').setDescription('Channel to mention you in (default: DM)').addChannelTypes(ChannelType.GuildText))
      .addBooleanOption(o => o.setName('ai-flavor').setDescription('Let the persona phrase it in character instead of sending it literally (default: off)')))
    .addSubcommand(s => s.setName('list').setDescription('List your reminders'))
    .addSubcommand(s => s.setName('cancel').setDescription('Cancel one of your reminders')
      .addStringOption(o => o.setName('id').setDescription('Reminder ID from /remind list').setRequired(true)))
    .addSubcommand(s => s.setName('timezone').setDescription('Set your timezone for reminders')
      .addStringOption(o => o.setName('tz').setDescription('IANA timezone, e.g. Asia/Dhaka, America/New_York').setRequired(true))),

  minRole: Role.USER,

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'persona') {
      const version = interaction.options.getString('persona-version') ?? undefined;
      const matches = searchPersonas(String(focused.value), version);
      await interaction.respond(matches.map(p => ({ name: `${p.name} (${p.source})`, value: p.id })));
      return;
    }
    if (focused.name === 'time') {
      const q = String(focused.value).toLowerCase();
      const matches = TIME_SUGGESTIONS.filter(t => t.toLowerCase().includes(q)).slice(0, 25);
      await interaction.respond(matches.map(t => ({ name: t, value: t })));
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'timezone') {
      if (!hasRole(userId, Role.ADMIN)) {
        await interaction.reply({ content: 'Setting a timezone requires Admin access.', ephemeral: true });
        return;
      }
      const tz = interaction.options.getString('tz', true);
      if (!isValidTimezone(tz)) {
        await interaction.reply({ content: `"${tz}" isn't a recognized IANA timezone (e.g. \`Asia/Dhaka\`, \`America/New_York\`, \`Europe/London\`).`, ephemeral: true });
        return;
      }
      setUserTimezone(userId, tz);
      await interaction.reply({ content: `Timezone set to \`${tz}\`.`, ephemeral: true });
      return;
    }

    if (sub === 'list') {
      const reminders = listRemindersFor(userId);
      if (!reminders.length) { await interaction.reply({ content: 'You have no reminders set.', ephemeral: true }); return; }
      const tz = getUserTimezone(userId);
      const lines = reminders.map(r => {
        const persona = getPersona(r.personaId);
        return `\`${r.id}\` — ${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')} (${r.timezone}) · ${r.repeat} · **${persona?.name ?? r.personaId}** — "${r.message}"${r.channelId ? ` in <#${r.channelId}>` : ' via DM'}`;
      });
      await replyChunked(interaction, `**Your reminders** (your timezone: \`${tz}\`):\n${lines.join('\n')}`);
      return;
    }

    if (sub === 'cancel') {
      const id = interaction.options.getString('id', true);
      const removed = removeReminder(userId, id);
      await interaction.reply({ content: removed ? `🗑️ Reminder \`${id}\` cancelled.` : `❌ No reminder with ID \`${id}\` found for you.`, ephemeral: true });
      return;
    }

    // set
    const timeStr = interaction.options.getString('time', true);
    const message = interaction.options.getString('message', true);
    const repeat = (interaction.options.getString('repeat') || 'once') as 'once' | 'daily';
    const channel = interaction.options.getChannel('channel');
    const aiFlavor = interaction.options.getBoolean('ai-flavor') ?? false;
    const personaOption = interaction.options.getString('persona');

    const parsed = parseTime(timeStr);
    if (!parsed) {
      await interaction.reply({ content: `❌ Couldn't parse "${timeStr}". Try formats like \`8:00am\`, \`20:00\`, or \`9:30pm\` — or pick one of the suggestions.`, ephemeral: true });
      return;
    }

    if (personaOption && !isValidPersonaId(personaOption)) {
      await interaction.reply({ content: `❌ Unknown persona \`${personaOption}\` — try searching again with the autocomplete list.`, ephemeral: true });
      return;
    }
    const persona = personaOption ? getPersona(personaOption)! : resolvePersonaForUser(userId);

    const timezone = getUserTimezone(userId);
    const reminder = addReminder({
      userId, message, hour: parsed.hour, minute: parsed.minute, repeat,
      timezone, channelId: channel?.id ?? null, personaId: persona.id, aiFlavor,
    });

    await interaction.reply({
      content:
        `✅ Reminder set for **${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}** (\`${timezone}\`), ${repeat}, delivered by **${persona.name}**. ID: \`${reminder.id}\`\n` +
        `Set the wrong timezone? Use \`/remind timezone\` — it applies to future reminders.`,
      ephemeral: true,
    });
  },
};
