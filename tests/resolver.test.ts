import assert from "node:assert/strict";
import { loadCampusLocations, loadDirectoryCache } from "../src/data.js";
import { handleUserSearch } from "../src/resolver.js";

const directory = await loadDirectoryCache();
const locations = await loadCampusLocations();

assert.equal(locations.length, 3, "campus_locations.csv should have one row per building, not one row per alias");
assert.deepEqual(
  locations.find(location => location.buildingCode === "T")?.aliases,
  ["MC-T", "T", "TECH", "Technical Center", "T-Building"],
  "T-Building aliases should be stored on one building row"
);

async function expectResolved(query: string, expectedRoom: string, expectedFloorIncludes: string) {
  const result = await handleUserSearch(query, directory, locations);
  assert.equal(result.type, "resolved", `${query} should resolve`);
  if (result.type !== "resolved") return;
  assert.equal(result.parsedRoom.displayRoom, expectedRoom);
  assert.ok(result.parsedRoom.floorLabel.includes(expectedFloorIncludes), `${query} floor should include ${expectedFloorIncludes}`);
}

await expectResolved("Pamela Dunn", "MC-T 1063", "ground");
await expectResolved("T1063", "MC-T 1063", "ground");
await expectResolved("t-1063", "MC-T 1063", "ground");
await expectResolved("MC-T 1063", "MC-T 1063", "ground");
await expectResolved("TECH1063", "MC-T 1063", "ground");
await expectResolved("T0063", "MC-T 0063", "basement");
await expectResolved("T2063", "MC-T 2063", "second");

const outOfRange = await handleUserSearch("T9999", directory, locations);
assert.equal(outOfRange.type, "resolved");
if (outOfRange.type === "resolved") {
  assert.equal(outOfRange.confidence.roomInKnownRange, false);
}

const unknownBuilding = await handleUserSearch("Z1063", directory, locations);
assert.equal(unknownBuilding.type, "partial");

const fuzzy = await handleUserSearch("pam dun", directory, locations);
assert.ok(["resolved", "did-you-mean"].includes(fuzzy.type));

const ambiguousName = await handleUserSearch("pam", directory, locations);
assert.equal(ambiguousName.type, "did-you-mean");

const ambiguousRoom = await handleUserSearch("1063", directory, locations);
assert.equal(ambiguousRoom.type, "ambiguous-room");

console.log("All resolver tests passed.");
