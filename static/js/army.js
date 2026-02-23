// Army configuration
let armyConfig = { pointsLimit: 300, swcLimit: 6.0 };

// Combat groups
let combatGroups = [
    { id: 1, name: "Combat Group 1", units: [] },
    { id: 2, name: "Combat Group 2", units: [] },
];
const MAX_PER_GROUP = 10;
const MAX_GROUPS = 2;

// SWC limits based on points
const swcLimits = { 150: 3.0, 200: 4.0, 250: 5.0, 300: 6.0, 350: 7, 400: 8.0 };
const orderIcons = {
    REGULAR: "/static/images/icons/regular.svg",
    IRREGULAR: "/static/images/icons/irregular.svg",
    IMPETUOUS: "/static/images/icons/impetuous.svg",
    TACTICAL_AWARENESS: "/static/images/icons/tactical.svg"
};
const TA_SKILL_ID = 213;

function updatePointsLimit(points) {
    armyConfig.pointsLimit = Number(points);
    armyConfig.swcLimit = swcLimits[Number(points)] || 6.0;
    updateArmyDisplay();
}

function countTroopersInGroup(cg) {
    return (cg.units || []).filter(u => !u.isChild).length;
}

function pickGroupIndexForNewTrooper() {
    for (let i = 0; i < MAX_GROUPS; i++) {
        if (countTroopersInGroup(combatGroups[i]) < MAX_PER_GROUP) return i;
    }
    return -1;
}

function inferOrders(option) {
    const out = [...(option.orders || [])];

    const hasTA =
        (option?.skills || []).some(s => s.id === TA_SKILL_ID) ||
        /tactical awareness/i.test(option?.name || "");

    if (hasTA) out.push({ type: "TACTICAL_AWARENESS", total: 1 });

    return out;
}

function groupHasTroopers(cg) {
    return countTroopersInGroup(cg) > 0;
}

function resolveIncludedOptions(unit, includes) {
    const out = [];

    for (const inc of (includes || [])) {
        const groupNum =
            (typeof inc.group === "number" ? inc.group : null) ??
            (typeof inc.groupIndex === "number" ? inc.groupIndex + 1 : null);

        const optionId =
            (typeof inc.option === "number" ? inc.option : null) ??
            (typeof inc.optionId === "number" ? inc.optionId : null);

        if (!groupNum || !optionId) continue;

        const groupIndex = groupNum - 1;
        const pg = unit.profileGroups?.[groupIndex];
        if (!pg) continue;

        // VIKTIGT: hitta även disabled
        const opt = pg.options?.find(o => o.id === optionId);
        if (!opt) continue;

        out.push({ groupIndex, pg, option: opt });
    }

    return out;
}


function buildOptionTraitsText(option) {
    const parts = [];

    (option?.skills ?? []).forEach(s => {
        const base = skillsById?.[s.id]?.name || `Skill ${s.id}`;
        const extras = (s.extra ?? []).map(x => extrasById?.[x]?.name).filter(Boolean);
        parts.push(extras.length ? `${base} (${extras.join(", ")})` : base);
    });

    (option?.equip ?? []).forEach(e => {
        const base = equipsById?.[e.id]?.name || `Equip ${e.id}`;
        const extras = (e.extra ?? []).map(x => extrasById?.[x]?.name).filter(Boolean);
        parts.push(extras.length ? `${base} (${extras.join(", ")})` : base);
    });

    return Array.from(new Set(parts.filter(Boolean))).join(", ");
}








function addToArmy(unitId, group, optionId) {
    const unit = unitsData.find(u => u.id === unitId);
    if (!unit) return;

    let option = null;
    if (group === "root") option = unit.options?.find(o => o.id === optionId) || null;
    else option = unit.profileGroups?.[group - 1]?.options?.find(o => o.id === optionId) || null;
    if (!option) return;

    const targetGroupIndex = pickGroupIndexForNewTrooper();
    if (targetGroupIndex === -1) {
        showError?.("Max 20 (2 grupper) nådd");
        return;
    }

    const cg = combatGroups[targetGroupIndex];
    const traitsText = buildOptionTraitsText(option);

    const parentKey = `${unit.id}:${group}:${option.id}:${Date.now()}`;

    const parentItem = {
        key: parentKey,
        parentKey: null,
        isChild: false,
        countCosts: true,

        unitId: unit.id,
        unitName: unit.name,
        group,
        optionId: option.id,
        optionName: option.name,
        points: Number(option.points || 0),
        swc: Number(parseFloat(option.swc) || 0),

        skills: option.skills || [],
        includes: option.includes || [],
        weapons: option.weapons || [],
        orders: inferOrders(option),

        traitsText,
    };

    console.log("ADD", parentItem.optionName,
        "skills:", (parentItem.skills || []).map(s => s.id),
        "orders:", parentItem.orders
    );


    cg.units.push(parentItem);

    const included = resolveIncludedOptions(unit, option.includes);

    for (const inc of included) {
        cg.units.push({
            key: `${parentKey}:inc:${inc.groupIndex}:${inc.option.id}`,
            parentKey,
            isChild: true,
            countCosts: false,

            unitId: unit.id,
            unitName: unit.name,
            group: inc.groupIndex + 1,
            optionId: inc.option.id,
            optionName: `${inc.pg.isc}: ${inc.option.name}`,

            points: 0,
            swc: 0,

            displayPoints: Number(inc.option.points || 0),
            displaySwc: Number(parseFloat(inc.option.swc) || 0),

            weapons: inc.option.weapons || [],
            equips: inc.option.equip || [],
            skills: inc.option.skills || [],
            orders: [],
            includes: [],
        });
    }

    updateArmyDisplay();
}

function skillNamesFromOptionSkills(optionSkills) {
    if (!optionSkills?.length) return [];
    return optionSkills
        .map(s => skillsById?.[s.id]?.name)
        .filter(Boolean);
}

function renderOptionSkillsCompact(optionSkills, max = 4) {
    const names = skillNamesFromOptionSkills(optionSkills);
    if (!names.length) return "";

    const shown = names.slice(0, max);
    const rest = names.length - shown.length;

    const full = names.join(", ");
    const compact = rest > 0 ? `${shown.join(", ")} … +${rest}` : full;

    return `<div class="army-skill-line" title="${full}">${compact}</div>`;
}

window.renderOptionSkillsCompact = renderOptionSkillsCompact;


function removeFromArmy(groupIndex, unitIndex) {
    const cg = combatGroups[groupIndex];
    const item = cg.units[unitIndex];
    if (!item) return;

    if (!item.isChild) {
        const pk = item.key;
        cg.units = cg.units.filter(u => u.key !== pk && u.parentKey !== pk);
    } else {
        cg.units.splice(unitIndex, 1);
    }

    updateArmyDisplay();
}


function calcTotals() {
    let totalPoints = 0, totalSwc = 0, totalUnits = 0;

    combatGroups.forEach(g => {
        g.units.forEach(u => {
            if (u.countCosts) {
                totalPoints += u.points;
                totalSwc += u.swc;
                totalUnits++;
            }
        });
    });

    return { totalPoints, totalSwc, totalUnits };
}

function statusClass(total, limit) {
    if (total > limit) return "over-limit";
    if (total > limit * 0.9) return "warning";
    return "";
}

function barClass(total, limit) {
    if (total > limit) return "over";
    if (total > limit * 0.9) return "warning";
    return "";
}

function calcOrderSummary(group) {
    let regular = 0;
    let irregular = 0;
    let impetuous = 0;
    let tacticalAwareness = 0;

    (group.units || []).forEach((u) => {
        (u.orders || []).forEach((order) => {
            const total = Number(order.total || 1);
            if (order.type === "REGULAR") regular += total;
            else if (order.type === "IRREGULAR") irregular += total;
            else if (order.type === "IMPETUOUS") impetuous += total;
            else if (order.type === "TACTICAL") tacticalAwareness += total;
        });
    });

    const parts = [];

    if (regular > 0) {
        parts.push(
            `<img src="${orderIcons.REGULAR}" class="order-icon" title="Regular" tabindex="-1" draggable="false"> ${regular}`,
        );
    }
    if (irregular > 0) {
        parts.push(
            `<img src="${orderIcons.IRREGULAR}" class="order-icon" title="Irregular" tabindex="-1" draggable="false"> ${irregular}`,
        );
    }
    if (impetuous > 0) {
        parts.push(
            `<img src="${orderIcons.IMPETUOUS}" class="order-icon" title="Impetuous" tabindex="-1" draggable="false"> ${impetuous}`,
        );
    }
    if (tacticalAwareness > 0) {
        parts.push(`<img src="${orderIcons.TACTICAL_AWARENESS}" class="order-icon" title="Tactical Awareness" tabindex="-1" draggable="false"> ${tacticalAwareness}`
        );
    }

    return parts.length ? " | " + parts.join("  ") : "";
}

function getChildLabelsForParent(cg, parentKey) {
    const child = cg.units.filter(x => x.parentKey === parentKey);
    if (!child.length) return "";
    const names = child.map(k => (k.optionName || "").split(":").pop().trim()).filter(Boolean);
    return names.length ? ` <span class="muted">|| ${names.join(" + ")}</span>` : "";
}



function updateArmyDisplay() {
    const container = document.getElementById("armyColumn");
    if (!container) return;

    const { totalPoints, totalSwc, totalUnits } = calcTotals();

    const ltOk = hasLieutenant();

    const pointsClass = statusClass(totalPoints, armyConfig.pointsLimit);
    const swcClass = statusClass(totalSwc, armyConfig.swcLimit);

    const pointsPercent = Math.min((totalPoints / armyConfig.pointsLimit) * 100, 100);
    const swcPercent = Math.min((totalSwc / armyConfig.swcLimit) * 100, 100);

    const pointsBarClass = barClass(totalPoints, armyConfig.pointsLimit);
    const swcBarClass = barClass(totalSwc, armyConfig.swcLimit);

    let html = `
    <div class="army-limits">
        <div class="army-limit-row limit-row-inline">
            <strong>Points Limit:</strong>
            <select class="limit-select" onchange="updatePointsLimit(this.value)">
            <option value="150" ${armyConfig.pointsLimit === 150 ? "selected" : ""}>150 pts</option>
            <option value="200" ${armyConfig.pointsLimit === 200 ? "selected" : ""}>200 pts</option>
            <option value="250" ${armyConfig.pointsLimit === 250 ? "selected" : ""}>250 pts</option>
            <option value="300" ${armyConfig.pointsLimit === 300 ? "selected" : ""}>300 pts</option>
            <option value="400" ${armyConfig.pointsLimit === 400 ? "selected" : ""}>400 pts</option>
            </select>
        </div>

        <div class="army-bars-row">
            <div class="army-bar-block">
            <div class="army-bar-label ${pointsClass}">
                Points ${totalPoints} / ${armyConfig.pointsLimit}
            </div>
            <div class="progress-container">
                <div class="progress-bar ${pointsBarClass}" style="width: ${pointsPercent}%"></div>
            </div>
            </div>

            <div class="army-bar-block">
            <div class="army-bar-label ${swcClass}">
                SWC ${totalSwc.toFixed(1)} / ${armyConfig.swcLimit.toFixed(1)}
            </div>
            <div class="progress-container">
                <div class="progress-bar ${swcBarClass}" style="width: ${swcPercent}%"></div>
            </div>
            </div>

            <div class="army-lt-status ${ltOk ? "lt-ok" : "lt-missing"}">
            LT: ${ltOk ? "YES" : "NO"}
            </div>
        </div>
    </div>
  `;

    if (totalUnits === 0) {
        html += `<div class="army-empty">Välj enheter från listan för att bygga din armé</div>`;
    } else {
        const groupsToRender = [];

        groupsToRender.push({ cg: combatGroups[0], idx: 0 });

        if (combatGroups[1] && groupHasTroopers(combatGroups[1])) {
            groupsToRender.push({ cg: combatGroups[1], idx: 1 });
        }

        groupsToRender.forEach(({ cg, idx }) => {
            const groupSize = countTroopersInGroup(cg);
            const groupOverLimit = groupSize > 10;
            const orderSummary = calcOrderSummary(cg);

            html += `
        <div class="combat-group">
          <div class="combat-group-header">
            <span class="combat-group-title">⚔️ ${cg.name}${orderSummary}</span>
            <span class="combat-group-count ${groupOverLimit ? "over-limit" : ""}">(${groupSize}/10)</span>
          </div>

          <div class="combat-group-units">
            <table class="army-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Weaponry</th>
                  <th>Melee</th>
                  <th class="num">SWC</th>
                  <th class="num">C</th>
                  <th class="num"></th>
                </tr>
              </thead>
              <tbody>
                ${cg.units.map((u, unitIndex) => {

                const weaponsText = getWeaponNames(u.weapons);
                const meleeText = getMeleeWeapons(u.weapons);
                const childLabel = (!u.isChild && u.key)
                    ? getChildLabelsForParent(cg, u.key)
                    : "";
                return `
                      <tr class="army-row ${u.isChild ? "army-row-child" : ""}">
                        <td>
                          <div class="army-cell-sub">${u.optionName}</div>
                          ${u.traitsText ? `<div class="army-skill-line">${u.traitsText}</div>` : ""}
                        </td>
                        <td class="army-cell">${weaponsText}${childLabel}
                        <td class="army-cell">${meleeText}</td>
                        <td class="num"><strong>${u.displaySwc ?? u.swc}</strong></td>
                        <td class="num"><strong>${u.displayPoints ?? u.points}</strong></td>
                        <td class="num">
                          <button class="army-remove-btn" onclick="removeFromArmy(${idx}, ${unitIndex})">×</button>
                        </td>
                      </tr>
                    `;
            })
                    .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
        });
    }

    html += `
    <div class="army-actions">
      <button class="army-button save" onclick="saveArmyList()">💾 Save List</button>
      <button class="army-button export" onclick="exportArmyList()">📤 Export</button>
    </div>
  `;

    container.innerHTML = html;
}

function armyTroopersFlat() {
    return combatGroups.flatMap(g => g.units).filter(u => !u.isChild);
}

function hasLieutenant() {
    const LT_ID = (typeof LT_SKILL_ID !== "undefined") ? LT_SKILL_ID : 119;

    return combatGroups
        .flatMap(g => g.units)
        .some(u => {
            if (u.isChild) return false;

            const byId = (u.skills || []).some(s => s.id === LT_ID);
            const byText = /lieutenant/i.test(u.traitsText || "") || /lieutenant/i.test(u.optionName || "");

            return byId || byText;
        });
}

function saveArmyList() {
    alert("Save functionality kommer snart!");
}

function exportArmyList() {
    alert("Export functionality kommer snart!");
}
