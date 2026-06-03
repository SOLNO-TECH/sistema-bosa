#!/bin/bash
# Instalación manual de whisper.cpp + ffmpeg en Ubuntu/Debian (sin Docker).
# Uso en VPS: sudo bash scripts/install-whisper-vps.sh
set -euo pipefail

WHISPER_ROOT="${WHISPER_ROOT:-/opt/whisper}"
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-small.bin}"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}"

echo "==> Paquetes del sistema (ffmpeg, build tools)..."
apt-get update
apt-get install -y ffmpeg git cmake build-essential curl ca-certificates

echo "==> Clonando whisper.cpp en ${WHISPER_ROOT}..."
mkdir -p "$(dirname "$WHISPER_ROOT")"
if [ ! -d "${WHISPER_ROOT}/.git" ]; then
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$WHISPER_ROOT"
else
  git -C "$WHISPER_ROOT" pull --ff-only || true
fi

echo "==> Compilando whisper-cli..."
cmake -S "$WHISPER_ROOT" -B "$WHISPER_ROOT/build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$WHISPER_ROOT/build" -j"$(nproc)"

install -m 755 "$WHISPER_ROOT/build/bin/whisper-cli" /usr/local/bin/whisper-cli

echo "==> Descargando modelo ${MODEL_NAME}..."
mkdir -p "$WHISPER_ROOT/models"
if [ ! -f "$WHISPER_ROOT/models/${MODEL_NAME}" ]; then
  curl -fsSL -o "$WHISPER_ROOT/models/${MODEL_NAME}" "$MODEL_URL"
fi

echo ""
echo "Listo. Añade a tu .env del backend:"
echo "WHISPER_BIN=/usr/local/bin/whisper-cli"
echo "WHISPER_MODEL=${WHISPER_ROOT}/models/${MODEL_NAME}"
echo "FFMPEG_BIN=$(command -v ffmpeg)"
echo "WHISPER_LANGUAGE=es"
echo "WHISPER_USE_SERVER=false"
echo ""
whisper-cli --help >/dev/null 2>&1 && echo "whisper-cli: OK" || echo "whisper-cli: verificar instalación"
