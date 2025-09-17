#!/bin/bash

echo "Testing Excel Export Service"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Service URL
SERVICE_URL="http://localhost:3003"

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" $SERVICE_URL/health)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi

# Test 2: Service Status
echo -e "\n2. Testing Service Status..."
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" $SERVICE_URL/api/excel/status)
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
BODY=$(echo "$STATUS_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Service status check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Service status check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi

# Test 3: Excel Download (no filters)
echo -e "\n3. Testing Excel Download (no filters)..."
DOWNLOAD_RESPONSE=$(curl -s -o /tmp/test_excel.xlsx -w "%{http_code}" \
    -X POST $SERVICE_URL/api/excel/download \
    -H "Content-Type: application/json" \
    -d '{}')

if [ "$DOWNLOAD_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Excel download successful${NC}"
    if [ -f /tmp/test_excel.xlsx ]; then
        FILE_SIZE=$(ls -lh /tmp/test_excel.xlsx | awk '{print $5}')
        echo "File saved to /tmp/test_excel.xlsx (size: $FILE_SIZE)"
        rm /tmp/test_excel.xlsx
    fi
else
    echo -e "${RED}✗ Excel download failed (HTTP $DOWNLOAD_RESPONSE)${NC}"
fi

# Test 4: Excel Download with filters
echo -e "\n4. Testing Excel Download with filters..."
DOWNLOAD_RESPONSE=$(curl -s -o /tmp/test_excel_filtered.xlsx -w "%{http_code}" \
    -X POST $SERVICE_URL/api/excel/download \
    -H "Content-Type: application/json" \
    -d '{"activated": "true"}')

if [ "$DOWNLOAD_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Filtered Excel download successful${NC}"
    if [ -f /tmp/test_excel_filtered.xlsx ]; then
        FILE_SIZE=$(ls -lh /tmp/test_excel_filtered.xlsx | awk '{print $5}')
        echo "File saved to /tmp/test_excel_filtered.xlsx (size: $FILE_SIZE)"
        rm /tmp/test_excel_filtered.xlsx
    fi
else
    echo -e "${RED}✗ Filtered Excel download failed (HTTP $DOWNLOAD_RESPONSE)${NC}"
fi

echo -e "\n============================"
echo "Testing complete!"