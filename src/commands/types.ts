import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { Role } from '../types';

export type AnySlashBuilder = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
  data: AnySlashBuilder;
  minRole: Role;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  // Optional — only needed by commands with a `.setAutocomplete(true)` option (e.g.
  // persona pickers, reminder time suggestions). Discord calls this as the user types.
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
