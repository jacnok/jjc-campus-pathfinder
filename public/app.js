const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const resultEl = document.querySelector("#result");

const map = L.map("map").setView([41.5005, -88.1805], 16);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let markerLayer = L.layerGroup().addTo(map);

form.addEventListener("submit", async event => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  await runSearch(query);
});

async function runSearch(query) {
  resultEl.innerHTML = `<p>Searching...</p>`;
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const result = await response.json();
  renderResult(result);
}

async function resolvePerson(id) {
  resultEl.innerHTML = `<p>Resolving selection...</p>`;
  const response = await fetch(`/api/person/${encodeURIComponent(id)}`);
  const result = await response.json();
  renderResult(result);
}

function renderResult(result) {
  markerLayer.clearLayers();

  if (result.type === "resolved") {
    renderResolved(result);
    renderMarkers(result);
    return;
  }

  if (result.type === "did-you-mean") {
    resultEl.innerHTML = `
      <p class="result-title">Did you mean one of these?</p>
      <p>I found multiple possible matches for “${escapeHtml(result.query)}”.</p>
      <div class="suggestions">
        ${result.suggestions.map(suggestion => `
          <button class="suggestion-button" data-person-id="${escapeHtml(suggestion.id)}">
            <strong>${escapeHtml(suggestion.fullName)}</strong><br />
            ${escapeHtml([suggestion.title, suggestion.department, suggestion.rawLocation].filter(Boolean).join(" — "))}
          </button>
        `).join("")}
      </div>
    `;

    resultEl.querySelectorAll("[data-person-id]").forEach(button => {
      button.addEventListener("click", () => resolvePerson(button.dataset.personId));
    });
    return;
  }

  if (result.type === "ambiguous-room") {
    resultEl.innerHTML = `
      <p class="result-title">Room needs a building</p>
      <p>${escapeHtml(result.message)}</p>
      <div class="suggestions">
        ${result.suggestions.map(suggestion => `
          <button class="suggestion-button" disabled>
            <strong>${escapeHtml(suggestion.displayRoom)}</strong><br />
            ${escapeHtml(suggestion.campusDisplayName)} — ${escapeHtml(suggestion.buildingDisplayName)} — ${escapeHtml(suggestion.recommendedParkingLabel)}
          </button>
        `).join("")}
      </div>
      <p class="result-metadata">For this MVP, type the full building-room form, such as T1063 or MC-T 1063.</p>
    `;
    return;
  }

  resultEl.innerHTML = `
    <p class="result-title">No complete result</p>
    <p>${escapeHtml(result.message ?? "The query could not be resolved.")}</p>
  `;
}

function renderResolved(result) {
  const building = result.campusLocation.buildingMarker;
  const parking = result.campusLocation.parkingMarker;

  resultEl.innerHTML = `
    <p class="result-title">${escapeHtml(result.parsedRoom.displayRoom)}</p>
    <p class="result-message">${escapeHtml(result.message)}</p>

    <div class="result-grid">
      <div class="fact"><span>Campus</span><strong>${escapeHtml(result.campusLocation.campusDisplayName)}</strong></div>
      <div class="fact"><span>Building</span><strong>${escapeHtml(result.campusLocation.buildingDisplayName)}</strong></div>
      <div class="fact"><span>Room</span><strong>${escapeHtml(result.parsedRoom.roomNumber)}</strong></div>
      <div class="fact"><span>Floor</span><strong>${escapeHtml(result.parsedRoom.floorLabel)}</strong></div>
      <div class="fact"><span>Parking</span><strong>${escapeHtml(result.campusLocation.recommendedParkingLabel)}</strong></div>
      <div class="fact"><span>Room range</span><strong>${result.confidence.roomInKnownRange ? "In known range" : "Outside known range"}</strong></div>
    </div>

    <div class="actions">
      <a class="link-button" target="_blank" rel="noreferrer" href="${directionsUrl(parking.lat, parking.lng)}">Directions to parking</a>
      <a class="link-button secondary" target="_blank" rel="noreferrer" href="${directionsUrl(building.lat, building.lng)}">Directions to building</a>
    </div>

    <p class="result-metadata">${escapeHtml(result.metadata.timestampText)}</p>
  `;
}

function renderMarkers(result) {
  const building = result.campusLocation.buildingMarker;
  const parking = result.campusLocation.parkingMarker;

  const buildingMarker = L.marker([building.lat, building.lng])
    .bindPopup(`${result.campusLocation.buildingDisplayName}<br>${result.parsedRoom.displayRoom}`);

  const parkingMarker = L.marker([parking.lat, parking.lng])
    .bindPopup(`Recommended parking<br>${result.campusLocation.recommendedParkingLabel}`);

  markerLayer.addLayer(buildingMarker);
  markerLayer.addLayer(parkingMarker);

  const bounds = L.latLngBounds([
    [building.lat, building.lng],
    [parking.lat, parking.lng]
  ]);
  map.fitBounds(bounds.pad(0.35));
}

function directionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
