#!/usr/bin/env bash
# Generates real traffic against the deployed target worker so Cloudflare
# Analytics and the spans table have genuine data for the agent to
# investigate. Run once before seeding a regression commit, then again
# after deploying it — see README "Seeding a regression" for the full flow.
set -euo pipefail

TARGET_URL="${TARGET_URL:-https://millisecond-target.jaymalveus.workers.dev}"
REQUESTS="${REQUESTS:-40}"

echo "Sending $REQUESTS requests to each route on $TARGET_URL"

for i in $(seq 1 "$REQUESTS"); do
  curl -s -o /dev/null "$TARGET_URL/api/orders"
  curl -s -o /dev/null "$TARGET_URL/api/products"
  printf "."
done
echo " done"
