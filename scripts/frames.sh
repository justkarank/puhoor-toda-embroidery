#!/usr/bin/env bash

set -euo pipefail
shopt -s nullglob

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="${1:-"$PROJECT_ROOT/raw"}"
GRADED_DIR="${2:-"$RAW_DIR/graded"}"
ASSET_DIR="${3:-"$PROJECT_ROOT/public/assets"}"
STILL_WEBP_QUALITY=62
NILGIRIS_WEBP_QUALITY=62
CLOSING_WEBP_QUALITY=62
HERO_SEQUENCE_WIDTH=1440
OTHER_SEQUENCE_WIDTH=1600
MAX_SEQUENCE_FRAME_BYTES=71680
TOTAL_ASSET_BUDGET_BYTES=12582912
PAYLOAD_SAFETY_BYTES=131072
HERO_CANDIDATE_DIR=""

for tool in ffmpeg cwebp dwebp node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Error: $tool is required by scripts/frames.sh." >&2
    exit 1
  fi
done

if [[ ! -d "$GRADED_DIR" ]]; then
  echo "Skipping frame processing: graded asset directory not found: $GRADED_DIR"
  exit 0
fi

mkdir -p \
  "$ASSET_DIR/hero" \
  "$ASSET_DIR/construction" \
  "$ASSET_DIR/motifs" \
  "$ASSET_DIR/nilgiris" \
  "$ASSET_DIR/artisans" \
  "$ASSET_DIR/closing" \
  "$ASSET_DIR/textures"

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/toda-frames.XXXXXX")"
cleanup() {
  rm -rf -- "$TEMP_ROOT"
  if [[ -n "$HERO_CANDIDATE_DIR" ]]; then
    rm -rf -- "$HERO_CANDIDATE_DIR"
  fi
}
trap cleanup EXIT

webp_still() {
  local input="$1"
  local output="$2"

  if [[ ! -f "$input" ]]; then
    echo "Skipping missing input: $input"
    return 0
  fi

  cwebp -quiet -q "$STILL_WEBP_QUALITY" "$input" -o "$output"
}

quantise_motif() {
  local input="$1"
  local output="$2"
  local cloth_distance
  local black_distance
  local red_distance
  local nearest_cloth
  local nearest_black
  local filter

  cloth_distance="pow(r(X,Y)-228,2)+pow(g(X,Y)-218,2)+pow(b(X,Y)-198,2)"
  black_distance="pow(r(X,Y)-21,2)+pow(g(X,Y)-19,2)+pow(b(X,Y)-19,2)"
  red_distance="pow(r(X,Y)-196,2)+pow(g(X,Y)-18,2)+pow(b(X,Y)-47,2)"
  nearest_cloth="lte($cloth_distance,$black_distance)*lte($cloth_distance,$red_distance)"
  nearest_black="lte($black_distance,$red_distance)"
  filter="geq=r='if($nearest_cloth,228,if($nearest_black,21,196))':g='if($nearest_cloth,218,if($nearest_black,19,18))':b='if($nearest_cloth,198,if($nearest_black,19,47))'"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -i "$input" \
    -vf "$filter" \
    -frames:v 1 \
    "$output"
}

extract_sampled_frames() {
  local input="$1"
  local count="$2"
  local output_dir="$3"
  local sequence_width="${4:-"$OTHER_SEQUENCE_WIDTH"}"
  local normalise_wide="${5:-0}"
  local full_dir="$TEMP_ROOT/full-$(basename "$output_dir")"
  local frame_filter="fps=24,scale=$sequence_width:-2:flags=lanczos"
  local source_count
  local extracted_frames
  local destination_index
  local sample_position
  local source_index
  local source_name
  local destination_name

  mkdir -p "$full_dir" "$output_dir"

  if [[ "$normalise_wide" == "1" ]]; then
    frame_filter="$frame_filter,crop=iw:trunc(iw*9/21/2)*2:0:(ih-oh)/2"
  fi

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -i "$input" \
    -vf "$frame_filter" \
    -start_number 1 \
    "$full_dir/%04d.png"

  extracted_frames=("$full_dir"/*.png)
  source_count="${#extracted_frames[@]}"

  if (( source_count < count )); then
    echo "Error: $input produced $source_count frames at 24fps; $count are required." >&2
    exit 1
  fi

  for ((destination_index = 1; destination_index <= count; destination_index += 1)); do
    sample_position=$((destination_index - 1))

    if (( count == 1 )); then
      source_index=1
    else
      source_index=$((1 + (sample_position * (source_count - 1) + (count - 1) / 2) / (count - 1)))
    fi

    printf -v source_name '%04d.png' "$source_index"
    printf -v destination_name '%04d.png' "$destination_index"
    cp "$full_dir/$source_name" "$output_dir/$destination_name"
  done
}

build_hero_sequence() {
  local first_input="$GRADED_DIR/hero-1.mp4"
  local second_input="$GRADED_DIR/hero-2.mp4"
  local selected_width="$HERO_SEQUENCE_WIDTH"
  local minimum_target=49152
  local non_hero_bytes
  local available_hero_budget
  local hero_frame_target_bytes
  local candidate_bytes
  local candidate_count
  local candidate_largest
  local projected_total
  local frame_index
  local frame_name
  local previous_dir
  local source_index
  local source_name
  local output_name

  if [[ ! -f "$first_input" || ! -f "$second_input" ]]; then
    [[ -f "$first_input" ]] || echo "Skipping hero sequence: missing input $first_input"
    [[ -f "$second_input" ]] || echo "Skipping hero sequence: missing input $second_input"
    return 0
  fi

  non_hero_bytes="$(
    node --input-type=module - "$ASSET_DIR" <<'NODE'
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const assetRoot = path.resolve(process.argv[2]);
const heroRoot = path.join(assetRoot, 'hero') + path.sep;

async function walk(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

const files = (await walk(assetRoot)).filter(
  (filename) => !filename.startsWith(heroRoot),
);
const sizes = await Promise.all(
  files.map(async (filename) => (await stat(filename)).size),
);
console.log(sizes.reduce((total, size) => total + size, 0));
NODE
  )"
  available_hero_budget=$((
    TOTAL_ASSET_BUDGET_BYTES -
      non_hero_bytes -
      PAYLOAD_SAFETY_BYTES
  ))
  hero_frame_target_bytes=$((available_hero_budget / 96 - 512))
  if (( hero_frame_target_bytes > 69632 )); then
    hero_frame_target_bytes=69632
  fi

  while true; do
    if (( selected_width == 1440 && hero_frame_target_bytes < minimum_target )); then
      selected_width=1360
      minimum_target=45056
      hero_frame_target_bytes=$((available_hero_budget / 96 - 512))
      if (( hero_frame_target_bytes > 69632 )); then
        hero_frame_target_bytes=69632
      fi
    fi

    if (( hero_frame_target_bytes < minimum_target )); then
      echo "Error: Hero cannot satisfy the payload limits at ${selected_width}px without dropping below ${minimum_target} target bytes." >&2
      return 1
    fi

    local first_dir="$TEMP_ROOT/hero-${selected_width}-1"
    local second_dir="$TEMP_ROOT/hero-${selected_width}-2"
    local final_dir="$TEMP_ROOT/hero-${selected_width}-final"
    rm -rf -- "$first_dir" "$second_dir" "$final_dir"
    extract_sampled_frames \
      "$first_input" \
      48 \
      "$first_dir" \
      "$selected_width" \
      1
    extract_sampled_frames \
      "$second_input" \
      48 \
      "$second_dir" \
      "$selected_width" \
      1
    mkdir -p "$final_dir"

    for ((source_index = 1; source_index <= 48; source_index += 1)); do
      printf -v source_name '%04d.png' "$source_index"
      printf -v output_name '%04d.png' "$source_index"
      cp "$first_dir/$source_name" "$final_dir/$output_name"
    done

    for ((source_index = 1; source_index <= 48; source_index += 1)); do
      printf -v source_name '%04d.png' "$source_index"
      printf -v output_name '%04d.png' "$((source_index + 48))"
      cp "$second_dir/$source_name" "$final_dir/$output_name"
    done

    HERO_CANDIDATE_DIR="$ASSET_DIR/.hero-candidate.$$"
    rm -rf -- "$HERO_CANDIDATE_DIR"
    mkdir -p "$HERO_CANDIDATE_DIR"

    for ((frame_index = 1; frame_index <= 96; frame_index += 1)); do
      printf -v frame_name '%04d' "$frame_index"
      cwebp \
        -quiet \
        -preset photo \
        -m 6 \
        -pass 10 \
        -size "$hero_frame_target_bytes" \
        "$final_dir/$frame_name.png" \
        -o "$HERO_CANDIDATE_DIR/$frame_name.webp"
    done

    candidate_count=0
    candidate_bytes=0
    candidate_largest=0
    local candidate_valid=1
    for ((frame_index = 1; frame_index <= 96; frame_index += 1)); do
      printf -v frame_name '%04d.webp' "$frame_index"
      local candidate="$HERO_CANDIDATE_DIR/$frame_name"
      if [[ ! -s "$candidate" ]] || ! dwebp -quiet "$candidate" -o /dev/null; then
        candidate_valid=0
        break
      fi
      local frame_bytes
      frame_bytes="$(node -e 'const fs=require("node:fs"); console.log(fs.statSync(process.argv[1]).size)' "$candidate")"
      candidate_count=$((candidate_count + 1))
      candidate_bytes=$((candidate_bytes + frame_bytes))
      if (( frame_bytes > candidate_largest )); then
        candidate_largest=$frame_bytes
      fi
    done
    projected_total=$((non_hero_bytes + candidate_bytes))

    if (
      ((
        candidate_valid == 1 &&
          candidate_count == 96 &&
          candidate_largest <= MAX_SEQUENCE_FRAME_BYTES &&
          projected_total <= TOTAL_ASSET_BUDGET_BYTES
      ))
    ); then
      previous_dir="$ASSET_DIR/.hero-previous.$$"
      rm -rf -- "$previous_dir"
      mv "$ASSET_DIR/hero" "$previous_dir"
      if mv "$HERO_CANDIDATE_DIR" "$ASSET_DIR/hero"; then
        HERO_CANDIDATE_DIR=""
        rm -rf -- "$previous_dir"
        echo "Hero payload selected: width=$selected_width target=$hero_frame_target_bytes bytes=$candidate_bytes largest=$candidate_largest projected_total=$projected_total"
        return 0
      fi
      mv "$previous_dir" "$ASSET_DIR/hero"
      echo "Error: failed to install the complete Hero candidate." >&2
      return 1
    fi

    rm -rf -- "$HERO_CANDIDATE_DIR"
    HERO_CANDIDATE_DIR=""
    hero_frame_target_bytes=$((hero_frame_target_bytes - 1024))
  done
}

encode_sequence() {
  local input_dir="$1"
  local output_dir="$2"
  local count="$3"
  local quality="$4"
  local encoded_frames
  local actual_count
  local frame_index
  local frame_name

  find "$output_dir" -type f -name '*.webp' -delete

  for ((frame_index = 1; frame_index <= count; frame_index += 1)); do
    printf -v frame_name '%04d.webp' "$frame_index"
    cwebp \
      -quiet \
      -q "$quality" \
      "$input_dir/${frame_name%.webp}.png" \
      -o "$output_dir/$frame_name"
  done

  encoded_frames=("$output_dir"/*.webp)
  actual_count="${#encoded_frames[@]}"

  if (( actual_count != count )); then
    echo "Error: $output_dir contains $actual_count WebP frames; $count are required." >&2
    exit 1
  fi
}

if [[ "${TODA_HERO_ONLY:-0}" == "1" ]]; then
  echo "Building only the 96-frame Hero sequence..."
  build_hero_sequence
  exit 0
fi

echo "Processing construction stills..."
webp_still "$GRADED_DIR/construction-front.png" "$ASSET_DIR/construction/front.webp"
webp_still "$GRADED_DIR/construction-back.png" "$ASSET_DIR/construction/back.webp"
webp_still "$GRADED_DIR/construction-reverse-macro.png" "$ASSET_DIR/construction/reverse-macro.webp"

echo "Quantising and processing motif stills..."
for motif_index in {1..6}; do
  motif_input="$GRADED_DIR/motif-$motif_index.png"
  if [[ ! -f "$motif_input" ]]; then
    echo "Skipping missing input: $motif_input"
    continue
  fi

  quantised="$TEMP_ROOT/motif-$motif_index.png"
  quantise_motif "$motif_input" "$quantised"
  webp_still "$quantised" "$ASSET_DIR/motifs/$motif_index.webp"
done

echo "Processing artisan stills..."
for artisan_index in {1..4}; do
  webp_still \
    "$GRADED_DIR/artisans-$artisan_index.png" \
    "$ASSET_DIR/artisans/$artisan_index.webp"
done

echo "Processing texture stills..."
webp_still "$GRADED_DIR/texture-cloth.png" "$ASSET_DIR/textures/texture-cloth.webp"
webp_still "$GRADED_DIR/texture-red.png" "$ASSET_DIR/textures/texture-red.webp"
webp_still "$GRADED_DIR/texture-folds.png" "$ASSET_DIR/textures/texture-folds.webp"

echo "Building the 96-frame hero sequence..."
build_hero_sequence

echo "Building the 72-frame Nilgiris sequence..."
if [[ -f "$GRADED_DIR/nilgiris.mp4" ]]; then
  extract_sampled_frames "$GRADED_DIR/nilgiris.mp4" 72 "$TEMP_ROOT/nilgiris"
  encode_sequence \
    "$TEMP_ROOT/nilgiris" \
    "$ASSET_DIR/nilgiris" \
    72 \
    "$NILGIRIS_WEBP_QUALITY"
else
  echo "Skipping Nilgiris sequence: missing input $GRADED_DIR/nilgiris.mp4"
fi

echo "Building the forward 72-frame closing sequence..."
if [[ -f "$GRADED_DIR/closing.mp4" ]]; then
  extract_sampled_frames "$GRADED_DIR/closing.mp4" 72 "$TEMP_ROOT/closing"
  encode_sequence \
    "$TEMP_ROOT/closing" \
    "$ASSET_DIR/closing" \
    72 \
    "$CLOSING_WEBP_QUALITY"
else
  echo "Skipping Closing sequence: missing input $GRADED_DIR/closing.mp4"
fi

oversized_count="$(
  find \
    "$ASSET_DIR/hero" \
    "$ASSET_DIR/nilgiris" \
    "$ASSET_DIR/closing" \
    -type f \
    -name '*.webp' \
    -size +70k \
    | wc -l \
    | tr -d ' '
)"

if (( oversized_count > 0 )); then
  echo "Warning: $oversized_count sequence frame(s) exceed the 70KB target." >&2
fi

echo "Asset processing complete."
echo "Hero target: 96 frames. Nilgiris target: 72 frames. Closing target: 72 forward frames."
echo "Missing inputs were skipped without removing existing outputs."
echo "All sequence files use four-digit names from 0001.webp."
echo "Hero uses target-byte encoding. Nilgiris quality: $NILGIRIS_WEBP_QUALITY. Closing quality: $CLOSING_WEBP_QUALITY."
