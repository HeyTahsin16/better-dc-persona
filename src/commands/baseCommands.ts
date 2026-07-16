import { SlashCommand } from './types';

import { imagineCommand } from './imagine';
import { analyzeCommand } from './analyze';
import { memoryCommand } from './memory';
import { logsCommand } from './logs';
import { statusCommand } from './status';
import { personaCommand } from './persona';
import { myPersonaCommand } from './myPersona';
import { clearCommand } from './clear';
import { triggerCommand } from './trigger';
import { authCommand } from './auth';
import { providerCommand } from './provider';
import { imgProviderCommand } from './imgprovider';
import { reloadCommand } from './reload';
import { remindCommand } from './remind';
import { welcomeCommand } from './welcome';
import { affectionCommand } from './affection';
import { openChannelCommand } from './openChannel';

// Everything except /help lives here. /help needs to list all of these, and
// registry.ts needs both this list and /help — keeping /help itself out of this
// array (registry.ts appends it separately) avoids a circular import between
// registry.ts and help.ts.
export const baseCommands: SlashCommand[] = [
  imagineCommand,
  analyzeCommand,
  memoryCommand,
  logsCommand,
  statusCommand,
  personaCommand,
  myPersonaCommand,
  clearCommand,
  triggerCommand,
  authCommand,
  providerCommand,
  imgProviderCommand,
  reloadCommand,
  remindCommand,
  welcomeCommand,
  affectionCommand,
  openChannelCommand,
];
