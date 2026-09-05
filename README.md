This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

# Runa Gifting Requirements

This section captures the current implementation requirements for adding Runa-powered partner gifting to How2LoveMe. It is intended to hold product and engineering requirements until we receive final guidance from Runa sales and solutions engineering.

## Goal

Allow a connected user to:
- browse curated gift products
- select a denomination
- add an optional message
- purchase a gift for their connected partner
- deliver the gift in-app
- allow the recipient to claim it
- show wallet actions only when supported by provider metadata

## Scope for v1

In scope:
- partner-only gifting
- curated gift catalog
- amount/denomination selection
- optional gift message
- server-created purchase flow
- Firestore gift records
- sent and received gift history
- claim-link support
- wallet actions only when supported by Runa
- backend-owned lifecycle and status reconciliation

Out of scope:
- gifting to non-partners
- public marketplace gifting
- refunds UI
- chargeback tooling
- scheduled gifting
- promo codes
- custom wallet pass generation by How2LoveMe

## Architecture

### Client
React Native app is responsible for:
- browsing gift options
- selecting amount and message
- starting checkout
- showing sent and received gifts
- opening claim or wallet actions

### Backend
Firebase Functions are responsible for:
- talking to Runa APIs
- validating auth, couple membership, limits, and product eligibility
- creating and updating canonical gift records
- processing webhook events
- reconciling purchase, fulfillment, delivery, and claim state

### Data
Firestore is the source of truth for:
- gift records
- gift event history
- optional catalog cache
- real-time sender and recipient views

## Firestore data model

### Canonical gift records
`couples/{coupleId}/gifts/{giftId}`

### Gift audit log
`couples/{coupleId}/gifts/{giftId}/events/{eventId}`

### Optional catalog cache
`system/runaCatalogCache/products/{productId}`

### Gift record fields
- senderUserId
- senderEmail
- recipientUserId
- recipientEmail
- provider
- providerOrderId
- providerPayoutId
- providerProductId
- productType
- brandCode
- brandName
- productDisplayName
- amount
- currency
- denominationType
- checkoutMode
- checkoutSessionId
- deliveryMethod
- deliveryStatus
- walletSupported
- walletType
- walletUrl
- claimUrl
- message
- status
- failureCode
- failureMessage
- createdAt
- updatedAt
- paidAt
- fulfilledAt
- deliveredAt
- claimedAt
- cancelledAt

### Status lifecycle
`draft -> checkout_pending -> purchase_pending -> paid -> fulfillment_pending -> fulfilled -> delivered -> claimed`

Failure and cancellation branches:
- `checkout_pending -> failed`
- `purchase_pending -> failed`
- `paid -> failed`
- `fulfilled -> failed`
- `checkout_pending -> cancelled`
- `purchase_pending -> cancelled`

Only backend systems should move a gift between states.

## Firestore rules requirements

Gift records should be server-owned.

Rules intent:
- only couple members can read gifts
- client create/update/delete for gifts should be blocked
- client create/update/delete for gift event logs should be blocked
- catalog cache should be backend-only
- provider lifecycle fields must never be client-writable

## Firebase Functions contract

### Required secrets and params
Secrets:
- `RUNA_API_KEY`
- `RUNA_WEBHOOK_SECRET`

Params:
- `RUNA_ENV`
- `RUNA_BASE_URL`
- `GIFT_DEFAULT_COUNTRY`
- `GIFT_DEFAULT_CURRENCY`
- `GIFT_MAX_AMOUNT_USD`
- `GIFT_DAILY_LIMIT_COUNT`
- `GIFT_DAILY_LIMIT_AMOUNT_USD`
- `GIFT_ENABLED_PRODUCT_IDS`

### Planned endpoints
- `listGiftCatalog`
- `createGiftCheckout`
- `getGiftClaimDetails`
- `resendGift`
- `cancelGift`
- `runaWebhook` (HTTP endpoint)

### Endpoint responsibilities
`listGiftCatalog`
- returns curated products safe for the client
- filters by country, currency, and wallet support where needed

`createGiftCheckout`
- verifies auth and partner relationship
- validates product, amount, currency, and request idempotency
- creates the canonical Firestore gift record
- starts provider checkout/order flow

`getGiftClaimDetails`
- returns claim and wallet actions for sender or recipient
- reads from canonical gift state

`resendGift`
- triggers resend flow only when provider and status allow it

`cancelGift`
- lets sender cancel before fulfillment only when supported

`runaWebhook`
- verifies webhook signatures
- deduplicates provider events
- reconciles provider status into Firestore
- appends gift event records

## Client integration plan

### New store
Add a `useGiftStore` Zustand store for:
- all gifts
- sent gifts
- received gifts
- syncing state
- error state

### Sync behavior
Extend relationship sync so that when a couple connection exists, the app subscribes to:
- `couples/{coupleId}/gifts`

### Client wrappers
Add gift wrappers following the existing `relationshipSync.ts` pattern:
- `listGiftCatalog()`
- `createGiftCheckout(...)`
- `getGiftClaimDetails(...)`
- `resendGift(...)`
- `cancelGift(...)`

## Screen and UX scope

### Entry point
Use the Love screen as the v1 entry point with a `Send a gift` CTA.

### Planned screens
- `GiftCatalogScreen`
- `GiftComposerScreen`
- `GiftHistoryScreen`
- `GiftDetailScreen`

### UX rules
- sender can only gift their connected partner in v1
- partner should not be manually changed in v1
- wallet buttons should only appear when provider capability is true
- a gift should not appear delivered until provider confirmation exists
- unsupported wallet products should clearly fall back to claim-link behavior

### Suggested UX copy direction
Love screen CTA:
- `Send a little something`
- `Pick a gift card your partner can enjoy right away.`
- `Send a gift`

Gift catalog:
- `Choose a gift`
- `Pick something thoughtful for your partner.`
- `Wallet ready` badge only when supported

Gift composer:
- `Make it personal`
- `Sending to`
- `Add a note`
- `Continue to purchase`

Recipient gift detail:
- `A gift for you`
- `Open gift`
- `Add to Apple Wallet`
- `Add to Google Wallet`
- `Open claim link`

## Security requirements

- Runa API calls must be server-side only
- Runa secrets must never ship in the mobile app
- verified email is required for all gift actions
- connected couple is required for v1 gifting
- sender and recipient access must be validated on the backend
- denomination and currency rules must be enforced on the backend
- spend limits and velocity limits must be enforced on the backend
- checkout creation must use idempotency keys
- webhook signatures must be validated
- raw claim tokens, wallet tokens, and payment credentials must never be logged

## QA expectations

Before release, validate:
- connected user can browse curated gifts
- sender can only gift connected partner
- duplicate taps do not create duplicate orders
- sender sees real-time gift status changes
- recipient sees gift in real time
- wallet CTA appears only for supported products
- unsupported products fall back to claim/open behavior
- failed purchases do not appear delivered
- sandbox provider flow works end to end across two accounts

## Blocking questions for Runa

Implementation should not proceed past scaffolding until the following are answered by Runa sales or solutions engineering:

1. Is consumer peer-to-peer gifting approved for this use case?
2. Should How2LoveMe use Runa Shop or the direct API?
3. Which product types support Apple Wallet?
4. Which product types support Google Wallet?
5. Are wallet-capable products merchant gift cards, prepaid cards, or both?
6. Does the recommended flow include provider-owned checkout or do we need our own payment layer?
7. What webhook events and identifiers are available for purchase, fulfillment, delivery, and claim lifecycle tracking?
8. Are resend and cancel flows supported, and at which statuses?
9. What country/currency scope should be used for the v1 catalog?
10. Are there display or brand-usage restrictions for products shown in-app?

## Recommended next step

After Runa responds:
1. lock provider model (Runa Shop vs direct API)
2. finalize Firestore schema and rules
3. finalize Functions endpoint contracts
4. break implementation into engineering tickets
