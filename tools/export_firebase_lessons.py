#!/usr/bin/env python3
"""Admin-only export of Mali's human color lessons from Firebase RTDB.

Run locally (never in the browser):
  py -m pip install firebase-admin
  py tools/export_firebase_lessons.py --service-account PRIVATE.json --database-url https://YOUR-DB-REGION.firebasedatabase.app
NEVER commit PRIVATE.json or the downloaded raw lessons.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

LABELS = {"crvena", "plava", "zelena", "žuta"}
SOURCES = {"teaching", "verification"}


def main():
    parser = argparse.ArgumentParser(description="Export human-taught Mali color lessons")
    parser.add_argument("--service-account", required=True, help="LOCAL private Firebase admin JSON path")
    parser.add_argument("--database-url", required=True, help="Firebase RTDB URL")
    parser.add_argument("--output", default="lekcije/mali-zajednicke-lekcije.json")
    args = parser.parse_args()

    import firebase_admin
    from firebase_admin import credentials, db

    app = firebase_admin.initialize_app(
        credentials.Certificate(args.service_account),
        {"databaseURL": args.database_url}
    )
    try:
        raw = db.reference("/colorLessons/v1", app=app).get() or {}
        out = []
        for uid, records in raw.items():
            if not isinstance(records, dict):
                continue
            for lesson_id, item in records.items():
                if not isinstance(item, dict):
                    continue
                rgb = item.get("rgb")
                if (isinstance(rgb, list) and len(rgb) == 3 and
                    all(type(v) is int and 0 <= v <= 255 for v in rgb) and
                    item.get("label") in LABELS and
                    item.get("source") in SOURCES):
                    out.append({
                        "id": uid + ":" + lesson_id,
                        "rgb": rgb,
                        "label": item["label"],
                        "source": item["source"],
                        "created_at": str(item.get("created_at", ""))
                    })
        dest = Path(args.output)
        dest.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "format": "mali-color-lessons-v1",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "lessons": out
        }
        dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Spremljeno:", dest, "| ukupno lekcija:", len(out))
        print("Provjeri kvalitetu i raspodjelu oznaka PRIJE treniranja.")
    finally:
        firebase_admin.delete_app(app)


if __name__ == "__main__":
    main()
