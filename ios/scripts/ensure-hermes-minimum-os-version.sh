#!/bin/sh
set -eu

plist_path="${1:-}"
minimum_os_version="${HERMES_MINIMUM_IOS_VERSION:-15.1}"

if [ -z "$plist_path" ]; then
  echo "error: Missing Hermes Info.plist path." >&2
  exit 1
fi

if [ ! -f "$plist_path" ]; then
  echo "error: Hermes Info.plist not found at $plist_path." >&2
  exit 1
fi

if /usr/libexec/PlistBuddy -c "Print :MinimumOSVersion" "$plist_path" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Set :MinimumOSVersion $minimum_os_version" "$plist_path"
else
  /usr/libexec/PlistBuddy -c "Add :MinimumOSVersion string $minimum_os_version" "$plist_path"
fi

actual_value="$(/usr/libexec/PlistBuddy -c "Print :MinimumOSVersion" "$plist_path" 2>/dev/null || true)"
if [ "$actual_value" != "$minimum_os_version" ]; then
  echo "error: Hermes MinimumOSVersion is '$actual_value', expected '$minimum_os_version'." >&2
  exit 1
fi

echo "Set hermesvm.framework MinimumOSVersion to $minimum_os_version"
