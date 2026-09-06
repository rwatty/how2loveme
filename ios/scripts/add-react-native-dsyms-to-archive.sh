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
HERMES_MINIMUM_IOS_VERSION="${HERMES_MINIMUM_IOS_VERSION:-15.1}"

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

download_and_extract() {
  local url="$1"
  local output="$2"

  download "$url" "$output"
  mkdir -p "$TMP_DIR/extracted"
  tar -xzf "$output" -C "$TMP_DIR/extracted"
}

framework_embedded() {
  local framework_name="$1"
  local binary_name="$2"

  [[ -f "$FRAMEWORKS_DIR/$framework_name.framework/$binary_name" ]]
}

hermes_built_from_source() {
  grep -Eq "RCT_BUILD_HERMES_FROM_SOURCE.*true" "$IOS_DIR/Podfile"
}

set_minimum_os_version() {
  local plist_path="$1"
  local current_value

  if [[ ! -f "$plist_path" ]]; then
    echo "warning: Hermes Info.plist not found at $plist_path" >&2
    return
  fi

  if /usr/libexec/PlistBuddy -c "Print :MinimumOSVersion" "$plist_path" >/dev/null 2>&1; then
    if ! /usr/libexec/PlistBuddy -c "Set :MinimumOSVersion $HERMES_MINIMUM_IOS_VERSION" "$plist_path"; then
      echo "error: Could not update MinimumOSVersion in $plist_path" >&2
      exit 1
    fi
  else
    if ! /usr/libexec/PlistBuddy -c "Add :MinimumOSVersion string $HERMES_MINIMUM_IOS_VERSION" "$plist_path"; then
      echo "error: Could not add MinimumOSVersion to $plist_path" >&2
      exit 1
    fi
  fi

  current_value="$(/usr/libexec/PlistBuddy -c "Print :MinimumOSVersion" "$plist_path" 2>/dev/null || true)"
  if [[ "$current_value" != "$HERMES_MINIMUM_IOS_VERSION" ]]; then
    echo "error: MinimumOSVersion in $plist_path is '$current_value', expected '$HERMES_MINIMUM_IOS_VERSION'." >&2
    exit 1
  fi

  echo "Set hermesvm.framework MinimumOSVersion to $HERMES_MINIMUM_IOS_VERSION"
}

RN_ARTIFACT_BASE="https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/$RN_VERSION"
HERMES_ARTIFACT_BASE="https://repo1.maven.org/maven2/com/facebook/hermes/hermes-ios/$HERMES_VERSION"

set_minimum_os_version "$FRAMEWORKS_DIR/hermesvm.framework/Info.plist"

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

  if [[ ! -f "$FRAMEWORKS_DIR/$framework_name.framework/$binary_name" ]]; then
    echo "Skipping $framework_name.framework; it is not embedded in this archive."
    return
  fi

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

copy_matching_dsym() {
  local framework_name="$1"
  local binary_name="$2"
  local dsym_path="$3"
  local uuid

  if [[ ! -f "$FRAMEWORKS_DIR/$framework_name.framework/$binary_name" ]]; then
    echo "Skipping $framework_name.framework; it is not embedded in this archive."
    return 0
  fi

  if [[ ! -d "$dsym_path" ]]; then
    return 1
  fi

  uuid="$(expected_uuid "$framework_name" "$binary_name")"
  if [[ -z "$uuid" ]]; then
    echo "error: Could not read UUID for $framework_name.framework" >&2
    exit 1
  fi

  if ! dwarfdump --uuid "$dsym_path" | grep -q "$uuid"; then
    return 1
  fi

  mkdir -p "$DSYM_DIR"
  rm -rf "$DSYM_DIR/$framework_name.framework.dSYM"
  cp -R "$dsym_path" "$DSYM_DIR/"
  echo "Added $framework_name.framework.dSYM ($uuid)"
}

generate_and_copy_dsym() {
  local framework_name="$1"
  local binary_name="$2"
  local binary_path="$FRAMEWORKS_DIR/$framework_name.framework/$binary_name"
  local generated_dsym="$TMP_DIR/$framework_name.framework.dSYM"
  local uuid

  if [[ ! -f "$binary_path" ]]; then
    echo "Skipping $framework_name.framework; it is not embedded in this archive."
    return
  fi

  uuid="$(expected_uuid "$framework_name" "$binary_name")"
  if [[ -z "$uuid" ]]; then
    echo "error: Could not read UUID for $framework_name.framework" >&2
    exit 1
  fi

  rm -rf "$generated_dsym"
  dsymutil "$binary_path" -o "$generated_dsym"

  if ! dwarfdump --uuid "$generated_dsym" | grep -q "$uuid"; then
    echo "error: Generated dSYM does not contain expected UUID $uuid" >&2
    exit 1
  fi

  mkdir -p "$DSYM_DIR"
  rm -rf "$DSYM_DIR/$framework_name.framework.dSYM"
  cp -R "$generated_dsym" "$DSYM_DIR/"
  echo "Generated $framework_name.framework.dSYM ($uuid)"
}

if framework_embedded "React" "React"; then
  download_and_extract "$RN_ARTIFACT_BASE/react-native-artifacts-$RN_VERSION-reactnative-core-dSYM-release.tar.gz" "$TMP_DIR/reactnative-core-dSYM-release.tar.gz"
  verify_and_copy "React" "React" "$TMP_DIR/extracted/ios-arm64/React.framework.dSYM"
else
  echo "Skipping React.framework; it is not embedded in this archive."
fi

if framework_embedded "ReactNativeDependencies" "ReactNativeDependencies"; then
  download_and_extract "$RN_ARTIFACT_BASE/react-native-artifacts-$RN_VERSION-reactnative-dependencies-dSYM-release.tar.gz" "$TMP_DIR/reactnative-dependencies-dSYM-release.tar.gz"
  verify_and_copy "ReactNativeDependencies" "ReactNativeDependencies" "$TMP_DIR/extracted/ios-arm64/ReactNativeDependencies.framework.dSYM"
else
  echo "Skipping ReactNativeDependencies.framework; it is not embedded in this archive."
fi

if framework_embedded "hermesvm" "hermesvm"; then
  if hermes_built_from_source; then
    echo "Hermes is built from source; generating dSYM from the archived binary."
    generate_and_copy_dsym "hermesvm" "hermesvm"
  else
    download_and_extract "$HERMES_ARTIFACT_BASE/hermes-ios-$HERMES_VERSION-hermes-framework-dSYM-release.tar.gz" "$TMP_DIR/hermes-framework-dSYM-release.tar.gz"

    if ! copy_matching_dsym "hermesvm" "hermesvm" "$TMP_DIR/extracted/iphoneos/hermesvm.framework.dSYM"; then
      echo "Hermes prebuilt dSYM does not match this archive; generating one from the archived binary."
      generate_and_copy_dsym "hermesvm" "hermesvm"
    fi
  fi
else
  echo "Skipping hermesvm.framework; it is not embedded in this archive."
fi

echo "Done. Archive updated:"
echo "$ARCHIVE_PATH"
