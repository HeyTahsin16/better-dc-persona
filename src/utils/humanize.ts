// Turns a model slug like "gemini-2.5-flash-lite" into "Gemini 2.5 Flash Lite" for
// display as a webhook username. Segments starting with a digit (version numbers)
// are left as-is; word segments get their first letter capitalized.
export function humanizeModelName(model: string): string {
  return model
    .split('-')
    .map(part => (/^[a-zA-Z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}
