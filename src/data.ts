import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { CampusLocation, DirectoryCache, ParkingType, ResolveIssue } from "./types.js";

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");

export async function loadDirectoryCache(): Promise<DirectoryCache> {
  const filePath = path.join(dataDir, "directory_cache.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as DirectoryCache;
}

export async function loadCampusLocations(): Promise<CampusLocation[]> {
  const filePath = path.join(dataDir, "campus_locations.csv");
  const raw = await fs.readFile(filePath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  return rows.map(campusLocationFromCsvRow);
}

function parsePipeList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
}

function parseParkingType(value: string | undefined): ParkingType {
  const normalized = (value ?? "unknown").toLowerCase().trim();
  if (["lot", "street", "mixed", "unknown"].includes(normalized)) {
    return normalized as ParkingType;
  }
  return "unknown";
}

function parseBoolean(value: string | undefined): boolean {
  return (value ?? "").toLowerCase().trim() === "true";
}

function parseNumber(value: string, fieldName: string): number {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid number for ${fieldName}: ${value}`);
  }
  return n;
}

function campusLocationFromCsvRow(row: Record<string, string>): CampusLocation {
  return {
    aliases: parsePipeList(row.aliases),
    displayOfficePrefix: row.displayOfficePrefix,
    campusDisplayName: row.campusDisplayName,
    buildingCode: row.buildingCode,
    buildingDisplayName: row.buildingDisplayName,
    recommendedParkingLabel: row.recommendedParkingLabel,
    parkingType: parseParkingType(row.parkingType),
    parkingRefs: parsePipeList(row.parkingRefs),
    parkingStreetRefs: parsePipeList(row.parkingStreetRefs),
    buildingLat: parseNumber(row.buildingLat, "buildingLat"),
    buildingLng: parseNumber(row.buildingLng, "buildingLng"),
    parkingLat: parseNumber(row.parkingLat, "parkingLat"),
    parkingLng: parseNumber(row.parkingLng, "parkingLng"),
    roomRanges: row.roomRanges,
    hasElevator: parseBoolean(row.hasElevator),
    hasStairs: parseBoolean(row.hasStairs),
    locationVerifiedAt: row.locationVerifiedAt || undefined,
    verticalAccessNotes: row.verticalAccessNotes || undefined,
    notes: row.notes || undefined
  };
}

export async function appendResolveIssue(issue: Omit<ResolveIssue, "createdAt">): Promise<void> {
  const filePath = path.join(dataDir, "resolve_issues.json");
  let existing: ResolveIssue[] = [];

  try {
    const raw = await fs.readFile(filePath, "utf8");
    existing = JSON.parse(raw) as ResolveIssue[];
  } catch {
    existing = [];
  }

  existing.push({
    ...issue,
    createdAt: new Date().toISOString()
  });

  await fs.writeFile(filePath, JSON.stringify(existing, null, 2));
}
