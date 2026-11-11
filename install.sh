#!/bin/bash
# CRM Hira - macOS & Linux 1-Click Installer
set -e
cd "$(dirname "$0")"
export PYTHONPATH=.

echo "=================================================="
echo " CRM Hira - Unified Installer (macOS / Linux)"
echo "=================================================="

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 was not found. Please install Python 3.9+."
    exit 1
fi

echo "Running automated setup wizard..."
python3 installer.py

chmod +x start.sh || true

echo ""
echo "Setup complete! You can now start the application with:"
echo "  ./start.sh"
echo "=================================================="
