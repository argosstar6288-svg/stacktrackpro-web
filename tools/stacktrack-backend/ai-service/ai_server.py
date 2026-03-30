from flask import Flask, request, jsonify
from pathlib import Path
from ai_model import predict

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

app = Flask(__name__)


def load_detection_model():
    if YOLO is None:
        return None

    try:
        return YOLO("yolov8n.pt")
    except Exception:
        return None


model = load_detection_model()


def configure_tesseract_path():
    if pytesseract is None:
        return

    existing = getattr(pytesseract.pytesseract, "tesseract_cmd", "")
    candidate_paths = [
        existing,
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]

    for candidate in candidate_paths:
        if candidate and Path(candidate).exists():
            pytesseract.pytesseract.tesseract_cmd = candidate
            return


configure_tesseract_path()


def get_image_path():
    if "image" in request.files:
        file = request.files["image"]
        path = "temp.jpg"
        file.save(path)
        return path

    payload = request.get_json(silent=True) or {}
    path = payload.get("imagePath")
    if not path or not Path(path).exists():
        return None

    return path


def extract_card_text(path):
    if cv2 is None or pytesseract is None:
        return ""

    img = cv2.imread(path)
    if img is None:
        return ""

    card = img
    if model is not None:
        results = model(img)
        boxes = results[0].boxes.xyxy.tolist()
        if boxes:
            x1, y1, x2, y2 = map(int, boxes[0])
            card = img[y1:y2, x1:x2]

    try:
        text = pytesseract.image_to_string(card)
    except Exception:
        return ""

    return " ".join(text.split())

@app.route("/predict", methods=["POST"])
def predict_card():
    path = get_image_path()
    if not path:
        return jsonify({"error": "image file or imagePath is required"}), 400

    result = predict(path)

    return jsonify({
        "prediction": result
    })


@app.route("/scan", methods=["POST"])
def scan_card():
    path = get_image_path()
    if not path:
        return jsonify({"error": "image file or imagePath is required"}), 400

    text = extract_card_text(path)

    return jsonify({
        "text": text,
        "suggested_query": " ".join(text.split())
    })

app.run(port=5000)
