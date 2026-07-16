import { readJSON, writeJSON } from './json';
import { REMINDERS_PATH } from '../constants';
import { Reminder, ReminderStoreShape } from '../types';
import { env } from '../env';

function load(): ReminderStoreShape {
  return readJSON<ReminderStoreShape>(REMINDERS_PATH, { reminders: [], userTimezones: {} });
}
function save(store: ReminderStoreShape): void {
  writeJSON(REMINDERS_PATH, store);
}

export function getUserTimezone(userId: string): string {
  const store = load();
  return store.userTimezones[userId] || env.DEFAULT_TIMEZONE;
}

export function setUserTimezone(userId: string, timezone: string): void {
  const store = load();
  store.userTimezones[userId] = timezone;
  save(store);
}

export function listRemindersFor(userId: string): Reminder[] {
  return load().reminders.filter(r => r.userId === userId);
}

export function listAllReminders(): Reminder[] {
  return load().reminders;
}

export function addReminder(r: Omit<Reminder, 'id' | 'createdAt' | 'lastFiredOn'>): Reminder {
  const store = load();
  const reminder: Reminder = {
    ...r,
    id: Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    lastFiredOn: null,
  };
  store.reminders.push(reminder);
  save(store);
  return reminder;
}

export function removeReminder(userId: string, id: string): boolean {
  const store = load();
  const idx = store.reminders.findIndex(r => r.id === id && r.userId === userId);
  if (idx === -1) return false;
  store.reminders.splice(idx, 1);
  save(store);
  return true;
}

export function markFired(id: string, dateStr: string): void {
  const store = load();
  const r = store.reminders.find(x => x.id === id);
  if (!r) return;
  r.lastFiredOn = dateStr;
  save(store);
}

export function deleteReminderById(id: string): void {
  const store = load();
  store.reminders = store.reminders.filter(r => r.id !== id);
  save(store);
}
