function getActiveUnitsData() {
  // unitsData kommer från template <script>const unitsData = ...</script>
  return (window.unitsDataForSelectedArmy ?? unitsData ?? []);
}

function profileHasId(u, kind, selectedId) {
  if (!selectedId) return true;
  const targets = String(selectedId).split(",").map(s => s.trim());

  const ids = (u.filters?.[kind] ?? []).map(id => String(id));
  return targets.some(t => ids.includes(t));
}

function buildUnitRow(u) {
  const el = document.createElement("div");
  el.className = "unit-list-item";
  el.setAttribute("data-unit-id", u.id);
  el.setAttribute("data-unit-name", u.name);

  const catId = u.profileGroups?.[0]?.category ?? "";
  el.setAttribute("data-unit-category", catId);

  el.onclick = () => openUnitPopupById(u.id);

  const catName = categoryMap?.[catId] || "-";

  el.innerHTML = `
    <div class="unit-list-name">${u.name}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div class="unit-list-category">${catName}</div>
      <div class="unit-list-owned" data-unit-id="${u.id}" data-unit-name="${u.name}">
        Owned: <span id="owned-${u.id}">0</span>
      </div>
    </div>
  `;

  const ownedEl = el.querySelector(".unit-list-owned");
  const ownedInfo = collectionData?.units?.[String(u.id)];
  const isOwned = ownedInfo?.owned;

  ownedEl.addEventListener("click", (e) => {
    e.stopPropagation();
    openEditOwnedFromElement(ownedEl);
  });

  // fyll owned direkt om funktionen finns
  const span = el.querySelector(`#owned-${u.id}`);
  if (span && typeof getOwnedInfo === "function") span.textContent = getOwnedInfo(u.id);



  el.classList.add(isOwned ? "is-owned" : "not-owned");

  if (!isOwned) ownedEl.classList.add("not-owned");

  return el;
}

window.buildUnitRow = buildUnitRow; // så den alltid finns globalt

function renderUnitList(units) {
  const unitList = document.getElementById("unitList");
  if (!unitList) return;

  unitList.innerHTML = "";
  units.forEach(u => {
    try {
      unitList.appendChild(buildUnitRow(u));
    } catch (e) {
      console.error("buildUnitRow failed for", u?.id, u?.name, e, u);
    }
  });
}

function applyFilters() {
  const searchTerm = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  const categoryFilter = document.getElementById("categoryFilter")?.value || "";
  const ownedFilter = document.getElementById("ownedFilter")?.value || "all";
  const sortFilter = document.getElementById("sortFilter")?.value || "name-asc";

  const skillId = document.getElementById("skillFilter")?.value || "";
  const weaponId = document.getElementById("weaponFilter")?.value || "";
  const equipId = document.getElementById("equipFilter")?.value || "";

  const allUnits = getActiveUnitsData();

  let filtered = allUnits.filter(u => {
    const nameOk = (u.name || "").toLowerCase().includes(searchTerm);

    const uCat = u.profileGroups?.[0]?.category ?? "";
    const catOk = !categoryFilter || String(uCat) === String(categoryFilter);

    const unitId = String(u.id);
    const ownedInfo = collectionData?.units?.[unitId] || { owned: false, amount: 0 };

    const ownedOk =
      ownedFilter === "all" ||
      (ownedFilter === "owned" && !!ownedInfo.owned) ||
      ((ownedFilter === "not-owned" || ownedFilter === "unowned") && !ownedInfo.owned);

    // ID-based profile filters
    const skillOk = profileHasId(u, "skills", skillId);
    const weaponOk = profileHasId(u, "weapons", weaponId);
    const equipOk = profileHasId(u, "equip", equipId);

    return nameOk && catOk && ownedOk && skillOk && weaponOk && equipOk;
  });

  switch (sortFilter) {
    case "name-desc":
      filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      break;

    case "owned-first":
      filtered.sort((a, b) => {
        const aOwned = !!collectionData?.units?.[String(a.id)]?.owned;
        const bOwned = !!collectionData?.units?.[String(b.id)]?.owned;
        return (bOwned - aOwned) || (a.name || "").localeCompare(b.name || "");
      });
      break;

    case "not-owned-first":
      filtered.sort((a, b) => {
        const aOwned = !!collectionData?.units?.[String(a.id)]?.owned;
        const bOwned = !!collectionData?.units?.[String(b.id)]?.owned;
        return (aOwned - bOwned) || (a.name || "").localeCompare(b.name || "");
      });
      break;

    default:
      filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  renderUnitList(filtered);

  const filterCountEl = document.getElementById("filterCount");
  if (filterCountEl) filterCountEl.textContent = `Visar ${filtered.length} av ${allUnits.length} enheter`;
}

function fillDropdown(id, idSet, lookupDict) {
  const select = document.getElementById(id);
  if (!select) return;

  const placeholder = select.options[0]?.textContent || "-- Välj --";
  select.innerHTML = `<option value="">${placeholder}</option>`;

  // Gruppera IDs per rensat namn
  const nameToIds = {};
  Array.from(idSet).forEach(id => {
    const raw = lookupDict[id]?.name || `ID ${id}`;
    const clean = raw.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (!nameToIds[clean]) nameToIds[clean] = [];
    nameToIds[clean].push(id);
  });

  Object.entries(nameToIds)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, ids]) => {
      const opt = document.createElement("option");
      opt.value = ids.join(","); // alla matchande IDs
      opt.textContent = name;
      select.appendChild(opt);
    });

  select.value = "";
}

function populateFilterDropdowns() {
  const skillIds = new Set();
  const weaponIds = new Set();
  const equipIds = new Set();

  unitsData.forEach(u => {
    u.filters?.skills?.forEach(id => skillIds.add(id));
    u.filters?.weapons?.forEach(id => weaponIds.add(id));
    u.filters?.equip?.forEach(id => equipIds.add(id));
  });

  fillDropdown("skillFilter", skillIds, skillsById);
  fillDropdown("weaponFilter", weaponIds, weaponsById);
  fillDropdown("equipFilter", equipIds, equipsById);
}

window.populateFilterDropdowns = populateFilterDropdowns;

function resetFilters() {
  const s = document.getElementById("searchInput");
  const c = document.getElementById("categoryFilter");
  const o = document.getElementById("ownedFilter");
  const so = document.getElementById("sortFilter");
  const sk = document.getElementById("skillFilter");
  const we = document.getElementById("weaponFilter");
  const eq = document.getElementById("equipFilter");

  if (sk) sk.value = "";
  if (we) we.value = "";
  if (eq) eq.value = "";
  if (s) s.value = "";
  if (c) c.value = "";
  if (o) o.value = "all";
  if (so) so.value = "name-asc";

  applyFilters();
}

window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
