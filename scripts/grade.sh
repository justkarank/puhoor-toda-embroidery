#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="${1:-"$PROJECT_ROOT/raw"}"
OUT_DIR="${2:-"$RAW_DIR/graded"}"
GRADE_FILTER="eq=saturation=1.0:contrast=1.03,curves=all='0/0.03 0.5/0.5 1/0.97'"
WIDE_FILTER="crop=w='if(gte(iw*9,ih*21),trunc(ih*21/9/2)*2,trunc(iw/2)*2)':h='if(gte(iw*9,ih*21),trunc(ih/2)*2,trunc(iw*9/21/2)*2)':x='(iw-ow)/2':y='(ih-oh)/2',$GRADE_FILTER"

ASSETS=(
  "hero-a.png"
  "hero-b.png"
  "hero-c.png"
  "construction-front.png"
  "construction-back.png"
  "construction-reverse-macro.png"
  "motif-1.png"
  "motif-2.png"
  "motif-3.png"
  "motif-4.png"
  "motif-5.png"
  "motif-6.png"
  "nilgiris.png"
  "closing-wide.png"
  "closing-thread.png"
  "artisans-1.png"
  "artisans-2.png"
  "artisans-3.png"
  "artisans-4.png"
  "texture-cloth.png"
  "texture-red.png"
  "texture-folds.png"
  "hero-1.mp4"
  "hero-2.mp4"
  "nilgiris.mp4"
  "closing.mp4"
)

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg is required to grade assets." >&2
  exit 1
fi

if [[ ! -d "$RAW_DIR" ]]; then
  echo "Skipping grading: raw asset directory not found: $RAW_DIR"
  exit 0
fi

mkdir -p "$OUT_DIR"
RAW_PATH="$(cd "$RAW_DIR" && pwd -P)"
OUT_PATH="$(cd "$OUT_DIR" && pwd -P)"

if [[ "$RAW_PATH" == "$OUT_PATH" ]]; then
  echo "Error: the graded output directory must differ from raw/ so original downloads are never overwritten." >&2
  exit 1
fi

is_wide_asset() {
  case "$1" in
    hero-b.png | hero-c.png | nilgiris.png | closing-wide.png | closing-thread.png | *.mp4)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

processed=0
skipped=0
active_temp=""

cleanup_temp() {
  if [[ -n "$active_temp" ]]; then
    rm -f -- "$active_temp"
  fi
}

trap cleanup_temp EXIT

for asset in "${ASSETS[@]}"; do
  input="$RAW_DIR/$asset"
  output="$OUT_DIR/$asset"
  extension="${asset##*.}"
  basename="${asset%.*}"
  temporary="$OUT_DIR/$basename.tmp.$extension"

  if [[ ! -f "$input" ]]; then
    echo "Skipping missing input: raw/$asset"
    skipped=$((skipped + 1))
    continue
  fi

  filter="$GRADE_FILTER"
  if is_wide_asset "$asset"; then
    filter="$WIDE_FILTER"
  fi

  if [[ -e "$output" && ! -s "$output" ]]; then
    rm -f -- "$output"
  fi

  rm -f -- "$temporary"
  active_temp="$temporary"

  case "$asset" in
    *.mp4)
      if ! ffmpeg \
          -hide_banner \
          -loglevel error \
          -y \
          -i "$input" \
          -map 0:v:0 \
          -vf "$filter" \
          -an \
          -movflags +faststart \
          "$temporary"; then
        echo "Error: grading failed for raw/$asset" >&2
        exit 1
      fi
      ;;
    *)
      if ! ffmpeg \
          -hide_banner \
          -loglevel error \
          -y \
          -i "$input" \
          -map 0:v:0 \
          -vf "$filter" \
          -frames:v 1 \
          "$temporary"; then
        echo "Error: grading failed for raw/$asset" >&2
        exit 1
      fi
      ;;
  esac

  if [[ ! -s "$temporary" ]]; then
    echo "Error: grading produced an empty output for raw/$asset" >&2
    exit 1
  fi

  mv -f -- "$temporary" "$output"
  active_temp=""
  processed=$((processed + 1))
done

echo "Graded $processed asset(s) into raw/graded/; skipped $skipped missing input(s)."
echo "Original downloads in raw/ were not modified."
