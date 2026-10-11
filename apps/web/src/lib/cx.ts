/** Junta nomes de classe CSS, ignorando valores falsos (uso condicional). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
