#!/usr/bin/env bash
set -euo pipefail

# Builds a signed release .ipa locally via Xcode instead of EAS's cloud build
# (default per ADR-003, docs/decisions/003-local-xcode-build-default.md).
# Produces ios/build/export/Klarity.ipa — run `npm run submit:local`
# afterward to upload it to App Store Connect.
#
# One-time prerequisite: Xcode must be signed into the Apple ID for team
# 22PRZ6YK2P (Xcode -> Settings -> Accounts -> "+"). This cannot be scripted.

TEAM_ID="22PRZ6YK2P"
SCHEME="Klarity"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v pod &> /dev/null; then
  echo "==> CocoaPods not found — installing via Homebrew"
  brew install cocoapods
fi

echo "==> Regenerating native iOS project (expo prebuild)"
cd "$ROOT_DIR"
npx expo prebuild -p ios --clean

echo "==> Installing CocoaPods dependencies"
cd "$ROOT_DIR/ios"
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install

echo "==> Archiving (compiles the full native app — several minutes on a clean prebuild)"
xcodebuild archive \
  -workspace "${SCHEME}.xcworkspace" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -archivePath "build/${SCHEME}.xcarchive" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="${TEAM_ID}" \
  CODE_SIGN_STYLE=Automatic

echo "==> Exporting signed .ipa for App Store Connect"
xcodebuild -exportArchive \
  -archivePath "build/${SCHEME}.xcarchive" \
  -exportPath "build/export" \
  -exportOptionsPlist "$ROOT_DIR/scripts/ios-export-options.plist" \
  -allowProvisioningUpdates

echo "==> Done: ios/build/export/${SCHEME}.ipa"
echo "Run 'npm run submit:local' to upload it to TestFlight."
