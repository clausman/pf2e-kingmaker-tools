#!/bin/bash

# Setup script for Kingdom Actions Quick Reference website
# This script copies the necessary data files to the site directory

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo "Setting up Kingdom Actions Quick Reference..."

# Create data directory
mkdir -p "$SCRIPT_DIR/data"

# Check if data files exist
if [ ! -f "$PROJECT_ROOT/build/generated/data/kingdom-activities.json" ]; then
    echo "Error: kingdom-activities.json not found."
    echo "Please run './gradlew combineJsonFiles' first to generate the data files."
    exit 1
fi

if [ ! -f "$PROJECT_ROOT/lang/en.json" ]; then
    echo "Error: en.json not found."
    exit 1
fi

# Copy data files
echo "Copying data files..."
cp "$PROJECT_ROOT/build/generated/data/kingdom-activities.json" "$SCRIPT_DIR/data/"
cp "$PROJECT_ROOT/lang/en.json" "$SCRIPT_DIR/data/"

echo "Setup complete!"
echo ""
echo "To run the website locally:"
echo "  cd $SCRIPT_DIR"
echo "  python3 -m http.server 8080"
echo ""
echo "Then open http://localhost:8080 in your browser."
