#!/bin/bash

RATE=${1}
NUM_APPS=${2:-10} # Defaults to 10 if not provided
# Get IP of LoadBalancer via:
#kubectl get gateway/gateway -n <GATEWAY_NAMESPACE> -o jsonpath='{.status.addresses[0].value}'

IP="https://108.141.113.11"

echo "Running test with Rate: $RATE against $IP"

k6 run constant_rps.js \
  --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
  -e TARGET_URL=$IP \
  -e RATE=$RATE \
  -e NUM_APPS=$NUM_APPS
