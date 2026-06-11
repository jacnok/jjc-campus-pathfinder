import type {
  CampusLocation,
  DirectoryCache,
  DirectoryPerson,
  ParsedRoomLocation,
  SearchResponse
} from "./types.js";
import { getAccessMessage, getFloorInfo } from "./floor.js";
import { searchPeopleByNameFuzzy, shouldAutoSelectName } from "./nameSearch.js";
import { parseRoomLocation, parseRoomNumberOnly } from "./roomParser.js";
import { appendResolveIssue } from "./data.js";

type RoomRange = { start: number; end: number };

export async function handleUserSearch(
  input: string,
  directory: DirectoryCache,
  locations: CampusLocation[]
): Promise<SearchResponse> {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      type: "no-match",
      query: input,
      message: "Enter a person name or room number."
    };
  }

  const roomOnly = parseRoomNumberOnly(trimmedInput);
  if (roomOnly) {
    return resolveRoomNumberOnly(trimmedInput, roomOnly, locations);
  }

  const parsedRoom = parseRoomLocation(trimmedInput);
  if (parsedRoom.buildingAlias && parsedRoom.roomNumber) {
    return resolveParsedRoom(trimmedInput, parsedRoom, locations, directory.pulledAt, "room");
  }

  const nameResults = searchPeopleByNameFuzzy(trimmedInput, directory.people, 5);

  if (nameResults.length === 0) {
    await appendResolveIssue({ query: trimmedInput, issueType: "person-not-found" });
    return {
      type: "no-match",
      query: trimmedInput,
      message: `I could not find anyone close to "${trimmedInput}".`
    };
  }

  if (shouldAutoSelectName(nameResults)) {
    return resolvePerson(trimmedInput, nameResults[0].person, directory.pulledAt, locations);
  }

  await appendResolveIssue({ query: trimmedInput, issueType: "ambiguous-name" });

  return {
    type: "did-you-mean",
    query: trimmedInput,
    suggestions: nameResults.map(({ person, score }) => ({
      id: person.id,
      fullName: person.fullName,
      title: person.title,
      department: person.department,
      rawLocation: person.rawLocation,
      score
    }))
  };
}

export async function resolvePersonById(
  personId: string,
  directory: DirectoryCache,
  locations: CampusLocation[]
): Promise<SearchResponse> {
  const person = directory.people.find(p => p.id === personId);
  if (!person) {
    return {
      type: "no-match",
      query: personId,
      message: `I could not find a person with id "${personId}".`
    };
  }

  return resolvePerson(person.fullName, person, directory.pulledAt, locations);
}

async function resolvePerson(
  query: string,
  person: DirectoryPerson,
  directoryPulledAt: string,
  locations: CampusLocation[]
): Promise<SearchResponse> {
  if (!person.rawLocation) {
    await appendResolveIssue({ query, issueType: "location-missing" });
    return {
      type: "partial",
      query,
      rawLocation: "",
      message: `I found ${person.fullName}, but their office location was not listed in the directory data.`
    };
  }

  const parsedRoom = parseRoomLocation(person.rawLocation);

  if (!parsedRoom.buildingAlias || !parsedRoom.roomNumber) {
    await appendResolveIssue({ query, issueType: "building-alias-unmapped", rawLocation: person.rawLocation });
    return {
      type: "partial",
      query,
      rawLocation: person.rawLocation,
      message: `I found ${person.fullName}, but I could not parse the office location "${person.rawLocation}".`
    };
  }

  return resolveParsedRoom(query, parsedRoom, locations, directoryPulledAt, "person", person);
}

async function resolveRoomNumberOnly(
  query: string,
  roomNumber: string,
  locations: CampusLocation[]
): Promise<SearchResponse> {
  const uniqueBuildings = uniqueLocationsByBuilding(locations);
  const matches = uniqueBuildings.filter(location => isRoomInRange(roomNumber, parseRoomRanges(location.roomRanges)));

  if (matches.length === 0) {
    await appendResolveIssue({ query, issueType: "ambiguous-room" });
    return {
      type: "no-match",
      query,
      message: `I found room number "${roomNumber}", but I could not match it to a known building range without a building prefix.`
    };
  }

  if (matches.length === 1) {
    const location = matches[0];
    const parsed: ParsedRoomLocation = {
      raw: query,
      normalized: query.toUpperCase(),
      campusPrefix: null,
      buildingAlias: location.buildingCode,
      roomNumber
    };
    return buildResolvedResult(query, parsed, location, undefined, undefined, "room");
  }

  await appendResolveIssue({ query, issueType: "ambiguous-room" });
  return {
    type: "ambiguous-room",
    query,
    roomNumber,
    message: `Room ${roomNumber} may exist in multiple buildings. Which one do you mean?`,
    suggestions: matches.map(location => ({
      displayRoom: `${location.displayOfficePrefix} ${roomNumber}`,
      campusDisplayName: location.campusDisplayName,
      buildingDisplayName: location.buildingDisplayName,
      recommendedParkingLabel: location.recommendedParkingLabel
    }))
  };
}

async function resolveParsedRoom(
  query: string,
  parsedRoom: ParsedRoomLocation,
  locations: CampusLocation[],
  directoryPulledAt: string | undefined,
  queryType: "person" | "room",
  person?: DirectoryPerson
): Promise<SearchResponse> {
  const location = findCampusLocationFromParsedRoom(parsedRoom, locations);

  if (!location) {
    await appendResolveIssue({ query, issueType: "building-alias-unmapped", rawLocation: parsedRoom.raw });
    return {
      type: "partial",
      query,
      rawLocation: parsedRoom.raw,
      message: `I found this location text: "${parsedRoom.raw}", but I do not have ${parsedRoom.buildingAlias} mapped to a known campus building yet.`
    };
  }

  return buildResolvedResult(query, parsedRoom, location, directoryPulledAt, person, queryType);
}

function buildResolvedResult(
  query: string,
  parsedRoom: ParsedRoomLocation,
  location: CampusLocation,
  directoryPulledAt: string | undefined,
  person: DirectoryPerson | undefined,
  queryType: "person" | "room"
): SearchResponse {
  const roomNumber = parsedRoom.roomNumber ?? "";
  const displayRoom = `${location.displayOfficePrefix} ${roomNumber}`;
  const ranges = parseRoomRanges(location.roomRanges);
  const roomInKnownRange = roomNumber ? isRoomInRange(roomNumber, ranges) : false;
  const floorInfo = getFloorInfo(roomNumber);
  const accessMessage = getAccessMessage(roomNumber, location);
  const parkingMessage = formatParkingMessage(location);

  const subject = person ? displayPersonNameForMessage(person) : `Room ${displayRoom}`;
  const firstSentence = person
    ? `${subject}'s office is listed in ${displayRoom}.`
    : `${displayRoom} resolves to ${location.campusDisplayName}, ${location.buildingDisplayName}.`;

  const rangeSentence = roomInKnownRange
    ? ""
    : ` I recognize ${location.buildingDisplayName}, but room ${roomNumber} is outside the known room range for that building.`;

  const message = [
    firstSentence,
    `This means you're headed to the ${location.campusDisplayName}, ${location.buildingDisplayName}, room ${roomNumber}.`,
    accessMessage,
    parkingMessage,
    `Here is the building marker and parking marker.${rangeSentence}`
  ].join(" ");

  return {
    type: "resolved",
    query,
    queryType,
    person,
    rawLocation: parsedRoom.raw,
    parsedRoom: {
      displayRoom,
      buildingCode: location.buildingCode,
      roomNumber,
      floorLabel: floorInfo.floorLabel,
      accessMessage
    },
    campusLocation: {
      campusDisplayName: location.campusDisplayName,
      buildingDisplayName: location.buildingDisplayName,
      recommendedParkingLabel: location.recommendedParkingLabel,
      parkingMessage,
      buildingMarker: { lat: location.buildingLat, lng: location.buildingLng },
      parkingMarker: { lat: location.parkingLat, lng: location.parkingLng }
    },
    confidence: {
      buildingMatched: true,
      roomInKnownRange,
      personMatched: Boolean(person)
    },
    metadata: {
      directoryPulledAt,
      locationVerifiedAt: location.locationVerifiedAt,
      timestampText: formatTimestampText(directoryPulledAt, location.locationVerifiedAt)
    },
    message
  };
}

function displayPersonNameForMessage(person: DirectoryPerson): string {
  if (person.title && /professor/i.test(person.title)) {
    return `Professor ${person.lastName ?? person.fullName.split(" ").at(-1) ?? person.fullName}`;
  }
  return person.fullName;
}

function findCampusLocationFromParsedRoom(
  parsed: ParsedRoomLocation,
  locations: CampusLocation[]
): CampusLocation | null {
  if (!parsed.buildingAlias) return null;

  const possibleAliases = new Set<string>();
  possibleAliases.add(parsed.buildingAlias.toUpperCase());

  if (parsed.campusPrefix) {
    possibleAliases.add(`${parsed.campusPrefix}-${parsed.buildingAlias}`.toUpperCase());
  }

  // Build an in-memory alias index from the one-row-per-building CSV.
  // Longer aliases are checked first so MC-T is preferred before T when both are possible.
  const aliasIndex = buildAliasIndex(locations);
  return aliasIndex.find(entry => possibleAliases.has(entry.alias))?.location ?? null;
}

function buildAliasIndex(locations: CampusLocation[]): Array<{ alias: string; location: CampusLocation }> {
  return locations
    .flatMap(location =>
      location.aliases.map(alias => ({
        alias: alias.toUpperCase(),
        location
      }))
    )
    .sort((a, b) => b.alias.length - a.alias.length);
}

function parseRoomRanges(value: string): RoomRange[] {
  if (!value.trim()) return [];

  return value.split("|").map(part => {
    const [startRaw, endRaw] = part.split("-");
    const start = Number.parseInt(startRaw, 10);
    const end = Number.parseInt(endRaw, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new Error(`Invalid room range: ${part}`);
    }
    return { start, end };
  });
}

function isRoomInRange(roomNumber: string, ranges: RoomRange[]): boolean {
  const numericRoom = Number.parseInt(roomNumber, 10);
  if (Number.isNaN(numericRoom)) return false;
  return ranges.some(range => numericRoom >= range.start && numericRoom <= range.end);
}

function uniqueLocationsByBuilding(locations: CampusLocation[]): CampusLocation[] {
  const seen = new Set<string>();
  const result: CampusLocation[] = [];

  for (const location of locations) {
    if (!seen.has(location.buildingCode)) {
      seen.add(location.buildingCode);
      result.push(location);
    }
  }

  return result;
}

function formatParkingMessage(location: CampusLocation): string {
  switch (location.parkingType) {
    case "lot":
      return `Recommended parking is ${location.recommendedParkingLabel}.`;
    case "street":
      return `Recommended parking/access is near ${location.recommendedParkingLabel}.`;
    case "mixed":
      return `Recommended parking is ${location.recommendedParkingLabel}.`;
    default:
      return "Recommended parking information is not confirmed yet.";
  }
}

function formatTimestampText(directoryPulledAt?: string, locationVerifiedAt?: string): string {
  if (directoryPulledAt && locationVerifiedAt) {
    return `These results were based on directory data pulled on ${formatDateTime(directoryPulledAt)}. Campus location data was verified on ${formatDateOnly(locationVerifiedAt)}.`;
  }

  if (directoryPulledAt) {
    return `These results were based on data pulled on ${formatDateTime(directoryPulledAt)}.`;
  }

  if (locationVerifiedAt) {
    return `Campus location data was verified on ${formatDateOnly(locationVerifiedAt)}.`;
  }

  return "Timestamp metadata is not available for this result.";
}

function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(isoTimestamp));
}

function formatDateOnly(dateValue: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(`${dateValue}T12:00:00`));
}
