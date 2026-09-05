# AGENTS.md

## Verification
- TypeScript: `npx tsc --noEmit`
- Android debug build: `./gradlew app:assembleDebug` (run from `android/`)
- iOS simulator build: `xcodebuild -workspace ios/How2LoveMe.xcworkspace -scheme How2LoveMe -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
- CocoaPods after native Firebase dependency changes: `pod install` (run from `ios/`)

## Mobile release config
- Android release signing reads from Gradle properties or environment variables: `HOW2LOVEME_RELEASE_STORE_FILE`, `HOW2LOVEME_RELEASE_STORE_PASSWORD`, `HOW2LOVEME_RELEASE_KEY_ALIAS`, `HOW2LOVEME_RELEASE_KEY_PASSWORD`.
- Validate Android release signing from the repo root with `npm run android:release:validate`.
- Build a signed Android release from the repo root with `npm run android:release`.
- iOS APNs entitlements use `APS_ENVIRONMENT`, with Debug set to `development` and Release set to `production` in the Xcode project.

## Real-device notification QA checklist
- iOS device: fresh install, sign in with a verified email, enable notifications, and confirm the permission prompt appears once and the app reports notifications as enabled.
- iOS device: background and foreground the app after enabling notifications to confirm the push token stays registered and no sign-out/permission edge case disables reminders unexpectedly.
- iOS device: send a partner reminder and confirm the recipient device receives the push while the app is foregrounded.
- iOS device: send a partner reminder and confirm the recipient device receives the push while the app is backgrounded or locked.
- iOS device: schedule at least one due Love Action reminder and confirm the local reminder fires at the expected time.
- iOS device: disable notifications in-app, confirm scheduled reminders are cancelled, then re-enable and confirm registration recovers.
- iOS device: revoke notification permission in Settings, relaunch the app, and confirm local state/token cleanup happens without a crash.
- Android device: repeat the same enable, foreground, background, partner reminder, scheduled reminder, disable, and Settings-revoke checks.

## Firebase / Firestore
- Firestore repo config lives at `firebase.json`, `firestore.rules`, and `firestore.indexes.json` in the repo root.
- Deploy Firestore config with Firebase CLI, for example:
  - `firebase --project <your-project-id> deploy --only firestore:rules`
  - `firebase --project <your-project-id> deploy --only firestore:indexes`
  - `firebase --project <your-project-id> deploy --only firestore`

## Firebase Functions
- Cloud Functions source lives in `functions/` and builds with `npm run build` from that directory.
- Required Functions params/secrets for invite delivery:
  - Secret: `RESEND_API_KEY`
  - Param: `INVITE_FROM_EMAIL`
  - Param: `APP_STORE_LINK` (optional; defaults to a plain in-app instruction string)
- Example setup and deploy commands:
  - `firebase --project <your-project-id> functions:secrets:set RESEND_API_KEY`
  - `firebase --project <your-project-id> deploy --only functions`
  - `firebase --project <your-project-id> deploy --only functions:sendPartnerInvite,functions:acceptPartnerInvite,functions:declinePartnerInvite,functions:cancelPartnerInvite`

## Runa gifting checklist
- Do not build past scaffolding until Runa confirms: consumer peer-to-peer gifting approval, Runa Shop vs direct API, wallet-capable product types, checkout ownership, webhook events/IDs, resend/cancel support, v1 country/currency scope, and any brand display restrictions.
- Keep all Runa API access server-side in `functions/`; never expose provider secrets to the React Native app.
- Preferred shared data model: `couples/{coupleId}/gifts/{giftId}` with gift event logs under `couples/{coupleId}/gifts/{giftId}/events/{eventId}`.
- Treat gifts as server-owned records: client may read as a couple member, but gift lifecycle writes should come only from Firebase Functions/webhooks.
- Planned Functions surface: `listGiftCatalog`, `createGiftCheckout`, `getGiftClaimDetails`, `resendGift`, `cancelGift`, plus an HTTP `runaWebhook` endpoint.
- Planned client integration: add a `useGiftStore` Zustand store, extend `startRelationshipSync` to subscribe to couple gifts, and add client wrappers in `src/lib/relationshipSync.ts` for gift callables.
- V1 UX scope: Love screen entry point, curated catalog, gift composer, gift history, gift detail/claim flow, partner-only gifting, and wallet buttons shown only when provider capability is true.
- Backend guardrails required before release: verified-email auth, connected-partner validation, denomination/currency validation, idempotency keys, daily spend/count limits, webhook signature verification, and safe logging that excludes claim tokens, wallet tokens, and payment credentials.
