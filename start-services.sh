#!/usr/bin/env bash
# Quick start script for running all microservices locally

echo "🚀 Starting Card Scanner Microservices..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js.${NC}"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js and Python found${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $AI_PID 2>/dev/null
    kill $NODE_PID 2>/dev/null
    exit 0
}

trap cleanup EXIT

# Start Python AI Service
echo -e "${YELLOW}Starting Python AI Service on port 8000...${NC}"
cd ai_service

# Check if requirements installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install -q -r requirements.txt
fi

python3 main.py &
AI_PID=$!
sleep 3

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ AI Service running on http://localhost:8000${NC}"
else
    echo -e "${RED}❌ AI Service failed to start${NC}"
    exit 1
fi

cd ..
echo ""

# Start Node.js Matching Engine
echo -e "${YELLOW}Starting Node.js Matching Engine on port 3001...${NC}"
cd matching-engine

# Check if dependencies installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing Node dependencies...${NC}"
    npm install -q
fi

npm start &
NODE_PID=$!
sleep 3

if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Matching Engine running on http://localhost:3001${NC}"
else
    echo -e "${RED}❌ Matching Engine failed to start${NC}"
    kill $AI_PID 2>/dev/null
    exit 1
fi

cd ..
echo ""

# Show status
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✔ All services running!${NC}"
echo ""
echo -e "  ${GREEN}🤖 AI Service${NC}        http://localhost:8000"
echo -e "  ${GREEN}   Docs${NC}               http://localhost:8000/docs"
echo ""
echo -e "  ${GREEN}🧠 Matching Engine${NC}   http://localhost:3001"
echo -e "  ${GREEN}   Health${NC}             http://localhost:3001/health"
echo ""
echo -e "  ${GREEN}📱 Next.js Pipeline${NC}  http://localhost:3000/api/scan-pipeline"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Test the pipeline:"
echo "  curl -X POST http://localhost:3000/api/scan-pipeline \\"
echo "    -F \"file=@path/to/card.jpg\""
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running
while true; do
    sleep 1
done
