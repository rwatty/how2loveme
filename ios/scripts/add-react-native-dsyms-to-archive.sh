#!/bin/bash
set -euo pipefail

APP_NAME="${APP_NAME:-How2LoveMe}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"

if [[ $# -gt 0 ]]; then
  ARCHIVE_PATH="$1"
else
  ARCHIVE_PATH="$(find "$HOME/Library/Developer/Xcode/Archives" -maxdepth 4 -name "${APP_NAME} *.xcarchive" -print 2>/dev/null | sort | tail -1)"
fi

if [[ -z "${ARCHIVE_PATH:-}" || ! -d "$ARCHIVE_PATH" ]]; then
  echo "error: Could not find an ${APP_NAME} .xcarchive. Pass the archive path as the first argument." >&2
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  echo "error: package.json not found at $PROJECT_ROOT/package.json" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/node_modules/react-native/sdks/hermes-engine/version.properties" ]]; then
  echo "error: Hermes version file not found. Run npm install first." >&2
  exit 1
fi

RN_VERSION="$(
  node -e "const p=require('$PROJECT_ROOT/package.json'); const v=(p.dependencies&&p.dependencies['react-native'])||(p.devDependencies&&p.devDependencies['react-native']); if (!v) process.exit(1); console.log(String(v).replace(/^[^0-9]*/, ''))"
)"
HERMES_VERSION="$(awk -F= '/^HERMES_VERSION_NAME=/{print $2}' "$PROJECT_ROOT/node_modules/react-native/sdks/hermes-engine/version.properties")"

APP_RELATIVE_PATH="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:ApplicationPath' "$ARCHIVE_PATH/Info.plist")"
APP_PATH="$ARCHIVE_PATH/Products/$APP_RELATIVE_PATH"
FRAMEWORKS_DIR="$APP_PATH/Frameworks"
DSYM_DIR="$ARCHIVE_PATH/dSYMs"

if [[ ! -d "$FRAMEWORKS_DIR" ]]; then
  echo "error: Frameworks directory not found at $FRAMEWORKS_DIR" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/how2loveme-rn-dsyms.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

download() {
  local url="$1"
  local output="$2"

  echo "Downloading $(basename "$output")"
  /usr/bin/curl -fL "$url" -o "$output"
}

RN_ARTIFACT_BASE="https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/$RN_VERSION"
HERMES_ARTIFACT_BASE="https://repo1.maven.org/maven2/com/facebook/hermes/hermes-ios/$HERMES_VERSION"

download "$RN_ARTIFACT_BASE/react-native-artifacts-$RN_VERSION-reactnative-core-dSYM-release.tar.gz" "$TMP_DIR/reactnative-core-dSYM-release.tar.gz"
download "$RN_ARTIFACT_BASE/react-native-artifacts-$RN_VERSION-reactnative-dependencies-dSYM-release.tar.gz" "$TMP_DIR/reactnative-dependencies-dSYM-release.tar.gz"
download "$HERMES_ARTIFACT_BASE/hermes-ios-$HERMES_VERSION-hermes-framework-dSYM-release.tar.gz" "$TMP_DIR/hermes-framework-dSYM-release.tar.gz"

mkdir -p "$TMP_DIR/extracted"
tar -xzf "$TMP_DIR/reactnative-core-dSYM-release.tar.gz" -C "$TMP_DIR/extracted"
tar -xzf "$TMP_DIR/reactnative-dependencies-dSYM-release.tar.gz" -C "$TMP_DIR/extracted"
tar -xzf "$TMP_DIR/hermes-framework-dSYM-release.tar.gz" -C "$TMP_DIR/extracted"

expected_uuid() {
  local framework_name="$1"
  local binary_name="$2"

  dwarfdump --uuid "$FRAMEWORKS_DIR/$framework_name.framework/$binary_name" | awk '/arm64/ {print $2; exit}'
}

verify_and_copy() {
  local framework_name="$1"
  local binary_name="$2"
  local dsym_path="$3"
  local uuid

  uuid="$(expected_uuid "$framework_name" "$binary_name")"
  if [[ -z "$uuid" ]]; then
    echo "error: Could not read UUID for $framework_name.framework" >&2
    exit 1
  fi

  if ! dwarfdump --uuid "$dsym_path" | grep -q "$uuid"; then
    echo "error: $dsym_path does not contain expected UUID $uuid" >&2
    exit 1
  fi

  mkdir -p "$DSYM_DIR"
  rm -rf "$DSYM_DIR/$framework_name.framework.dSYM"
  cp -R "$dsym_path" "$DSYM_DIR/"
  echo "Added $framework_name.framework.dSYM ($uuid)"
}

verify_and_copy "React" "React" "$TMP_DIR/extracted/ios-arm64/React.framework.dSYM"
verify_and_copy "ReactNativeDependencies" "ReactNativeDependencies" "$TMP_DIR/extracted/ios-arm64/ReactNativeDependencies.framework.dSYM"
verify_and_copy "hermesvm" "hermesvm" "$TMP_DIR/extracted/iphoneos/hermesvm.framework.dSYM"

echo "Done. Archive updated:"
echo "$ARCHIVE_PATH"
