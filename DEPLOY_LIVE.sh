#!/bin/bash
# =============================================================
# Mantra AI — Production Deployment Script
# Run this on your VPS after configuring .env
# =============================================================

set -e  # Exit on any error

echo "=========================================="
echo "  Mantra AI - Production Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}ERROR: .env file not found!${NC}"
    echo "Please copy .env.example to .env and fill in your production values."
    echo ""
    echo "Required variables for production:"
    echo "  - JWT_SECRET (min 32 chars)"
    echo "  - POSTGRES_PASSWORD (strong password)"
    echo "  - EVO_API_KEY (from Evolution API)"
    echo "  - HERMES_AUTH_TOKEN (generate random)"
    echo "  - NEXT_PUBLIC_API_URL (your domain)"
    echo "  - NEXT_PUBLIC_WS_URL (your domain with wss://)"
    echo "  - FRONTEND_URL (your frontend domain)"
    exit 1
fi

echo -e "${YELLOW}Step 1: Loading environment variables...${NC}"
export $(grep -v '^#' .env | xargs)

echo -e "${YELLOW}Step 2: Validating environment...${NC}"

# Validate required variables
errors=0

if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 16 ]; then
    echo -e "${RED}✗ JWT_SECRET must be at least 16 characters${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✓ JWT_SECRET validated${NC}"
fi

if [ -z "$POSTGRES_PASSWORD" ] || [ ${#POSTGRES_PASSWORD} -lt 8 ]; then
    echo -e "${RED}✗ POSTGRES_PASSWORD must be at least 8 characters${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✓ POSTGRES_PASSWORD validated${NC}"
fi

if [ -z "$EVO_API_KEY" ]; then
    echo -e "${RED}✗ EVO_API_KEY is required${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✓ EVO_API_KEY present${NC}"
fi

if [ -z "$NEXT_PUBLIC_API_URL" ]; then
    echo -e "${RED}✗ NEXT_PUBLIC_API_URL is required${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✓ NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL${NC}"
fi

if [ -z "$NEXT_PUBLIC_WS_URL" ]; then
    echo -e "${RED}✗ NEXT_PUBLIC_WS_URL is required${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✓ NEXT_PUBLIC_WS_URL: $NEXT_PUBLIC_WS_URL${NC}"
fi

if [ -z "$FRONTEND_URL" ]; then
    echo -e "${RED}✗ FRONTEND_URL is required${NC}"
    errors=$((errors + 1))
else
    echo -e "${GREEN}✓ FRONTEND_URL: $FRONTEND_URL${NC}"
fi

if [ $errors -gt 0 ]; then
    echo ""
    echo -e "${RED}FAILED: $errors validation errors${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Building and starting services...${NC}"

# Build and start
docker compose pull
docker compose build --no-cache
docker compose up -d

echo ""
echo -e "${YELLOW}Step 4: Waiting for services to be healthy...${NC}"

# Wait for health checks
sleep 10

# Check PostgreSQL
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose exec -T postgres pg_isready -U ${POSTGRES_USER:-mantra} > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "  Waiting for PostgreSQL... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ PostgreSQL failed to start${NC}"
    docker compose logs postgres --tail 50
    exit 1
fi

# Check Redis
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is ready${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "  Waiting for Redis... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ Redis failed to start${NC}"
    docker compose logs redis --tail 50
    exit 1
fi

# Check Backend
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend API is ready${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "  Waiting for Backend... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ Backend failed to start${NC}"
    docker compose logs backend --tail 50
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5: Running database migrations...${NC}"

# Database is initialized via init.sql mounted in docker-compose
# This runs automatically on first startup

echo -e "${GREEN}✓ Database initialization complete${NC}"

echo ""
echo -e "${YELLOW}Step 6: Final checks...${NC}"

# Display running containers
echo ""
echo "Running containers:"
docker compose ps

echo ""
echo "=========================================="
echo -e "${GREEN}  DEPLOYMENT SUCCESSFUL!${NC}"
echo "=========================================="
echo ""
echo "Your application is now live:"
echo "  Frontend: $FRONTEND_URL"
echo "  API:      $NEXT_PUBLIC_API_URL"
echo "  WS:       $NEXT_PUBLIC_WS_URL"
echo ""
echo "Useful commands:"
echo "  View logs:         docker compose logs -f"
echo "  View backend:      docker compose logs -f backend"
echo "  View evolution:    docker compose logs -f evolution"
echo "  Restart:           docker compose restart"
echo "  Stop:              docker compose down"
echo "  Database shell:    docker compose exec postgres psql -U ${POSTGRES_USER:-mantra} -d ${POSTGRES_DB:-mantra_db}"
echo ""
echo "Default login (DEVELOPMENT ONLY - CHANGE IMMEDIATELY):"
echo "  Email: admin@mantra.ai"
echo "  Pass:  MantraAdmin2024!"
echo ""
echo "=========================================="
