#!/usr/bin/env bash
# Shared Linux packages for Tauri v2 compile + deb bundling on GitHub Actions.
set -euo pipefail

sudo apt-get update
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  fakeroot \
  dpkg-dev \
  pkg-config
