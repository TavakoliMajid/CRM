#!/bin/bash
# CRM Hira - macOS & Linux 1-Click Desktop Runner
cd "$(dirname "$0")"
export PYTHONPATH=.
PORT=8080

echo "=================================================="
echo " Starting CRM Hira Desktop Server"
echo " Address: http://localhost:$PORT"
echo "=================================================="

# Open in standalone App Window Mode if Chrome is available, otherwise default browser
if [ -d "/Applications/Google Chrome.app" ]; then
    (sleep 1 && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="http://localhost:$PORT") &
elif command -v open &> /dev/null; then
    (sleep 1 && open "http://localhost:$PORT") &
elif command -v xdg-open &> /dev/null; then
    (sleep 1 && xdg-open "http://localhost:$PORT") &
fi

python3 -m app.backend.server "$PORT"
