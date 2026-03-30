from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from ultralytics import YOLO
import easyocr
import logging
import os
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Card Scanner AI Service",
    description="YOLO detection + EasyOCR for trading card scanning",
    version="1.0.0"
)

# CORS configuration for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
logger.info("Loading YOLO model...")
model = YOLO("yolov8n.pt")  # Start with nano model, replace with trained model later

logger.info("Loading EasyOCR reader...")
reader = easyocr.Reader(['en'], gpu=False)  # Set gpu=True if CUDA available

def detect_card_bounds(image: np.ndarray):
    """
    Detect card boundaries in image using edge detection.
    Returns the card region for better OCR.
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply edge detection
        edges = cv2.Canny(gray, 100, 200)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find largest contour (likely the card)
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        # Ensure contour is reasonably large
        if area < 5000:
            return None
        
        # Get bounding box
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Add padding and clip to image boundaries
        padding = 10
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(image.shape[1] - x, w + 2 * padding)
        h = min(image.shape[0] - y, h + 2 * padding)
        
        return (x, y, w, h)
    except Exception as e:
        logger.warning(f"Card boundary detection failed: {e}")
        return None

def extract_card_text(image: np.ndarray) -> str:
    """
    Extract text from card region using EasyOCR.
    Applies preprocessing for better accuracy.
    """
    try:
        # Enhance contrast
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        image_enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        
        # Run OCR
        ocr_results = reader.readtext(image_enhanced)
        
        if not ocr_results:
            return ""
        
        # Extract text and confidence
        text_parts = []
        for result in ocr_results:
            text = result[1]
            confidence = result[2]
            # Only include high-confidence detections
            if confidence > 0.3:
                text_parts.append(text)
        
        text = " ".join(text_parts).lower().strip()
        return text
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return ""

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Card Scanner AI",
        "yolo_loaded": model is not None,
        "ocr_loaded": reader is not None
    }

@app.post("/scan")
async def scan_card(file: UploadFile = File(...)):
    """
    Scan a card image and extract OCR text + YOLO detection.
    
    Returns:
    {
        "success": bool,
        "detected": bool,
        "text": str (extracted text),
        "detections": list (YOLO detection results),
        "bounds": tuple or None (card bounding box),
        "confidence": float (average OCR confidence)
    }
    """
    try:
        # Read image
        contents = await file.read()
        npimg = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        if image is None:
            return {
                "success": False,
                "error": "Failed to decode image"
            }
        
        # Detect card bounds
        bounds = detect_card_bounds(image)
        card_region = image
        
        if bounds:
            x, y, w, h = bounds
            card_region = image[y:y+h, x:x+w]
        
        # YOLO detection on full image
        yolo_results = model(image)
        detections = []
        
        if yolo_results and len(yolo_results) > 0:
            result = yolo_results[0]
            if result.boxes is not None:
                for box in result.boxes:
                    detections.append({
                        "confidence": float(box.conf[0]),
                        "class": int(box.cls[0]),
                        "box": box.xyxy[0].tolist()
                    })
        
        # Extract text from card region
        text = extract_card_text(card_region)
        
        # Calculate overall confidence (average of detections if any)
        overall_confidence = 0.0
        if detections:
            overall_confidence = np.mean([d["confidence"] for d in detections])
        
        return {
            "success": True,
            "detected": len(detections) > 0,
            "text": text,
            "detections": detections,
            "bounds": list(bounds) if bounds else None,
            "confidence": float(overall_confidence),
            "image_shape": list(image.shape)
        }
    
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/scan-batch")
async def scan_batch(files: list[UploadFile] = File(...)):
    """
    Scan multiple card images in parallel.
    
    Returns list of scan results.
    """
    try:
        results = []
        for file in files:
            result = await scan_card(file)
            results.append(result)
        
        return {
            "success": True,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Batch scan failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/info")
async def service_info():
    """Return service information and capabilities."""
    return {
        "name": "Card Scanner AI Service",
        "version": "1.0.0",
        "endpoints": [
            "/health - Health check",
            "/scan - Scan single card",
            "/scan-batch - Scan multiple cards",
            "/info - Service information"
        ],
        "models": {
            "yolo": "yolov8n.pt (nano model)",
            "ocr": "EasyOCR with English support"
        },
        "capabilities": [
            "Card boundary detection",
            "YOLO object detection",
            "EasyOCR text extraction",
            "Batch processing"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
