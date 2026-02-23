const LT_SKILL_ID = 119;

function byId(id) {
    return document.getElementById(id);
}

function formatMove(move) {
    if (!move || move.length < 2) return "-";
    return `${move[0]}-${move[1]}`;
}

function getEquipNames(equipList) {
    if (!equipList?.length) return "";
    if (typeof equipsById === "undefined") return "";

    return equipList.map(e => {
        const base = equipsById?.[e.id]?.name || `Equip ${e.id}`;
        const extras = (e.extra ?? [])
            .map(x => extrasById?.[x]?.name || `+${x}`)
            .filter(Boolean);
        return extras.length ? `${base} (${extras.join(", ")})` : base;
    }).join(", ");
}

function getSkillNames(profile) {
    const skills = profile?.skills ?? [];
    if (!skills.length) return "";

    return skills
        .map(s => {
            const skill = skillsById?.[s.id];
            const baseName = skill?.name || `Skill ${s.id}`;
            const extras = (s.extra ?? [])
                .map(extraId => extrasById?.[extraId]?.name)
                .filter(Boolean);
            return extras.length ? `${baseName} (${extras.join(", ")})` : baseName;
        })
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
}

function renderEquipAndSkills(profile) {
    const equips = getEquipNames(profile?.equip);
    const skills = getSkillNames(profile);
    if (!equips && !skills) return "";

    return `<div class="special-skills">
        ${equips ? `<strong>Equipment:</strong> ${equips}<br>` : ""}
        ${skills ? `<strong>Skills:</strong> ${skills}` : ""}
    </div>`;
}


function renderEquipList(equipList) {
    const names = getEquipNames(equipList);
    return names ? `<div class="army-skill-line">${names}</div>` : "";
}


function renderSkillsInline(profile) {
    const names = getSkillNames(profile);
    return names ? `<div class="special-skills"><strong>Skills:</strong> ${names}</div>` : "";
}

function weaponExtrasText(w) {
    const extras = (w?.extra ?? [])
        .map(id => extrasById?.[id]?.name)
        .filter(Boolean);

    return extras.length ? ` (${extras.join(", ")})` : "";
}

function formatWeapon(w) {
    const weapon = weaponsById?.[w.id];
    if (!weapon) return `Weapon ${w.id}${weaponExtrasText(w)}`;

    return `${weapon.name}${weaponExtrasText(w)}`;
}

function isMeleeOrSidearm(weapon) {
    if (!weapon) return false;

    const props = weapon.properties ?? [];
    if (props.includes("CC")) return true;

    const n = (weapon.name || "").toLowerCase();
    if (n.includes("pistol")) return true; // pistol/ heavy pistol / breaker pistol osv

    return false;
}

function getWeaponNames(weaponsList) {
    if (!weaponsList?.length) return "-";

    const ranged = weaponsList
        .map(w => ({ w, weapon: weaponsById?.[w.id] }))
        .filter(x => x.weapon && !isMeleeOrSidearm(x.weapon));

    if (!ranged.length) return "-";
    return ranged.map(x => formatWeapon(x.w)).join(", ");
}

function getMeleeWeapons(weaponsList) {
    if (!weaponsList?.length) return "-";

    const melee = weaponsList
        .map(w => ({ w, weapon: weaponsById?.[w.id] }))
        .filter(x => x.weapon && isMeleeOrSidearm(x.weapon));

    if (!melee.length) return "-";
    return melee.map(x => formatWeapon(x.w)).join(", ");
}


function namesFromIds(list, dict) {
    if (!list?.length) return [];
    return list
        .map(x => (typeof x === "number" ? x : x?.id))
        .map(id => dict?.[id]?.name)
        .filter(Boolean);
}

// plocka “Forward Observer”, “Paramedic”, “Engineer” ur option.name om de står där
function parseRoleTokens(optionName) {
    const s = optionName || "";
    const tokens = [];

    // lägg till fler om du vill
    const known = ["Forward Observer", "Paramedic", "Engineer", "Doctor", "Hacker", "Killer Hacker", "EVO Hacking Device"];

    for (const k of known) {
        if (s.toLowerCase().includes(k.toLowerCase())) tokens.push(k);
    }
    return tokens;
}

function renderOptionTraits(option) {
    const parts = [];

    // 1) från option.name (roller/varianter)
    parts.push(...parseRoleTokens(option?.name));

    // 2) skills
    parts.push(...namesFromIds(option?.skills, skillsById));

    // 3) equips (t.ex. Hacking Device)
    parts.push(...namesFromIds(option?.equip, extrasById)); // många “equip” ligger i extras
    parts.push(...namesFromIds(option?.equip, skillsById)); // ibland är det skill-id istället

    // dedupe + snyggt
    const uniq = Array.from(new Set(parts.map(p => p.trim()).filter(Boolean)));

    return uniq.length ? `<div class="army-skill-line">${uniq.join(", ")}</div>` : "";
}




function renderSkillIcons(profile) {
    const skillIconByName = {
        impetuous: "/static/images/icons/impetuous.svg",
    };
    const norm = s => (s || "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

    const icons = (profile.skills ?? [])
        .map(s => skillsById?.[s.id]?.name)     // <-- SÅ HÄR
        .filter(Boolean)
        .map(name => ({ name, url: skillIconByName[norm(name)] }))
        .filter(x => x.url)
        .map(x => `<img src="${x.url}" class="char-icon" alt="${x.name}" title="${x.name}" draggable="false">`)
        .join("");

    return icons ? `<div class="characteristics-row">${icons}</div>` : "";
}



function renderCharacteristics(profile) {
    if (!profile?.chars || profile.chars.length === 0) return "";

    const relevantChars = profile.chars; // inga bortfiltreringar

    const iconMap = {
        1: "/static/images/icons/cube.svg",
        20: "/static/images/icons/cube2.svg",
        21: "/static/images/icons/hackable.svg",
        27: "/static/images/icons/peripheral.svg",
        3: "/static/images/icons/regular.svg",
    };

    const icons = relevantChars
        .map((charId) => {
            const char = charsById?.[charId];
            const iconUrl = iconMap[charId];
            if (!iconUrl) return ""; // om du bara vill visa ikoniserade chars

            const title = char?.name || `Char ${charId}`;

            return `<img src="${iconUrl}" class="char-icon" alt="${title}" title="${title}" tabindex="-1" draggable="false">`;
        })
        .filter(Boolean)
        .join("");

    if (!icons) return "";
    return `<div class="characteristics-row">${icons}</div>`;
}

function renderAllIcons(profile) {
    return `
    <div class="characteristics-row">
      ${renderCharacteristics(profile)}
      ${renderSkillIcons(profile)}
    </div>
  `;
}

function renderOptionSkillsFull(optionSkills) {
    if (!optionSkills?.length) return "";

    const names = optionSkills
        .map(s => {
            const skill = skillsById?.[s.id];
            const baseName = skill?.name || `Skill ${s.id}`;

            const extras = (s.extra ?? [])
                .map(extraId => extrasById?.[extraId]?.name)
                .filter(Boolean);

            return extras.length ? `${baseName} (${extras.join(", ")})` : baseName;
        })
        .filter(Boolean)
        .join(", ");

    return names ? `<div class="army-skill-line">${names}</div>` : "";
}



function renderProfileCard(unit, pg, profile, category, groupIndex) {
    return `
    ${groupIndex > 0 ? '<hr class="unit-sep">' : ""}

    <div class="unit-top-bar">
      <span>ISC: ${pg.isc}</span>
      <span>${category}</span>
    </div>

    <div class="unit-header">
      <div class="unit-logo-circle">
        ${profile.logo ? `<img src="${profile.logo}" alt="${pg.isc}">` : ""}
      </div>

      <div class="unit-header-content">
        <div class="unit-name-header">${pg.isc}</div>
        ${renderAllIcons(profile)}
        <div class="stats-row">
          <div class="stat-item"><div class="stat-label">MOV</div><div class="stat-value">${formatMove(profile.move)}</div></div>
          <div class="stat-item"><div class="stat-label">CC</div><div class="stat-value">${profile.cc ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">BS</div><div class="stat-value">${profile.bs ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">PH</div><div class="stat-value">${profile.ph ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">WIP</div><div class="stat-value">${profile.wip ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">ARM</div><div class="stat-value">${profile.arm ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">BTS</div><div class="stat-value">${profile.bts ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">${profile.str ? "STR" : "Vita"}</div><div class="stat-value">${profile.w ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">S</div><div class="stat-value">${profile.s ?? "-"}</div></div>
          <div class="stat-item"><div class="stat-label">AVA</div><div class="stat-value">${profile.ava ?? "-"}</div></div>
        </div>

        ${renderEquipAndSkills(profile)}
      </div>
    </div>
  `;
}

function getIncludesLabel(unit, option) {
    if (!option.includes || option.includes.length === 0) return "";

    const names = option.includes.map(inc => {
        const groupNum = inc.group;
        if (!groupNum) return null;

        const groupIndex = groupNum - 1;
        const pg = unit.profileGroups?.[groupIndex];
        if (!pg) return null;

        const opt = pg.options?.find(o => o.id === inc.option);
        if (!opt) return null;

        return opt.name;
    }).filter(Boolean);

    if (names.length === 0) return "";

    return `<br><span class="muted">|| ${names.join(" + ")}</span>`;
}

function getHighlightClass(option) {
    const activeWeaponId = document.getElementById("weaponFilter")?.value;
    const activeSkillId = document.getElementById("skillFilter")?.value;
    const activeEquipId = document.getElementById("equipFilter")?.value;

    const hasMatch =
        (activeWeaponId && option.weapons?.some(w => String(w.id) === String(activeWeaponId))) ||
        (activeSkillId && option.skills?.some(s => String(s.id) === String(activeSkillId))) ||
        (activeEquipId && option.equip?.some(e => String(e.id) === String(activeEquipId)));

    return hasMatch ? "row-highlight" : "";
}

function renderLoadoutTablesForGroup(unit, groupIndex) {
    let html = "";

    // Root bundles ska bara synas på huvudkortet (groupIndex 0)
    if (groupIndex === 0 && unit.options?.length) {
        html += `
      <h3 class="section-title">Combined Loadouts</h3>
      <table class="loadout-table">
        <thead>
          <tr><th>Name</th><th>Includes</th><th>Minis</th><th>SWC</th><th>C</th></tr>
        </thead>
        <tbody>
          ${unit.options.map((option) => {
            let includesText = "-";
            if (option.includes?.length) {
                includesText = option.includes.map((inc) => {
                    const gi = inc.group - 1;
                    const pg = unit.profileGroups?.[gi];
                    const ref = pg?.options?.find((o) => o.id === inc.option);
                    return ref ? `${pg.isc}: ${ref.name}` : `Group ${inc.group}, Option ${inc.option}`;
                }).join(" + ");
            }

            const rowClass = option.disabled ? "disabled-row" : "";
            const onClick = option.disabled ? "" : `onclick="addToArmy(${unit.id}, 'root', ${option.id})"`;
            const highlightClass = getHighlightClass(option);

            return `
              <tr class="${rowClass}${highlightClass}" ${onClick}>
                <td>
                  ${option.name}
                  ${option.skills?.some(s => s.id === LT_SKILL_ID) ? ' <span class="lt-badge">Lieutenant</span>' : ''}
                  ${renderOptionSkillsFull(option.skills)}
                  ${renderEquipList(option.equip)}
                </td>
                <td>
                    <span class="muted">${includesText}</span>
                </td>
                <td class="swc-cost">${option.minis || 1}</td>
                <td class="swc-cost">${option.swc || "0"}</td>
                <td class="swc-cost">${option.points || "-"}</td>
              </tr>
            `;
        }).join("")}
        </tbody>
      </table>
      <div class="spacer"></div>
    `;
    }

    // Rendera bara den specifika profileGroupen
    const pg = unit.profileGroups?.[groupIndex];
    if (!pg?.options?.length) return html;

    html += `
    <h3 class="section-title">${pg.isc || "Loadouts"}</h3>
    <table class="loadout-table">
      <thead>
        <tr><th>Name</th><th>Weaponry | Equipment</th><th>Melee Weapons</th><th>SWC</th><th>C</th></tr>
      </thead>
      <tbody>
        ${pg.options.map((option) => {
        const rowClass = option.disabled ? "disabled-row" : "";
        const onClick = option.disabled ? "" : `onclick="addToArmy(${unit.id}, ${groupIndex + 1}, ${option.id})"`;
        const highlightClass = getHighlightClass(option);

        return `
            <tr class="${rowClass}${highlightClass}" ${onClick}>
              <td>
                ${option.name}
                ${option.skills?.some(s => s.id === LT_SKILL_ID) ? ' <span class="lt-badge">Lieutenant</span>' : ''}
                ${renderOptionSkillsFull(option.skills)}
                ${renderEquipList(option.equip)}
              </td>
              <td>${getWeaponNames(option.weapons)}
                  ${getIncludesLabel(unit, option)}
              </td>
              <td>${getMeleeWeapons(option.weapons)}</td>
              <td class="swc-cost">${option.swc || "0"}</td>
              <td class="swc-cost">${option.points || "-"}</td>
            </tr>
          `;
    }).join("")}
      </tbody>
    </table>
    <div class="spacer"></div>
  `;

    return html;
}

function openUnitPopupById(unitId) {
    const unit = unitsData.find(u => u.id === unitId);
    if (!unit) return;

    const popup = byId("unitPopup");
    const content = byId("popupContent");

    let html = `<button class="popup-close" onclick="closeUnitPopup()">×</button>`;

    if (unit.profileGroups?.length) {
        unit.profileGroups.forEach((pg, groupIndex) => {
            const profile = pg.profiles?.[0];
            if (!profile) return;

            const category = categoryMap[pg.category] || "-";

            // 1) Stats-kortet (så bots får sina stats)
            html += renderProfileCard(unit, pg, profile, category, groupIndex);

            // 2) Loadouts för JUST den gruppen, direkt under rätt kort
            html += `
        <div class="loadouts-table">
          ${renderLoadoutTablesForGroup(unit, groupIndex)}
        </div>
      `;
        });
    }

    content.innerHTML = html;
    popup.classList.add("active");
}



function closeUnitPopup() {
    byId("unitPopup").classList.remove("active");
}
