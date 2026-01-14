#!/bin/bash
# Continuous batch image analysis script
# Run with: ./scripts/analyze-batch.sh

API_URL="${API_URL:-http://localhost:3000}"
BATCH_SIZE="${BATCH_SIZE:-5}"
DELAY_BETWEEN_BATCHES="${DELAY_BETWEEN_BATCHES:-5}"

echo "Starting continuous image analysis..."
echo "API: $API_URL"
echo "Batch size: $BATCH_SIZE"
echo ""

while true; do
  # Check remaining
  STATUS=$(curl -s "$API_URL/api/ingestion/analyze")
  REMAINING=$(echo "$STATUS" | jq -r '.remaining')
  ANALYZED=$(echo "$STATUS" | jq -r '.analyzed')
  TOTAL=$(echo "$STATUS" | jq -r '.withImages')

  if [ "$REMAINING" = "0" ] || [ "$REMAINING" = "null" ]; then
    echo ""
    echo "All done! $ANALYZED/$TOTAL listings analyzed."
    break
  fi

  echo "[$(date +%H:%M:%S)] Remaining: $REMAINING | Analyzed: $ANALYZED/$TOTAL"

  # Run batch
  RESULT=$(curl -s -X POST "$API_URL/api/ingestion/analyze?limit=$BATCH_SIZE")
  SUCCESS=$(echo "$RESULT" | jq -r '.analyzed')
  FAILED=$(echo "$RESULT" | jq -r '.failed')

  echo "  -> Batch: $SUCCESS succeeded, $FAILED failed"

  # Delay between batches
  sleep $DELAY_BETWEEN_BATCHES
done
