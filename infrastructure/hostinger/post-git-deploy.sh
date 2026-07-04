#!/bin/bash
# Deprecated — use npm start (passenger-stack-app) after npm run build.
# Kept for manual recovery only.
exec bash "$(dirname "$0")/splaro-start-services.sh"
