# Card Scanner Microservices Architecture

Complete real-world trading card scanning system with Python AI, Node.js matching engine, and eBay pricing integration.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│              (React Component + Web Interface)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Orchestration API (/api/scan-pipeline)              │
│  - Coordinates microservices                                │
│  - Aggregates results and pricing                           │
│  - Provides single unified response                         │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Python AI   │  │ Node.js App  │  │ Pricing Engine   │
    │ Service     │  │ - Matching   │  │ - eBay API       │
    │ Port 8000   │  │ - Catalog    │  │ - PriceCharting  │
    │             │  │ Port 3001    │  │ - Statistics     │
    └─────────────┘  └──────────────┘  └──────────────────┘
         │                  │                  │
    ┌────┴─────┐      ┌─────┴──────┐    ┌─────┴──────┐
    │YOLO Detect│      │ Fuse.js    │    │ eBay Sold  │
    │EasyOCR    │      │ Card Fuzzy │    │ Listings   │
    │Preprocess │      │ Matching   │    │ (REAL)     │
    └──────────┘      └────────────┘    └────────────┘
```

## 📦 Services

### 1. **Python FastAPI AI Service** (Port 8000)

YOLO object detection + EasyOCR for card scanning.

**Installation:**
```bash
cd ai_service
pip install -r requirements.txt
```

**Run:**
```bash
python main.py
# or with uvicorn:
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Endpoints:**
- `POST /scan` - Scan single card image
- `POST /scan-batch` - Scan multiple cards
- `GET /health` - Health check
- `GET /info` - Service information

**Example Request:**
```bash
curl -X POST http://localhost:8000/scan \
  -F "file=@card.jpg"
```

**Response:**
```json
{
  "success": true,
  "detected": true,
  "text": "pikachu pokemon card 25 base set",
  "detections": [
    {
      "confidence": 0.87,
      "class": 0,
      "box": [100, 150, 400, 450]
    }
  ],
  "bounds": [95, 145, 310, 310],
  "confidence": 0.87
}
```

### 2. **Node.js Matching Engine** (Port 3001)

Express server with Fuse.js for fuzzy card matching and pricing.

**Installation:**
```bash
cd matching-engine
npm install
```

**Run:**
```bash
npm start
# or for development with auto-reload:
npm run dev
```

**Endpoints:**
- `POST /identify` - Match card from OCR text
- `POST /identify-multi-signal` - Multi-signal matching (OCR + YOLO)
- `GET /cards` - Get cards by filter
- `GET /cards/:id` - Get specific card
- `POST /pricing/estimate` - Get card price estimate
- `GET /health` - Health check
- `GET /info` - Service information

**Example Request:**
```bash
curl -X POST http://localhost:3001/identify-multi-signal \
  -H "Content-Type: application/json" \
  -d '{
    "text": "pikachu pokemon 25 base set",
    "gameType": "pokemon",
    "yoloDetections": [
      {"confidence": 0.87}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "card": {
    "id": "pikachu-base-4",
    "name": "Pikachu",
    "player": "Pikachu",
    "team": "Pokemon TCG",
    "cardNumber": "25",
    "year": 1999,
    "set": "Base Set",
    "rarity": "common",
    "game": "pokemon",
    "price": 15.50
  },
  "confidence": 0.945,
  "autoSelected": true,
  "signals": {
    "textMatches": 5,
    "yoloDetections": 1,
    "weights": {
      "text": 0.6,
      "yolo": 0.25,
      "image": 0.15
    }
  }
}
```

### 3. **Orchestration API** (Next.js - same port as web app)

Located at `/app/api/scan-pipeline/route.ts`

Coordinates all microservices and returns unified result.

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/scan-pipeline \
  -F "file=@card.jpg" \
  -G --data-urlencode "gameType=pokemon"
```

**Response:**
```json
{
  "success": true,
  "result": {
    "card": {...},
    "confidence": 0.945,
    "estimatedPrice": 18.75,
    "priceSource": "ebay_median",
    "game": "pokemon"
  },
  "pipeline": {
    "aiService": {
      "success": true,
      "detected": true,
      "textLength": 28,
      "detectionsCount": 1,
      "confidence": 0.87
    },
    "matching": {
      "success": true,
      "cardFound": true,
      "confidence": 0.945
    },
    "pricing": {
      "success": true,
      "source": "ebay_median",
      "price": 18.75
    }
  },
  "timing": {
    "aiService": 1240,
    "matching": 45,
    "pricing": 3200,
    "total": 4485
  }
}
```

## 🚀 Quick Start

### Terminal 1: Python AI Service
```bash
cd ai_service
pip install -r requirements.txt
python main.py
```

### Terminal 2: Node.js Matching Engine
```bash
cd matching-engine
npm install
npm start
```

### Terminal 3: Next.js Web App
```bash
npm run dev
# App runs on http://localhost:3000
# Orchestration endpoint: http://localhost:3000/api/scan-pipeline
```

### Test the Pipeline
```bash
# Terminal 4: Test endpoint
curl -X POST http://localhost:3000/api/scan-pipeline \
  -F "file=@path/to/card.jpg" \
  -G --data-urlencode "gameType=pokemon"
```

## 🎮 Supported Games

- **Pokemon** (Pokemon TCG, 25+ sets)
- **Sports** (Baseball, Football, Basketball, Hockey)
- **Magic: The Gathering** (MTG, all sets)
- **Yu-Gi-Oh!** (YGO, all sets)

Game detection is automatic from OCR text, but can be overridden with `gameType` parameter.

## 💎 Card Database

Sample cards are included in `matching-engine/cards.json`. To use real data:

1. **Load from Firebase Firestore:**
   - Modify `matching-engine/index.js` `initializeCards()` to fetch from database
   - Connect Firebase Admin SDK

2. **Load from CSV/JSON:**
   - Place file in `matching-engine/data/`
   - Update initialization code

3. **Integrate with external APIs:**
   - Pokemon: `https://pokeapi.co/`
   - Magic: Scryfall API
   - Yu-Gi-Oh: YGOProDeck API

## 💰 Pricing Integration

### eBay Real-Time Pricing (Production)

Requires eBay Developer Token:
1. Register at https://developer.ebay.com/
2. Get Application Keys
3. Add token to `.env`:
   ```
   EBAY_TOKEN=your_token_here
   ```

**Flow:**
1. Search eBay sold listings for card
2. Collect prices from last 100 sales
3. Remove outliers (top/bottom 10%)
4. Return median price

### PriceCharting Fallback
1. Register at https://www.pricecharting.com/api/
2. Add token to `.env`:
   ```
   PRICECHARTING_TOKEN=your_token_here
   ```

### Catalog Default
If no external data available, uses catalog price from database.

## 📊 Performance Metrics

Typical scan time breakdown:
- **AI Service:** 1000-2000ms (YOLO + OCR)
- **Matching Engine:** 20-100ms (Fuse.js)
- **Pricing:** 2000-4000ms (eBay API calls)
- **Total:** 3000-6000ms

Optimization tips:
1. Use `yolov8n.pt` (nano) for speed over `yolov8x.pt`
2. Enable GPU if available (CUDA)
3. Cache results from eBay API
4. Pre-load card database in memory

## 🔒 Environment Configuration

### Python Service (.env)
```
YOLO_MODEL=yolov8n.pt
USE_GPU=false
LOG_LEVEL=INFO
```

### Node.js Service (.env)
```
EBAY_TOKEN=your_token
PRICECHARTING_TOKEN=your_token
PORT=3001
AI_SERVICE_URL=http://localhost:8000
MATCHING_ENGINE_URL=http://localhost:3001
```

### Next.js App (.env.local)
```
AI_SERVICE_URL=http://localhost:8000
MATCHING_ENGINE_URL=http://localhost:3001
```

## 🧪 Testing

### Test AI Service
```bash
curl -X GET http://localhost:8000/health
curl -X POST http://localhost:8000/scan -F "file=@card.jpg"
```

### Test Matching Engine
```bash
curl -X GET http://localhost:3001/health
curl -X POST http://localhost:3001/identify \
  -H "Content-Type: application/json" \
  -d '{"text": "pikachu pokemon"}'
```

### Test Full Pipeline
```bash
curl -X GET http://localhost:3000/api/scan-pipeline \
  -o /dev/null -w "Status: %{http_code}\n"
```

## 📝 Multi-Signal Matching Algorithm

Combines multiple signals for accurate identification:

```
Final Confidence = (70% to 80%) * Text Matching Score 
                 + (20%) * YOLO Detection Confidence
                 + (5% to 10%) * Image Features (future)

Auto-Select Threshold: >= 0.75 (75%)
Manual Review Threshold: 0.50 - 0.75
Reject Threshold: < 0.50
```

## 🚢 Deployment

### Docker (Coming Soon)
```dockerfile
# Dockerfile for Python service
# Dockerfile for Node.js service
# docker-compose.yml for full stack
```

### Cloud Options
- **AI Service:** Google Cloud Run / AWS Lambda (Python runtime)
- **Matching Engine:** Heroku / Vercel (Node.js)
- **Next.js Frontend:** Vercel / Netlify
- **Database:** Firebase Firestore / MongoDB Atlas

## 📚 API Documentation

### Auto-Generated Docs

**Python Service:**
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Node.js Service:**
- Manual: GET http://localhost:3001/info

**Next.js Orchestrator:**
- GET http://localhost:3000/api/scan-pipeline (health check)

## 🤝 Integration Examples

### React Component
```tsx
const scanCard = async (imageFile: File) => {
  const formData = new FormData();
  formData.append("file", imageFile);

  const response = await fetch("/api/scan-pipeline", {
    method: "POST",
    body: formData
  });

  const result = await response.json();
  console.log(result.result); // {card, confidence, estimatedPrice}
};
```

### Command Line
```bash
node example-cli.js card.jpg
```

### Mobile (React Native)
```tsx
const scanCard = async (imageUri: string) => {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "card.jpg"
  });

  const response = await fetch("http://YOUR_SERVER/api/scan-pipeline", {
    method: "POST",
    body: formData
  });

  return await response.json();
};
```

## 🐛 Troubleshooting

**AI Service won't connect:**
- Verify Python service is running: `curl http://localhost:8000/health`
- Check port 8000 is not in use
- Check firewall settings

**Matching Engine returning no results:**
- Verify cards.json loaded: `curl http://localhost:3001/health`
- Check OCR text is readable
- Try direct match: `curl -X POST http://localhost:3001/identify -d '{"text": "pikachu"}'`

**Pricing always shows catalog price:**
- eBay token not configured in `.env`
- Network timeout calling eBay API
- eBay API rate limit exceeded

**Slow scanning:**
- Use smaller YOLO model (yolov8n.pt)
- Enable GPU acceleration if available
- Reduce image quality/size before sending
- Consider caching results

## 📖 References

- **YOLO:** https://github.com/ultralytics/ultralytics
- **EasyOCR:** https://github.com/JaidedAI/EasyOCR
- **Fuse.js:** https://fusejs.io/
- **FastAPI:** https://fastapi.tiangolo.com/
- **Express.js:** https://expressjs.com/
- **eBay API:** https://developer.ebay.com/

## 📄 License

MIT

## 👥 Contributing

Contributions welcome! Please submit PRs with:
- Tests for new features
- Documentation updates
- Example usage

## 🎯 Roadmap

- [ ] GPU acceleration for Python service
- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] Batch processing optimization
- [ ] Web UI dashboard
- [ ] Advanced image features
- [ ] Model fine-tuning pipeline
- [ ] Real-time WebSocket updates
