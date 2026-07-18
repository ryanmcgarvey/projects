// Save adapter. Swapping to server-side persistence replaces this file.
export function save(room: string, raw: string) {
  try { localStorage.setItem(`starmoor-save-${room}`, raw) } catch { /* storage full — acceptable */ }
}

export function load(room: string): string | null {
  try { return localStorage.getItem(`starmoor-save-${room}`) } catch { return null }
}
