// ── Army configuration ────────────────────────────────────────────
let armyConfig = { pointsLimit: 300, swcLimit: 6.0 };

let combatGroups = [
    { id: 1, name: "Combat Group 1", units: [] },
    { id: 2, name: "Combat Group 2", units: [] },
];
const MAX_PER_GROUP = 10;
const MAX_GROUPS = 2;

const swcLimits = { 150: 3.0, 200: 4.0, 250: 5.0, 300: 6.0, 400: 8.0 };
const orderIcons = {
    REGULAR: "/static/images/icons/regular.svg",
    IRREGULAR: "/static/images/icons/irregular.svg",
    IMPETUOUS: "/static/images/icons/impetuous.svg",
    TACTICAL_AWARENESS: "/static/images/icons/tactical.svg"
};
const TA_SKILL_ID = 213;

const PRIVATE_SKILL_IDS = new Set([119, 35, 33, 238, 26, 207]);
const PRIVATE_EQUIP_IDS = new Set([24]);
const HIDDEN_DEPLOYMENT_ID = 238;
const HIDDEN_UNIT_SKILL_IDS = new Set([35, 33, 238]);

// ── Group helpers ─────────────────────────────────────────────────
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

function groupHasTroopers(cg) {
    return countTroopersInGroup(cg) > 0;
}

// ── Unit helpers ──────────────────────────────────────────────────
function inferOrders(option) {
    const out = [...(option.orders || [])];
    const hasTA =
        (option?.skills || []).some(s => s.id === TA_SKILL_ID) ||
        /tactical awareness/i.test(option?.name || "");
    if (hasTA) out.push({ type: "TACTICAL_AWARENESS", total: 1 });
    return out;
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

function skillNamesFromOptionSkills(optionSkills) {
    if (!optionSkills?.length) return [];
    return optionSkills.map(s => skillsById?.[s.id]?.name).filter(Boolean);
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

// ── Army mutations ────────────────────────────────────────────────
function addToArmy(unitId, group, optionId) {
    const unit = unitsData.find(u => u.id === unitId);
    if (!unit) return;

    let option = null;
    if (group === "root") option = unit.options?.find(o => o.id === optionId) || null;
    else option = unit.profileGroups?.[group - 1]?.options?.find(o => o.id === optionId) || null;
    if (!option) return;

    const targetGroupIndex = pickGroupIndexForNewTrooper();
    if (targetGroupIndex === -1) { showError?.("Max 20 (2 grupper) nådd"); return; }

    const cg = combatGroups[targetGroupIndex];
    const traitsText = buildOptionTraitsText(option);
    const parentKey = `${unit.id}:${group}:${option.id}:${Date.now()}`;
    const pg = unit.profileGroups?.[group === "root" ? 0 : group - 1];
    const profileSkills = pg?.profiles?.[0]?.skills || [];

    cg.units.push({
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
        equip: option.equip || [],
        orders: inferOrders(option),
        traitsText,
    });

    for (const inc of resolveIncludedOptions(unit, option.includes)) {
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

// ── Totals & status ───────────────────────────────────────────────
function calcTotals() {
    let totalPoints = 0, totalSwc = 0, totalUnits = 0;
    combatGroups.forEach(g => g.units.forEach(u => {
        if (u.countCosts) { totalPoints += u.points; totalSwc += u.swc; totalUnits++; }
    }));
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

function hasLieutenant() {
    const LT_ID = (typeof LT_SKILL_ID !== "undefined") ? LT_SKILL_ID : 119;
    return combatGroups.flatMap(g => g.units).some(u => {
        if (u.isChild) return false;
        return (u.skills || []).some(s => s.id === LT_ID) ||
            /lieutenant/i.test(u.traitsText || "") ||
            /lieutenant/i.test(u.optionName || "");
    });
}

function armyTroopersFlat() {
    return combatGroups.flatMap(g => g.units).filter(u => !u.isChild);
}

// ── Order summaries ───────────────────────────────────────────────
function calcOrderSummary(group) {
    let regular = 0, irregular = 0, impetuous = 0, tacticalAwareness = 0;
    (group.units || []).forEach(u => (u.orders || []).forEach(order => {
        const total = Number(order.total || 1);
        if (order.type === "REGULAR") regular += total;
        if (order.type === "IRREGULAR") irregular += total;
        if (order.type === "IMPETUOUS") impetuous += total;
        if (order.type === "TACTICAL") tacticalAwareness += total;
    }));
    const parts = [];
    if (regular) parts.push(`<img src="${orderIcons.REGULAR}" class="order-icon" title="Regular" tabindex="-1" draggable="false"> ${regular}`);
    if (irregular) parts.push(`<img src="${orderIcons.IRREGULAR}" class="order-icon" title="Irregular" tabindex="-1" draggable="false"> ${irregular}`);
    if (impetuous) parts.push(`<img src="${orderIcons.IMPETUOUS}" class="order-icon" title="Impetuous" tabindex="-1" draggable="false"> ${impetuous}`);
    if (tacticalAwareness) parts.push(`<img src="${orderIcons.TACTICAL_AWARENESS}" class="order-icon" title="Tactical Awareness" tabindex="-1" draggable="false"> ${tacticalAwareness}`);
    return parts.length ? " | " + parts.join("  ") : "";
}

function calcOrderSummaryText(cg) {
    let regular = 0, irregular = 0, impetuous = 0;
    cg.units.forEach(u => (u.orders || []).forEach(o => {
        if (o.type === "REGULAR") regular += Number(o.total || 1);
        if (o.type === "IRREGULAR") irregular += Number(o.total || 1);
        if (o.type === "IMPETUOUS") impetuous += Number(o.total || 1);
    }));
    const parts = [];
    if (regular) parts.push(`${regular} Regular`);
    if (irregular) parts.push(`${irregular} Irregular`);
    if (impetuous) parts.push(`${impetuous} Impetuous`);
    return parts.join(", ");
}

function getChildLabelsForParent(cg, parentKey) {
    const child = cg.units.filter(x => x.parentKey === parentKey);
    if (!child.length) return "";
    const names = child.map(k => (k.optionName || "").split(":").pop().trim()).filter(Boolean);
    return names.length ? ` <span class="muted">|| ${names.join(" + ")}</span>` : "";
}

// ── Main display ──────────────────────────────────────────────────
function updateArmyDisplay() {
    const container = document.getElementById("armyColumn");
    if (!container) return;

    const { totalPoints, totalSwc, totalUnits } = calcTotals();
    const ltOk = hasLieutenant();
    const pointsClass = statusClass(totalPoints, armyConfig.pointsLimit);
    const swcClass = statusClass(totalSwc, armyConfig.swcLimit);
    const pointsPercent = Math.min((totalPoints / armyConfig.pointsLimit) * 100, 100);
    const swcPercent = Math.min((totalSwc / armyConfig.swcLimit) * 100, 100);

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
                <div class="army-bar-label ${pointsClass}">Points ${totalPoints} / ${armyConfig.pointsLimit}</div>
                <div class="progress-container">
                    <div class="progress-bar ${barClass(totalPoints, armyConfig.pointsLimit)}" style="width: ${pointsPercent}%"></div>
                </div>
            </div>
            <div class="army-bar-block">
                <div class="army-bar-label ${swcClass}">SWC ${totalSwc.toFixed(1)} / ${armyConfig.swcLimit.toFixed(1)}</div>
                <div class="progress-container">
                    <div class="progress-bar ${barClass(totalSwc, armyConfig.swcLimit)}" style="width: ${swcPercent}%"></div>
                </div>
            </div>
            <div class="army-lt-status ${ltOk ? "lt-ok" : "lt-missing"}">LT: ${ltOk ? "YES" : "NO"}</div>
        </div>
    </div>`;

    if (totalUnits === 0) {
        html += `<div class="army-empty">Välj enheter från listan för att bygga din armé</div>`;
    } else {
        const groupsToRender = [{ cg: combatGroups[0], idx: 0 }];
        if (combatGroups[1] && groupHasTroopers(combatGroups[1]))
            groupsToRender.push({ cg: combatGroups[1], idx: 1 });

        groupsToRender.forEach(({ cg, idx }) => {
            const groupSize = countTroopersInGroup(cg);
            html += `
            <div class="combat-group">
                <div class="combat-group-header">
                    <span class="combat-group-title">⚔️ ${cg.name}${calcOrderSummary(cg)}</span>
                    <span class="combat-group-count ${groupSize > 10 ? "over-limit" : ""}">(${groupSize}/10)</span>
                </div>
                <div class="combat-group-units">
                    <table class="army-table">
                        <thead><tr>
                            <th>Name</th><th>Weaponry</th><th>Melee</th>
                            <th class="num">SWC</th><th class="num">C</th><th class="num"></th>
                        </tr></thead>
                        <tbody>
                        ${cg.units.map((u, unitIndex) => {
                const childLabel = (!u.isChild && u.key) ? getChildLabelsForParent(cg, u.key) : "";
                return `
                            <tr class="army-row ${u.isChild ? "army-row-child" : ""}">
                                <td>
                                    <div class="army-cell-sub">${u.optionName}</div>
                                    ${u.traitsText ? `<div class="army-skill-line">${u.traitsText}</div>` : ""}
                                </td>
                                <td class="army-cell">${getWeaponNames(u.weapons)}${childLabel}</td>
                                <td class="army-cell">${getMeleeWeapons(u.weapons)}</td>
                                <td class="num"><strong>${u.displaySwc ?? u.swc}</strong></td>
                                <td class="num"><strong>${u.displayPoints ?? u.points}</strong></td>
                                <td class="num">
                                    <button class="army-remove-btn" onclick="removeFromArmy(${idx}, ${unitIndex})">×</button>
                                </td>
                            </tr>`;
            }).join("")}
                        </tbody>
                    </table>
                </div>
            </div>`;
        });
    }

    html += `
    <div class="army-actions">
        <button class="army-button save"       onclick="saveArmyList()">💾 Save List</button>
        <button class="army-button export"     onclick="exportArmyList()">📋 Full Export</button>
        <button class="army-button tournament" onclick="exportTournamentList()">🏆 Tournament</button>
    </div>`;

    container.innerHTML = html;
}

// ── Save (stub) ───────────────────────────────────────────────────
function saveArmyList() {
    alert("Save functionality kommer snart!");
}

// ── Export: private info filtering ────────────────────────────────
function buildTraitsFiltered(u) {
    const parts = [];
    (u.skills || []).forEach(s => {
        if (PRIVATE_SKILL_IDS.has(s.id)) return;
        const base = skillsById?.[s.id]?.name || `Skill ${s.id}`;
        const extras = (s.extra ?? []).map(x => extrasById?.[x]?.name).filter(Boolean);
        parts.push(extras.length ? `${base} (${extras.join(", ")})` : base);
    });
    (u.equip ?? u.equips ?? []).forEach(e => {
        if (PRIVATE_EQUIP_IDS.has(e.id)) return;
        const base = equipsById?.[e.id]?.name || `Equip ${e.id}`;
        const extras = (e.extra ?? []).map(x => extrasById?.[x]?.name).filter(Boolean);
        parts.push(extras.length ? `${base} (${extras.join(", ")})` : base);
    });
    return Array.from(new Set(parts.filter(Boolean))).join(", ");
}

function stripPrivateInfo(u) {
    const hasHiddenSkill = (u.skills || []).some(s => HIDDEN_UNIT_SKILL_IDS.has(s.id));

    const unitRef = unitsData.find(x => x.id === u.unitId);
    const groupIdx = u.group === "root" ? 0 : (u.group - 1);
    const profile = unitRef?.profileGroups?.[groupIdx]?.profiles?.[0];
    const hasHiddenProfileSkill = (profile?.skills ?? []).some(s => HIDDEN_UNIT_SKILL_IDS.has(s.id));

    const hasHolomask = (u.equip ?? u.equips ?? []).some(e => e.id === 24);

    const isHidden = hasHiddenSkill || hasHiddenProfileSkill || hasHolomask;

    return {
        ...u,
        displayPoints: "?",
        displaySwc: "?",
        optionName: isHidden ? "[ Reserve / Hidden Trooper ]" : u.optionName,
        traitsText: isHidden ? "" : buildTraitsFiltered(u),
        hideWeapons: isHidden,
        hideUnit: isHidden,
    };
}

function buildPlainText() {
    const armyName = document.getElementById("armySelector")?.selectedOptions[0]?.text || "Army";
    const { totalPoints, totalSwc } = calcTotals();
    const lines = [];
    lines.push(`${armyName.toUpperCase()} — ${totalPoints}pts / ${totalSwc.toFixed(1)} SWC`);
    lines.push("");
    combatGroups.forEach((cg, idx) => {
        const troopers = cg.units.filter(u => !u.isChild);
        if (!troopers.length && idx > 0) return;
        lines.push(`${cg.name.toUpperCase()} (${troopers.length} troopers)`);
        cg.units.forEach(u => {
            const indent = u.isChild ? "    └ " : "  ";
            const name = u.optionName.padEnd(36);
            const pts = String(u.displayPoints ?? u.points).padStart(4);
            const swc = String(Number(u.displaySwc ?? u.swc).toFixed(1)).padStart(5);
            const traits = u.traitsText ? `  [${u.traitsText}]` : "";
            lines.push(`${indent}${name} ${pts}pts  ${swc} SWC${traits}`);
        });
        const orders = calcOrderSummaryText(cg);
        if (orders) lines.push(`  Orders: ${orders}`);
        lines.push("");
    });
    lines.push(`TOTAL: ${totalPoints}/${armyConfig.pointsLimit} pts | ${totalSwc.toFixed(1)}/${armyConfig.swcLimit.toFixed(1)} SWC`);
    return lines.join("\n");
}

function buildExportHtml(isOpen) {
    const armyName = document.getElementById("armySelector")?.selectedOptions[0]?.text || "Army";
    const { totalPoints, totalSwc } = calcTotals();
    const label = isOpen ? "Full Army List" : "Opponent List – private info hidden";

    let groupsHtml = "";
    combatGroups.forEach((cg, idx) => {
        const troopers = cg.units.filter(u => !u.isChild);
        if (!troopers.length && idx > 0) return;
        const orders = isOpen ? calcOrderSummaryText(cg) : "";

        const exportUnitGroups = [];
        cg.units.forEach(u => {
            if (u.isChild) return;
            const processed = isOpen ? u : stripPrivateInfo(u);
            if (!isOpen && processed.hideUnit) return; // ← hoppa över helt
            const children = cg.units.filter(c => c.parentKey === u.key);
            exportUnitGroups.push({ unit: processed, children, hidden: false });
        });

        const cards = exportUnitGroups.map(({ unit, children, hidden }) => {
            if (hidden) {
                return `<div class="unit-group"><div class="unit-card unit-hidden"></div></div>`;
            }

            const pts = isOpen ? (unit.displayPoints ?? unit.points) : "?";
            const swcRaw = Number(unit.displaySwc ?? unit.swc);
            const swc = isOpen ? swcRaw.toFixed(1) : "?";
            const costText = isOpen ? `${pts}pts${swcRaw > 0 ? ` / ${swc} SWC` : ""}` : "? pts / ? SWC";

            const allWeapons = unit.hideWeapons
                ? "<em>[ Hidden ]</em>"
                : (unit.weapons || []).map(w => weaponsById?.[w.id]?.name).filter(Boolean).join(", ");

            const unitRef = unitsData.find(x => x.id === unit.unitId);
            const groupIdx = unit.group === "root" ? 0 : unit.group - 1;
            const profile = unitRef?.profileGroups?.[groupIdx]?.profiles?.[0];

            let statsHtml = "";
            if (profile) {
                const move = Array.isArray(profile.move)
                    ? profile.move.map(v => Math.round(Number(v) / 2.5)).join("-")
                    : (profile.move || "-");
                statsHtml = `<table class="stats-mini">
            <tr><th>MOV</th><th>CC</th><th>BS</th><th>PH</th><th>WIP</th><th>ARM</th><th>BTS</th><th>W</th><th>S</th></tr>
            <tr>
                <td>${move}</td><td>${profile.cc ?? "-"}</td><td>${profile.bs ?? "-"}</td>
                <td>${profile.ph ?? "-"}</td><td>${profile.wip ?? "-"}</td>
                <td>${profile.arm ?? "-"}</td><td>${profile.bts ?? "-"}</td>
                <td>${profile.w ?? profile.wounds ?? "-"}</td><td>${profile.s ?? "-"}</td>
            </tr>
        </table>`;
            }

            const profSkills = (profile?.skills ?? [])
                .filter(s => isOpen || !PRIVATE_SKILL_IDS.has(s.id))
                .map(s => skillsById?.[s.id]?.name).filter(Boolean);
            const optionTraits = unit.traitsText || "";
            const allTraitParts = [optionTraits, profSkills.join(", ")].filter(Boolean);
            const combined = Array.from(new Set(
                allTraitParts.join(", ").split(", ").map(s => s.trim()).filter(Boolean)
            )).join(", ");

            const parentCard = `<div class="unit-card">
        <div class="unit-header">
            <span class="unit-name">${unit.optionName}</span>
            <span class="unit-cost">${costText}</span>
        </div>
        ${statsHtml}
        ${combined ? `<div class="unit-line"><strong>Skills:</strong> ${combined}</div>` : ""}
        ${allWeapons ? `<div class="unit-line"><strong>Weapons:</strong> ${allWeapons}</div>` : ""}
    </div>`;

            if (!children.length) {
                return `<div class="unit-group">${parentCard}</div>`;
            }

            const childCards = children.map(child => {
                const childUnitRef = unitsData.find(x => x.id === child.unitId);
                const childProfile = childUnitRef?.profileGroups?.[child.group - 1]?.profiles?.[0];
                let childStats = "";
                if (childProfile) {
                    const childMove = Array.isArray(childProfile.move)
                        ? childProfile.move.map(v => Math.round(Number(v) / 2.5)).join("-")
                        : (childProfile.move || "-");
                    childStats = `<table class="stats-mini">
                <tr><th>MOV</th><th>CC</th><th>BS</th><th>PH</th><th>WIP</th><th>ARM</th><th>BTS</th><th>W</th><th>S</th></tr>
                <tr>
                    <td>${childMove}</td><td>${childProfile.cc ?? "-"}</td><td>${childProfile.bs ?? "-"}</td>
                    <td>${childProfile.ph ?? "-"}</td><td>${childProfile.wip ?? "-"}</td>
                    <td>${childProfile.arm ?? "-"}</td><td>${childProfile.bts ?? "-"}</td>
                    <td>${childProfile.w ?? childProfile.wounds ?? "-"}</td><td>${childProfile.s ?? "-"}</td>
                </tr>
            </table>`;
                }
                const childWeapons = (child.weapons || []).map(w => weaponsById?.[w.id]?.name).filter(Boolean).join(", ");
                const childSkills = (childProfile?.skills ?? []).map(s => skillsById?.[s.id]?.name).filter(Boolean).join(", ");
                return `<div class="unit-card">
            <div class="unit-header">
                <span class="unit-name" style="font-size:9.5pt;">└ ${child.optionName}</span>
            </div>
            ${childStats}
            ${childSkills ? `<div class="unit-line"><strong>Skills:</strong> ${childSkills}</div>` : ""}
            ${childWeapons ? `<div class="unit-line"><strong>Weapons:</strong> ${childWeapons}</div>` : ""}
        </div>`;
            }).join("");

            return `<div class="unit-group has-children">
        <div>${parentCard}</div>
        <div>${childCards}</div>
    </div>`;
        }).join("");

        groupsHtml += `
        <div class="group-block">
            ${isOpen
                ? `<h3>${cg.name} <span class="count">(${troopers.length}/10)</span>${orders ? ` <span class="orders">${orders}</span>` : ""}</h3>`
                : `<h3>${cg.name}</h3>`
            }
            <div class="units-grid">${cards}</div>
        </div>`;
    });

    return `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><title>${armyName}</title>
<style>
    body { font-family: Arial, sans-serif; background: white; color: black; max-width: 210mm; margin: 20px auto; padding: 10mm; font-size: 10pt; }
    h1 { font-size: 18pt; margin-bottom: 4px; }
    .subtitle { font-size: 9pt; color: #555; margin-bottom: 16px; }
    h3 { font-size: 12pt; border-bottom: 2px solid black; margin: 16px 0 8px; padding-bottom: 3px; }
    .count { color: #555; font-size: 0.85em; }
    .orders { margin-left: 10px; color: #555; font-size: 0.85em; font-weight: normal; }

    .units-grid { display: grid; grid-template-columns: 1fr; gap: 6px; }
    body.two-col .units-grid { grid-template-columns: 1fr 1fr; gap: 8px; }

    .unit-card { border: 1px solid #ccc; padding: 6px 8px; break-inside: avoid; }
    .unit-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .unit-name { font-weight: bold; font-size: 10.5pt; }
    .unit-cost { font-size: 9pt; color: #333; white-space: nowrap; margin-left: 8px; }

    .stats-mini { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .stats-mini th { font-size: 7.5pt; text-align: center; padding: 1px 3px; background: #f0f0f0; border: 1px solid #ccc; font-weight: bold; }
    .stats-mini td { font-size: 8.5pt; text-align: center; padding: 1px 3px; border: 1px solid #ccc; }

    .unit-line { font-size: 8.5pt; margin-top: 3px; line-height: 1.4; }
    .unit-line strong { font-size: 8pt; color: #444; }
    .unit-child { font-size: 8.5pt; color: #444; padding: 3px 8px; border-left: 2px solid #ccc; margin: 2px 0 2px 8px; }

    .totals { margin-top: 16px; padding: 8px 10px; border: 2px solid black; font-size: 11pt; font-weight: bold; }
    .note { margin-top: 12px; font-size: 8.5pt; color: #555; font-style: italic; }

    .group-block + .group-block { break-before: page; }

    .unit-group { display: contents; }
    .unit-group.has-children { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; grid-column: span 2; }

    @media print { body { margin: 0; padding: 8mm; } }
</style>
</head><body class="two-col">
    <h1>${armyName}</h1>
    <div class="subtitle">${label}</div>
    ${groupsHtml}
    ${isOpen ? `<div class="totals"><strong>TOTAL:</strong> ${totalPoints} / ${armyConfig.pointsLimit} pts &nbsp;|&nbsp; ${totalSwc.toFixed(1)} / ${armyConfig.swcLimit.toFixed(1)} SWC</div>` : ""}
    ${!isOpen ? `<div class="note">⚠️ Private info hidden: pts/SWC per trooper, Lieutenant identity, Combat Jump, Parachutist, Hidden Deployment, Holomask, Chain of Command, Counterintelligence.</div>` : ""}
</body></html>`;
}

// ── Export: entry points ──────────────────────────────────────────
function exportArmyList() {
    navigator.clipboard.writeText(buildPlainText()).catch(() => { });
    const win = window.open("", "_blank");
    win.document.write(buildExportHtml(true));
    win.document.close();
    showExportSuccess();
}

function exportTournamentList() {
    const win = window.open("", "_blank");
    win.document.write(buildExportHtml(false));
    win.document.close();
}

function showExportSuccess() {
    const btn = document.querySelector(".army-button.export");
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = "✓ Exporterad!";
    btn.style.background = "#2a7a2a";
    setTimeout(() => { btn.textContent = orig; btn.style.background = ""; }, 2000);
}