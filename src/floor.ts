import type { CampusLocation, FloorInfo } from "./types.js";

export function getFloorInfo(roomNumber: string): FloorInfo {
  const numericRoom = Number.parseInt(roomNumber, 10);

  if (Number.isNaN(numericRoom)) {
    return {
      floorNumber: null,
      floorLabel: "unknown floor",
      accessType: "unknown",
      accessMessage: "I could not determine the floor from this room number."
    };
  }

  if (numericRoom >= 0 && numericRoom <= 999) {
    return {
      floorNumber: 0,
      floorLabel: "basement / lower level",
      accessType: "vertical-access-needed",
      accessMessage: "This room appears to be on the basement / lower level, so you may need to use stairs or an elevator."
    };
  }

  if (numericRoom >= 1000 && numericRoom <= 1999) {
    return {
      floorNumber: 1,
      floorLabel: "ground / first floor",
      accessType: "ground",
      accessMessage: "This room appears to be on the ground / first floor."
    };
  }

  const floorNumber = Math.floor(numericRoom / 1000);
  const floorLabel = getOrdinalFloorLabel(floorNumber);

  return {
    floorNumber,
    floorLabel,
    accessType: "vertical-access-needed",
    accessMessage: `This room appears to be on the ${floorLabel}, so you may need to use stairs or an elevator.`
  };
}

function getOrdinalFloorLabel(floorNumber: number): string {
  const labels: Record<number, string> = {
    2: "second floor",
    3: "third floor",
    4: "fourth floor",
    5: "fifth floor",
    6: "sixth floor"
  };
  return labels[floorNumber] ?? `${floorNumber}th floor`;
}

export function getAccessMessage(roomNumber: string, location: CampusLocation): string {
  const floorInfo = getFloorInfo(roomNumber);

  if (floorInfo.accessType === "ground") return `This room appears to be on the ${floorInfo.floorLabel}.`;
  if (floorInfo.accessType === "unknown") return floorInfo.accessMessage;

  if (location.hasElevator && location.hasStairs) {
    return `This room appears to be on the ${floorInfo.floorLabel}. Elevator and stair access should be available.`;
  }

  if (location.hasElevator && !location.hasStairs) {
    return `This room appears to be on the ${floorInfo.floorLabel}. Elevator access should be available.`;
  }

  if (!location.hasElevator && location.hasStairs) {
    return `This room appears to be on the ${floorInfo.floorLabel}. Stair access should be available.`;
  }

  return `This room appears to be on the ${floorInfo.floorLabel}. I do not have confirmed elevator or stair access details for this building yet.`;
}
