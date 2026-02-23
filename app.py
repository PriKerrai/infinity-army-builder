from flask import Flask, render_template, jsonify, request
import json
import os

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

ARMY_FILES = {
    "aleph": "aleph_units.json",
    "steel": "steel_phalanx_units.json",
    "yujing": "yu_ying_units.json",
    "whitebanner": "white_banner_units.json",

}

ARMY_FACTION_ID = {
    "aleph": 701,
    "steel": 702,
    "yujing": 201,
    "whitebanner": 205
    # ...
}

def load_json(filename: str) -> dict:
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Kunde inte hitta: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(filename: str, payload: dict) -> None:
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

def load_units_for_army(army_key: str):
    filename = ARMY_FILES.get(army_key, ARMY_FILES["steel"])
    units_data = load_json(filename)
    return units_data.get("units", []), filename

def filter_units_for_army(units, army_key):
    fid = ARMY_FACTION_ID.get(army_key)
    if not fid:
        return units
    return [u for u in units if fid in u.get("factions", [])]     

# --- Load data once at startup ---
data = load_json("infinity_data.json")
units_data = load_json("steel_phalanx_units.json")
collection = load_json("collection.json")

factions = data.get("factions", [])
weapons = data.get("weapons", [])
skills = data.get("skills", [])
ammunition = data.get("ammunition", [])
chars = data.get("chars", [])
types = data.get("type", [])
equips = data.get("equips", []) or data.get("equip", [])
units = units_data.get("units", [])

# category key seems inconsistent across exports
categories = data.get("category", []) or data.get("categories", [])
chars_by_id = {c["id"]: c for c in chars}
types_by_id = {t["id"]: t for t in types}
equips_by_id = {e["id"]: e for e in equips}
weapons_by_id = {w["id"]: w for w in weapons}
skills_by_id = {s["id"]: s for s in skills}
ammo_by_id = {a["id"]: a for a in ammunition}
extras_by_id = {e["id"]: e for e in data.get("extras", [])}
category_map = {c["id"]: c["name"] for c in categories if "id" in c and "name" in c}
skills_map = {s["id"]: s["name"] for s in skills if "id" in s and "name" in s}
weapons_map = {w["id"]: w["name"] for w in weapons if "id" in w and "name" in w}
equipment_map = {e["id"]: e["name"] for e in equips if "id" in e and "name" in e}

# Ensure collection shape
if "units" not in collection or not isinstance(collection["units"], dict):
    collection["units"] = {}

print(f"✓ Laddade {len(units)} units, {len(factions)} factions")

@app.route("/")
def home():
    selected_army = request.args.get("army", "steel").lower()
    units_for_view, units_filename = load_units_for_army(selected_army)
    units_for_view = filter_units_for_army(units_for_view, selected_army)

    return render_template(
        'index.html',
        units=units_for_view,
        selected_army=selected_army,
        units_filename=units_filename,
        weapons_by_id=weapons_by_id,
        skills_by_id=skills_by_id,
        ammo_by_id=ammo_by_id,
        category_map=category_map,
        skills_map=skills_map, 
        weapons_map=weapons_map,
        equipment_map=equipment_map,
        extras_by_id=extras_by_id,
        chars_by_id=chars_by_id,
        collection=collection,
        types=types_by_id, 
        equips_by_id=equips_by_id
    )

@app.route("/update_owned", methods=["POST"])
def update_owned():
    try:
        payload = request.get_json(force=True) or {}
        unit_id = str(payload.get("unitId"))
        owned = bool(payload.get("owned", False))
        amount = int(payload.get("amount", 0) or 0)
        notes = str(payload.get("notes", "") or "")

        # reload from disk (source of truth)
        collection_data = load_json("collection.json")
        if "units" not in collection_data or not isinstance(collection_data["units"], dict):
            collection_data["units"] = {}

        existing = collection_data["units"].get(unit_id, {})

        collection_data["units"][unit_id] = {
            "owned": owned,
            "amount": amount,
            "customImage": existing.get("customImage"),
            "notes": notes,
        }

        save_json("collection.json", collection_data)

        # update in-memory
        global collection
        collection = collection_data

        return jsonify({"success": True})
    except Exception as e:
        print(f"ERROR in update_owned: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
