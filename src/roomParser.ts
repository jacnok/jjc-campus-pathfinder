import type { ParsedRoomLocation } from "./types.js";

export function normalizeSearchInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\bROOM\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRoomLocation(raw: string): ParsedRoomLocation {
  const normalized = normalizeSearchInput(raw);

  // Handles MC-T 1063, MC-T-1063, T-1063, T 1063, T1063, t1063, TECH1063.
  // Campus prefixes require a dash or space so TECH1063 is parsed as building TECH, not campus TE + building CH.
  const roomPattern = /\b(?:(?<campus>[A-Z]{2})[-\s]+)?(?<building>[A-Z]{1,6})[-\s]?(?<room>\d{3,5}[A-Z]?)\b/i;
  const match = normalized.match(roomPattern);

  if (!match?.groups) {
    return { raw, normalized, campusPrefix: null, buildingAlias: null, roomNumber: null };
  }

  return {
    raw,
    normalized,
    campusPrefix: match.groups.campus ?? null,
    buildingAlias: match.groups.building,
    roomNumber: match.groups.room
  };
}

export function parseRoomNumberOnly(raw: string): string | null {
  const normalized = normalizeSearchInput(raw);
  const match = normalized.match(/^\d{3,5}[A-Z]?$/i);
  return match ? normalized : null;
}
