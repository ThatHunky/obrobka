#!/usr/bin/env bash
# Завантажує моделі з HuggingFace і кладе в R2.
#
# Імена в бакеті стабільні, тож Cache-Control ставимо на рік: модель за
# конкретним іменем ніколи не змінюється, а нова версія отримає нове ім'я.
set -euo pipefail

BUCKET=obrobka-models
CACHE=${MODEL_CACHE:-$HOME/.cache/obrobka/models}
mkdir -p "$CACHE"

names=(u2netp.onnx modnet.onnx isnet-general.onnx)
urls=(
  "https://huggingface.co/BritishWerewolf/U-2-Netp/resolve/main/onnx/model.onnx"
  "https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx"
  "https://huggingface.co/imgly/isnet-general-onnx/resolve/main/onnx/model_fp16.onnx"
)

for i in "${!names[@]}"; do
  name=${names[$i]}
  if pnpm exec wrangler r2 object get "$BUCKET/$name" --remote --file /dev/null >/dev/null 2>&1; then
    echo "  вже в бакеті: $name"
    continue
  fi
  if [ ! -f "$CACHE/$name" ]; then
    echo "  качаю: $name"
    curl -sL --fail --max-time 900 -o "$CACHE/$name" "${urls[$i]}"
  fi
  printf '  заливаю: %-20s %s МБ\n' "$name" "$(du -m "$CACHE/$name" | cut -f1)"
  # --remote обов'язковий: без нього wrangler 4 пише в локальну
  # симуляцію R2 (miniflare), а справжній бакет лишається порожнім.
  pnpm exec wrangler r2 object put "$BUCKET/$name" \
    --remote \
    --file "$CACHE/$name" \
    --content-type application/octet-stream \
    --cache-control 'public, max-age=31536000, immutable' >/dev/null
done
echo "готово"
