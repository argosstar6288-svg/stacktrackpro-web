from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Card Scanner AI Service",
    description="Trading card scanning with OCR",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple mock OCR for demo purposes
# In production, would use:
# - YOLO: from ultralytics import YOLO
# - EasyOCR: import easyocr
def mock_ocr_extract(image_data: bytes) -> dict:
    """
    Mock OCR extraction - returns sample card data
    In production, this would use real EasyOCR
    """
    # Simulate different cards based on image size
    size = len(image_data)
    
    if size < 5000:
        return {
            "text": "pikachu pokemon 25 base set",
            "confidence": 0.85,
            "fields": {
                "name": "pikachu",
                "cardNumber": "25",
                "set": "base set"
            }
        }
    elif size < 10000:
        return {
            "text": "charizard holo rare 4 base set",
            "confidence": 0.92,
            "fields": {
                "name": "charizard",
                "cardNumber": "4",
                "set": "base set",
                "rarity": "holo rare"
            }
        }
    else:
        return {
            "text": "blue eyes white dragon yugioh",
            "confidence": 0.88,
            "fields": {
                "name": "blue eyes white dragon",
                "game": "yu-gi-oh"
            }
        }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Card Scanner AI",
        "message": "Service is running"
    }

@app.post("/scan")
async def scan_card(file: UploadFile = File(...)):
    """
    Scan a card image and extract OCR text.
    
    Returns:
    {
        "success": bool,
        "detected": bool,
        "text": str,
        "confidence": float,
        "detections": list
    }
    """
    try:
        # Read image
        contents = await file.read()
        
        if not contents:
            return {
                "success": False,
                "error": "Empty file"
            }
        
        logger.info(f"Scanning image: {file.filename} ({len(contents)} bytes)")
        
        # Extract OCR text (using mock for now)
        ocr_result = mock_ocr_extract(contents)
        
        return {
            "success": True,
            "detected": True,
            "text": ocr_result["text"],
            "confidence": ocr_result["confidence"],
            "detections": [
                {
                    "confidence": ocr_result["confidence"],
                    "class": 0,
                    "box": [100, 150, 400, 450]
                }
            ],
            "bounds": [95, 145, 310, 310],
            "image_shape": [600, 500, 3]
        }
    
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/scan-batch")
async def scan_batch(files: list[UploadFile] = File(...)):
    """Scan multiple card images."""
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
    """Return service information."""
    return {
        "name": "Card Scanner AI Service",
        "version": "1.0.0",
        "status": "running",
        "note": "Using mock OCR for demo. For production, install: pip install -r requirements.txt",
        "endpoints": [
            "/health - Health check",
            "/scan - Scan single card",
            "/scan-batch - Scan multiple cards",
            "/info - Service information"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
