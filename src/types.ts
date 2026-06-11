export type ParkingType = "lot" | "street" | "mixed" | "unknown";

export type DirectoryPerson = {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  rawLocation?: string;
};

export type DirectoryCache = {
  pulledAt: string;
  people: DirectoryPerson[];
};

export type CampusLocation = {
  /** One row per building. Aliases are expanded into an in-memory lookup index at runtime. */
  aliases: string[];
  displayOfficePrefix: string;
  campusDisplayName: string;
  buildingCode: string;
  buildingDisplayName: string;
  recommendedParkingLabel: string;
  parkingType: ParkingType;
  parkingRefs: string[];
  parkingStreetRefs: string[];
  buildingLat: number;
  buildingLng: number;
  parkingLat: number;
  parkingLng: number;
  roomRanges: string;
  hasElevator: boolean;
  hasStairs: boolean;
  locationVerifiedAt?: string;
  verticalAccessNotes?: string;
  notes?: string;
};

export type ParsedRoomLocation = {
  raw: string;
  normalized: string;
  campusPrefix: string | null;
  buildingAlias: string | null;
  roomNumber: string | null;
};

export type FloorAccessType = "ground" | "vertical-access-needed" | "unknown";

export type FloorInfo = {
  floorNumber: number | null;
  floorLabel: string;
  accessType: FloorAccessType;
  accessMessage: string;
};

export type ResolveIssueType =
  | "person-not-found"
  | "location-missing"
  | "building-alias-unmapped"
  | "room-out-of-range"
  | "ambiguous-name"
  | "ambiguous-room";

export type ResolveIssue = {
  query: string;
  issueType: ResolveIssueType;
  rawLocation?: string;
  createdAt: string;
};

export type NameSearchResult = {
  person: DirectoryPerson;
  score: number;
};

export type ResolvedCampusResult = {
  type: "resolved";
  query: string;
  queryType: "person" | "room";
  person?: DirectoryPerson;
  rawLocation: string;
  parsedRoom: {
    displayRoom: string;
    buildingCode: string;
    roomNumber: string;
    floorLabel: string;
    accessMessage: string;
  };
  campusLocation: {
    campusDisplayName: string;
    buildingDisplayName: string;
    recommendedParkingLabel: string;
    parkingMessage: string;
    buildingMarker: { lat: number; lng: number };
    parkingMarker: { lat: number; lng: number };
  };
  confidence: {
    buildingMatched: boolean;
    roomInKnownRange: boolean;
    personMatched?: boolean;
  };
  metadata: {
    directoryPulledAt?: string;
    locationVerifiedAt?: string;
    timestampText: string;
  };
  message: string;
};

export type DidYouMeanResult = {
  type: "did-you-mean";
  query: string;
  suggestions: Array<{
    id: string;
    fullName: string;
    title?: string;
    department?: string;
    rawLocation?: string;
    score?: number;
  }>;
};

export type NoMatchResult = {
  type: "no-match";
  query: string;
  message: string;
};

export type AmbiguousRoomResult = {
  type: "ambiguous-room";
  query: string;
  roomNumber: string;
  suggestions: Array<{
    displayRoom: string;
    campusDisplayName: string;
    buildingDisplayName: string;
    recommendedParkingLabel: string;
  }>;
  message: string;
};

export type PartialResult = {
  type: "partial";
  query: string;
  rawLocation: string;
  message: string;
};

export type SearchResponse =
  | ResolvedCampusResult
  | DidYouMeanResult
  | NoMatchResult
  | AmbiguousRoomResult
  | PartialResult;
