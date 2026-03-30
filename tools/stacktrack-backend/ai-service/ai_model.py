from PIL import Image, ImageStat


def _classify_by_color(stat):
    r, g, b = stat.mean[:3]

    # Lightweight local heuristic so the service can run without PyTorch.
    if b >= r + 12 and b >= g + 8:
        return {
            "label": "pokemon card",
            "confidence": 61.0,
            "topPredictions": [
                {"label": "pokemon card", "confidence": 61.0},
                {"label": "trading card", "confidence": 29.0},
                {"label": "sports card", "confidence": 10.0},
            ],
        }

    if r >= b + 10 and g >= b - 5:
        return {
            "label": "sports card",
            "confidence": 58.0,
            "topPredictions": [
                {"label": "sports card", "confidence": 58.0},
                {"label": "trading card", "confidence": 32.0},
                {"label": "pokemon card", "confidence": 10.0},
            ],
        }

    return {
        "label": "trading card",
        "confidence": 52.0,
        "topPredictions": [
            {"label": "trading card", "confidence": 52.0},
            {"label": "sports card", "confidence": 24.0},
            {"label": "pokemon card", "confidence": 24.0},
        ],
    }


def predict(image_path):
    img = Image.open(image_path).convert("RGB")
    stat = ImageStat.Stat(img.resize((128, 128)))
    return _classify_by_color(stat)
