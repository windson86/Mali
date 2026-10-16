#!/usr/bin/env python3
"""Train MALI's own tiny RGB classifier from user-provided JSON lessons.

Usage:
  python tools/train_colors.py --input lekcije1.json lekcije2.json

No pretrained weights, color-label lookup, web APIs or external AI services.
Only user-provided examples supply the color labels. Requires NumPy.
"""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import numpy as np

LABELS = ("crvena", "plava", "zelena", "žuta")
MIN_PER_COLOR = 8


def load_examples(paths):
    votes = defaultdict(set)
    total = 0
    for filename in paths:
        with open(filename, encoding="utf-8") as file:
            payload = json.load(file)
        if not isinstance(payload, dict) or payload.get("format") != "mali-color-lessons-v1":
            raise ValueError(f"{filename}: nepoznat format lekcija")
        lessons = payload.get("lessons")
        if not isinstance(lessons, list) or len(lessons) > 100000:
            raise ValueError(f"{filename}: neispravna ili prevelika lista lekcija")
        for item in lessons:
            if not isinstance(item, dict):
                continue
            rgb, label = item.get("rgb"), item.get("label")
            if (isinstance(rgb, list) and len(rgb) == 3 and
                    all(type(x) is int and 0 <= x <= 255 for x in rgb) and label in LABELS):
                votes[tuple(rgb)].add(label)
                total += 1
    # If people disagree about the exact same RGB, remove it from training.
    unique = [(rgb, next(iter(labels))) for rgb, labels in votes.items() if len(labels) == 1]
    disagreements = sum(len(labels) > 1 for labels in votes.values())
    print(f"Zapisa: {total}, jedinstvenih boja: {len(unique)}, spornih RGB boja: {disagreements}")
    counts = {label: sum(y == label for _, y in unique) for label in LABELS}
    print("Jedinstveni primjeri:", counts)
    if any(count < MIN_PER_COLOR for count in counts.values()):
        raise ValueError(f"Treba najmanje {MIN_PER_COLOR} razlicitih ljudskih primjera ZA SVAKU od 4 boje.")
    return unique


def split_examples(examples, seed):
    rng = np.random.default_rng(seed)
    train, validation = [], []
    for label in LABELS:
        group = [rgb for rgb, y in examples if y == label]
        rng.shuffle(group)
        n_val = max(2, round(len(group) * 0.20))
        validation += [(rgb, label) for rgb in group[:n_val]]
        train += [(rgb, label) for rgb in group[n_val:]]
    rng.shuffle(train)
    rng.shuffle(validation)
    return train, validation


def arrays(examples):
    x = np.array([rgb for rgb, _ in examples], dtype=np.float64) / 127.5 - 1.0
    y = np.array([LABELS.index(label) for _, label in examples], dtype=np.int64)
    return x, y


def forward(x, params):
    w1, b1, w2, b2 = params
    hidden = np.tanh(x @ w1 + b1)
    logits = hidden @ w2 + b2
    shifted = logits - logits.max(axis=1, keepdims=True)
    probs = np.exp(shifted)
    probs /= probs.sum(axis=1, keepdims=True)
    return hidden, probs


def accuracy(x, y, params):
    return float(np.mean(forward(x, params)[1].argmax(axis=1) == y))


def train(train_examples, val_examples, epochs, seed):
    x, y = arrays(train_examples)
    xv, yv = arrays(val_examples)
    rng = np.random.default_rng(seed)
    hidden_size = 16
    w1 = rng.normal(0, 0.35, size=(3, hidden_size))
    b1 = np.zeros(hidden_size)
    w2 = rng.normal(0, 0.35, size=(hidden_size, len(LABELS)))
    b2 = np.zeros(len(LABELS))
    params = [w1, b1, w2, b2]
    best = None
    best_score = -1.0
    for epoch in range(epochs):
        hidden, probs = forward(x, params)
        delta = probs.copy()
        delta[np.arange(len(y)), y] -= 1
        # Balance human examples across classes, so a popular label doesn't dominate.
        counts = np.bincount(y, minlength=len(LABELS))
        class_weight = len(y) / (len(LABELS) * counts)
        delta *= class_weight[y, None] / len(y)
        dw2 = hidden.T @ delta + 1e-4 * w2
        db2 = delta.sum(axis=0)
        d_hidden = (delta @ w2.T) * (1 - hidden * hidden)
        dw1 = x.T @ d_hidden + 1e-4 * w1
        db1 = d_hidden.sum(axis=0)
        learning_rate = 0.13 * (0.65 + 0.35 * (1 - epoch / max(1, epochs)))
        for arr, grad in zip(params, (dw1, db1, dw2, db2)):
            arr -= learning_rate * grad
        if (epoch + 1) % 20 == 0 or epoch == epochs - 1:
            score = accuracy(xv, yv, params)
            if score > best_score:
                best_score = score
                best = [a.copy() for a in params]
    return best, accuracy(x, y, best), accuracy(xv, yv, best)


def main():
    parser = argparse.ArgumentParser(description="Train MALI using human-labeled RGB lessons")
    parser.add_argument("--input", nargs="+", required=True, type=Path, help="Exported lessons JSON files")
    parser.add_argument("--output", type=Path, default=Path("brain/active.json"))
    parser.add_argument("--epochs", type=int, default=1500)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if not (20 <= args.epochs <= 20000):
        parser.error("--epochs must be between 20 and 20000")
    try:
        examples = load_examples(args.input)
        training, validation = split_examples(examples, args.seed)
        params, tr_acc, val_acc = train(training, validation, args.epochs, args.seed)
        now = datetime.now(timezone.utc)
        w1, b1, w2, b2 = params
        result = {
            "schema_version": 1, "trained": True,
            "version": "v" + now.strftime("%Y%m%d-%H%M%S"),
            "created_at": now.isoformat(), "classes": list(LABELS),
            "model": {"w1": w1.tolist(), "b1": b1.tolist(), "w2": w2.tolist(), "b2": b2.tolist()},
            "metrics": {"unique_examples": len(examples), "training_examples": len(training),
                        "held_out_examples": len(validation), "training_accuracy": round(tr_acc, 4),
                        "held_out_accuracy": round(val_acc, 4)},
        }
        # Save before publishing manually after reviewing the held-out score.
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Trening: {tr_acc:.1%}; novi primjeri (odvojena provjera): {val_acc:.1%}")
        print(f"Spremljeno: {args.output}. Pregledaj rezultat prije objave na GitHubu.")
    except (OSError, ValueError, json.JSONDecodeError) as e:
        print("Greska:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
