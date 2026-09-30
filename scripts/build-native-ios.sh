#!/usr/bin/env bash
# Native app → signed .ipa for App Store Connect (ADR-003 flow, minus Expo/CocoaPods).
#   npm run build:native   → native/build/export/Klarity.ipa
#   npm run submit:native  → uploads it to TestFlight (eas submit --path)
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
bash scripts/native-secrets.sh
(cd native && xcodegen generate --quiet)

echo "==> Archiving"
xcodebuild archive \
  -project native/Klarity.xcodeproj -scheme Klarity -configuration Release \
  -archivePath native/build/Klarity.xcarchive -destination "generic/platform=iOS" \
  -allowProvisioningUpdates -quiet

echo "==> Exporting signed .ipa for App Store Connect"
rm -rf native/build/export
xcodebuild -exportArchive \
  -archivePath native/build/Klarity.xcarchive -exportPath native/build/export \
  -exportOptionsPlist scripts/ios-export-options.plist -allowProvisioningUpdates -quiet

echo "==> Done: native/build/export/Klarity.ipa ($(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' native/build/Klarity.xcarchive/Products/Applications/Klarity.app/Info.plist) build $(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' native/build/Klarity.xcarchive/Products/Applications/Klarity.app/Info.plist))"
