# Chinese mobile build notes

This branch tracks upstream **v2.2.0** (the Chinese fork's release line; current
native defaults `2.2.0-zh` / code `220`).

## Manual Android build

The fork provides `.github/workflows/android-zh-debug.yml`. It runs only through `workflow_dispatch` on GitHub-hosted Ubuntu, uses JDK 21, Node 22 and Bun 1.4.2, installs Android SDK 35, builds the shared mobile UI, syncs Android only, and runs `assembleDebug`. No release signing secrets are required. The debug APK uses the runner's generated debug certificate and is not a production release.

In GitHub Actions, select **Android Chinese debug APK**, choose **Run workflow**, then download `openchamber-zh-android-debug` after a successful run. Build output: `packages/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. The existing release and smoke workflows are unchanged.

For a local build with JDK 21 and Android SDK 35 configured:

```sh
bun install --frozen-lockfile
bun run mobile:build
cd packages/mobile
bunx cap sync android
cd android
./gradlew assembleDebug --no-daemon
```

On Windows, use `gradlew.bat assembleDebug --no-daemon` for the last command. Do not run install, launch or simulator scripts just to build an APK.

## Manual iOS build (unsigned IPA, no paid Apple account)

The fork provides `.github/workflows/ios-zh-unsigned.yml`. It runs only through `workflow_dispatch` on GitHub-hosted macOS (`macos-15`). It installs dependencies with Bun, builds the shared mobile UI, syncs iOS with Capacitor, runs `pod install`, then `xcodebuild archive` with `CODE_SIGNING_ALLOWED=NO`, an empty team and `-allowProvisioningUpdates=NO`. The resulting `.app` is copied into a `Payload/` directory and zipped into an IPA. No Apple certificate, provisioning profile, App Store Connect key or paid developer account is used, and the official `release.yml` / `mobile-release.yml` TestFlight job is untouched. The IPA is uploaded as the artifact `openchamber-zh-ios-unsigned`.

**The IPA is completely unsigned.** `codesign` reports "code object is not signed at all". It cannot be installed as-is; iOS requires a signature. You must re-sign it locally yourself before it will run on a device.

### Why it is unsigned, and what signing options exist

Apple only allows installing signed apps. Without a paid Apple Developer account the realistic non-jailbreak routes are:

| Route | Account required | UDID registration | Validity | User effort |
| --- | --- | --- | --- | --- |
| Free Apple ID self-sign (Sideloadly / AltStore / SideStore) | Free Apple ID | Yes, device UDID is registered to the account on first sideload (free accounts are limited to 3 device UDIDs and 3 installed apps per 7-day window) | 7 days, then re-sign | Install the desktop tool, connect the device, sign with the Apple ID |
| Paid Apple Developer account development/ad-hoc signing | Paid (99 USD/year) | Ad-hoc needs registered UDIDs; development profile too | Development ~1 year, ad-hoc profile ~1 year | Import cert + provisioning profile, re-sign |
| Paid Apple Developer Enterprise / custom enterprise distribution | Paid, requires an Apple-issued Enterprise program membership | No UDID for In-House, but Apple approval needed | Certificate/profile expiry | Not available to individuals on request |

All of these are **signing you perform on your own machine with your own account**. This fork does not ship, embed or use anyone's certificate, and nothing here promises free long-term validity. The 7-day free-account limit is a hard Apple restriction, not a build setting; there is no free permanent option.

### Install steps (free Apple ID route, e.g. Sideloadly)

1. Download the artifact IPA from the workflow run page (artifact `openchamber-zh-ios-unsigned`).
2. Install and open Sideloadly (or AltStore / SideStore) on a Windows or macOS computer.
3. Connect the iPhone/iPad by USB and trust the computer.
4. Drag the IPA into the tool, enter your own Apple ID, and start. The tool signs the app locally and installs it.
5. On the device, trust the developer profile under Settings > General > VPN & Device Management.
6. The app becomes unusable after 7 days; re-run the same tool to re-sign. With AltStore/SideStore, enable automatic refresh so it re-signs in the background while on the same Wi-Fi.

For a paid Developer account or your own certificate, sign the IPA with that identity in Sideloadly, Xcode (Devices and Simulators > drag the IPA) or `codesign` + `ideviceinstaller`, then install.

### Known limitations of this unsigned build

- **Push notifications do not work.** `CODE_SIGNING_ALLOWED=NO` embeds no entitlements, and the `aps-environment` entitlement needs a matching provisioning profile. Even after free re-signing, a free Apple ID cannot enable the Push Notifications capability. The app can still reach servers over LAN/relay and show in-app state; don't expect APNs alerts.
- **Widget / Control Center data sharing may not work.** The app and widget share an App Group (`group.com.openchamber.app`). Free Apple IDs cannot provision App Groups, so after free re-signing the widget extension can install but cannot read the app's snapshot; it will show its empty state. Paid accounts with the App Group capability can restore this.
- **Extension re-signing must cover all three bundles.** The IPA contains the app, `OpenChamberWidget.appex` and `OpenChamberNotificationService.appex`. Sideloadly/AltStore re-sign all nested bundles automatically; if you sign manually, sign the extensions before the outer app.
- Only `workflow_dispatch` triggers it. It does not run on push and does not affect other workflows.

## iOS app icon aligned to the Android launcher icon

The Chinese fork's launcher icon is the Android one: a white `#FFFFFF` adaptive
background (`res/values/ic_launcher_background.xml`) with the logo inset 16.7%,
flattened into `packages/mobile/assets/icon-only.png` (1024x1024, fully opaque).
`AppIcon-512@2x.png` is a byte-for-byte-color copy of that baseline, converted
to opaque RGB.

iOS app icons must not carry an alpha channel and must not contain pre-rounded
corners (iOS applies its own mask), so the export only drops the fully opaque
alpha channel and never composites or rounds anything. Because every pixel of
the baseline is already `alpha=255`, no background choice is involved.

Reproduce and verify:

```sh
# Regenerate the iOS icon from the Android baseline (refuses transparent input)
python packages/mobile/scripts/zh-export-ios-icon.py

# Verify the iOS icon against the Android baseline (fails above tolerance)
python packages/mobile/scripts/zh-icon-compare.py \
  --baseline packages/mobile/assets/icon-only.png \
  --candidate packages/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
  --tolerance 0.5
```

The compare script flattens any alpha onto white (so an accidentally
transparent PNG is caught, not silently accepted) and reports mean absolute
diff per channel, RMS, the diff bounding box and the max channel diff.

Measured result after alignment on the v2.2.0 baseline (baseline vs. iOS icon,
both 1024x1024 RGB):

- mean abs diff per channel: R 0.0000, G 0.0000, B 0.0000 (overall 0.0000)
- RMS diff per channel: 0.0000 / 0.0000 / 0.0000
- diff bounding box: `None` (no differing pixel anywhere)
- max channel diff: 0
- result: PASS

### Other iOS icon references checked

- `App` target uses `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`, i.e. only
  `App/Assets.xcassets/AppIcon.appiconset`. Its `Contents.json` already declares
  the single modern `1024x1024` universal iOS slot, so no change was needed.
- `App/Info.plist` has no `CFBundleIcons` / `CFBundleAlternateIcons` key, and
  there is no `setAlternateIconName` call anywhere, so there is no second icon
  to align.
- `OpenChamberWidget` and `OpenChamberNotificationService` set no
  `ASSETCATALOG_COMPILER_APPICON_NAME`; app extensions do not carry their own
  launcher icon. The widget catalog's `OCLogoSymbol` is a template symbol used
  by `OpenChamberControl.swift`, not an app icon.
- The launch storyboard uses the `Splash` imageset (a 2732x2732 launch image),
  not an icon; its existing artwork is intentionally retained.
- The Android icons were not modified.

### The Icon Composer `.icon` was removed from the iOS target

The iOS project also referenced the shared desktop Icon Composer bundle
`packages/electron/resources/icons/AppIcon.icon` (an Xcode 26 Liquid Glass icon,
`folder.iconcomposer.icon`) and copied it into the app. On iOS 26 the system
prefers that `.icon` over the asset-catalog icon, so leaving it in place would
keep showing the old glass-style icon on modern devices and the asset-catalog
alignment above would have no visible effect there.

To make every iOS version show exactly the Android icon, the `AppIcon.icon`
references were removed from `App.xcodeproj/project.pbxproj` (the build-file
entry, the file reference, the group child and the resources-phase entry). The
iOS app now derives its icon solely from the aligned asset catalog, so iOS 26
falls back to that asset (with the system's automatic glass treatment) instead
of the separate `.icon`. The shared desktop icon file under
`packages/electron/resources/icons/` is untouched, so the Electron app keeps
its Liquid Glass icon.

Trade-off: the iOS 26-only hand-authored dark/tinted Liquid Glass variants of
that bundle are no longer shipped for iOS. This was accepted because the goal
is visual consistency with Android, and because an asset-catalog icon can be
verified pixel-exactly on this machine while an Icon Composer bundle cannot be
rendered or validated without macOS (which this workspace does not have).

### Verified against the compiled icon inside the built IPA

The asset-catalog check above only proves the source PNG matches. To prove the
shipped IPA actually carries that icon, `scripts/zh-verify-ipa-icon.py` decodes
the compiled `AppIcon*.png` files inside `Payload/App.app` and compares them to
the baseline. Xcode writes those as Apple CgBI (optimized) PNGs, which Pillow
cannot read correctly, so the script decodes CgBI itself (raw deflate, BGRA,
premultiplied) before comparing.

Run (after unzipping the IPA):

```sh
python packages/mobile/scripts/zh-verify-ipa-icon.py --app path/to/Payload/App.app
```

## Localization audit boundary

- Mobile connection, QR scan, authentication, navigation, sessions, files, changes and shared settings already use the shared i18n dictionaries. The Chinese mobile namespace retains only the URL example and `MCP` identical to English after this audit.
- Fixed English units in mobile relative timestamps and untranslated Chinese relative-time dictionary values. Fixed mixed-English changes descriptions.
- Android FileShare errors and the sealed push notification channel now use native resources with simplified/traditional Chinese variants (`values-zh-rCN`, `values-zh-rTW`). Android permission dialogs use the OS language. Product name `OpenChamber`, model/provider names, user content, paths and protocols stay unchanged.
- Added iOS string catalogs (`InfoPlist.xcstrings`, `Localizable.xcstrings`) for camera, microphone and LAN permission explanations and the widget, wired into both the app and widget targets and into `knownRegions` as `zh-Hans`/`zh-Hant`. Native resources follow OS/app preferred language, independently of the in-WebView locale selector.
- Launch storyboard contains a splash image, not a text label. Existing artwork was retained. Android has no custom shortcut XML to translate; launcher labels retain the product name.
- Push title/body come from the connected server, templates or agent/user content. Mobile localization cannot guarantee Chinese server-generated payloads. Shared notification settings/test messages are localized; no blind replacement of external content was added.
- Backend/tool errors displayed verbatim in shared views can remain English. No device GUI or OS permission/notification runtime test was performed. This audit does not establish complete end-to-end translation of every reachable shared screen.

## Validation in this workspace

See the fork release notes / commit messages for the exact command list and
results for this upgrade. In short: `bun install`, UI/web/mobile type-checks,
the focused i18n, dictionary-audit, provider-discovery and mobile timestamp
tests, and the Electron web-assets build were run on this tree; the Chinese
dictionary was re-audited against the v2.2.0 English dictionary (a permanent
audit test lives at `tools/zh-dictionary-audit.test.ts`). No Windows/Android/iOS
installer was built here and no GUI was launched; that is left to the dedicated
build task.
