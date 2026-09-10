#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  Compiling C++ Dining Web Server (SavorSphere)...       "
echo "=========================================================="
clang++ -std=c++17 -O2 -pthread server.cpp -o dining_server

echo "Starting server on port 8080..."
echo "Open in your browser: http://localhost:8080"
echo "Press Ctrl+C to stop."
./dining_server 8080 ./public
