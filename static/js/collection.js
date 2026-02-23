// Collection/Owned management
let currentEditingUnitId = null;

function ensureCollectionShape() {
    if (!window.collectionData) window.collectionData = {};
    if (!collectionData.units) collectionData.units = {};
}

function getOwnedInfo(unitId) {
    ensureCollectionShape();
    const info = collectionData.units[String(unitId)];
    if (!info || !info.owned) return 0;
    return Number(info.amount || 0);
}

function openEditOwnedFromElement(element) {
    const unitId = element.getAttribute("data-unit-id");
    const unitName = element.getAttribute("data-unit-name");
    openEditOwned(unitId, unitName);
}

function openEditOwned(unitId, unitName) {
    ensureCollectionShape();
    currentEditingUnitId = String(unitId);

    const info = collectionData.units[currentEditingUnitId] || {
        owned: false,
        amount: 0,
        notes: "",
    };

    document.getElementById("editUnitName").textContent = unitName;
    document.getElementById("editOwnedCheckbox").checked = !!info.owned;
    document.getElementById("editAmountInput").value = Number(info.amount || 1);
    document.getElementById("editNotesInput").value = info.notes || "";

    toggleAmountSection();
    document.getElementById("editOwnedModal").classList.add("active");
}

function closeEditOwned() {
    document.getElementById("editOwnedModal").classList.remove("active");
    currentEditingUnitId = null;
}

function toggleAmountSection() {
    const checkbox = document.getElementById("editOwnedCheckbox");
    const section = document.getElementById("editAmountSection");
    section.style.display = checkbox.checked ? "block" : "none";
}

async function saveOwned() {
    ensureCollectionShape();
    if (!currentEditingUnitId) return;

    const owned = document.getElementById("editOwnedCheckbox").checked;
    const amount = Number(document.getElementById("editAmountInput").value || 0);
    const notes = document.getElementById("editNotesInput").value || "";

    try {
        const response = await fetch("/update_owned", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                unitId: currentEditingUnitId,
                owned,
                amount,
                notes,
            }),
        });

        const result = await response.json();

        if (!result.success) {
            alert("Fel vid sparande: " + (result.error || "okänt fel"));
            return;
        }

        // uppdatera client state
        collectionData.units[currentEditingUnitId] = {
            ...(collectionData.units[currentEditingUnitId] || {}),
            owned,
            amount,
            notes,
        };

        // uppdatera UI
        const span = document.getElementById(`owned-${currentEditingUnitId}`);
        if (span) span.textContent = String(owned ? amount : 0);

        closeEditOwned();

        // om du vill: direkt re-filter (så “owned-only” uppdateras)
        if (typeof applyFilters === "function") applyFilters();
    } catch (error) {
        alert("Fel vid sparande: " + error);
    }
}
