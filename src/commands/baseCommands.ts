import { SlashCommand } from './types';

import { imageCommand } from './image';
import { memoryCommand } from './memory';
import { logsCommand } from './logs';
import { statusCommand } from './status';
import { personaCommand } from './persona';
import { clearCommand } from './clear';
import { triggerCommand } from './trigger';
import { authCommand } from './auth';
import { providerCommand } from './provider';
import { reloadCommand } from './reload';
import { remindCommand } from './remind';
import { welcomeCommand } from './welcome';
import { affectionCommand } from './affection';
import { openChannelCommand } from './openChannel';

// Everything except /help lives here. /help needs to list all of these, and
// registry.ts needs both this list and /help — keeping /help itself out of this
// array (registry.ts appends it separately) avoids a circular import between
// registry.ts and help.ts.
//
// As of v3.8: /imagine + /analyze merged into /image; /imgprovider folded into
// /provider (as an "image" subcommand group); /mypersona folded into /persona
// (as a "my" subcommand group). See README changelog for the reasoning — in
// short, each pair was doing the same *type* of thing (pick a provider, pick a
// persona, do something with an image) under two separate top-level commands
// for no real reason other than history.
export const baseCommands: SlashCommand[] = [
  imageCommand,
  memoryCommand,
  logsCommand,
  statusCommand,
  personaCommand,
  clearCommand,
  triggerCommand,
  authCommand,
  providerCommand,
  reloadCommand,
  remindCommand,
  welcomeCommand,
  affectionCommand,
  openChannelCommand,
];
