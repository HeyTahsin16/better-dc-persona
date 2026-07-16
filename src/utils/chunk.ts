export function chunkText(text: string, size = 1990): string[] {
  const clean = text && text.length ? text : '(empty response)';
  const chunks = clean.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g'));
  return chunks && chunks.length ? chunks : ['(empty response)'];
}
