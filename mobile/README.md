# Munmai Mobile

Munmai Mobile is the Expo/React Native companion to Munmai. It is designed for quick daily money capture, recent activity, current-month context, and shared group expenses. The app uses Expo Router and runs on iOS, Android, and the web.

## Current capabilities

- Authenticated registration, sign-in, secure native session storage, web session storage, route protection, session restoration, and sign-out.
- A five-destination shell: **Today**, **Activity**, **Capture**, **Insights**, and **Spaces**.
- **Today:** current-month net, income, and expense totals; recent personal transactions; refresh and quick-capture actions.
- **Activity:** combined income and expense history with type and month filters, pull-to-refresh, and refresh-safe transaction details.
- **Capture:** receipt-first expense entry plus standard expense and income entry. Capture never opens the camera automatically.
- **Insights:** verified current-month In, Out, and Net totals only. Charts and predictive analytics are not implemented.
- **Spaces:** existing group list, group balances, member activity, shared expenses entered from an individual Space, and settlement recording/history.
- A hidden account screen, reached from the Today avatar, with basic profile details and sign-out.

## Setup

Requirements:

- Node.js and npm
- The Munmai API running locally or a deployed API URL
- Android Studio for a local Android build, or macOS with Xcode for an iOS build

```bash
cd mobile
npm install
```

Create a local environment file from `.env.example` and set:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

Use `localhost` for Expo web and a same-machine simulator. A physical phone requires a LAN-reachable address such as `http://192.168.1.20:5000/api`, or the deployed Render API URL. The value must be a complete `http` or `https` URL and include the API base path.

## Scripts and validation

```bash
npm start                  # Start the Expo development server
npm run web                # Start Expo web
npm run android            # Build and run the native Android project
npm run ios                # Build and run the native iOS project (macOS)
npm run lint               # Run Expo lint (ESLint tooling is not currently installed)
npm test                   # Run focused Node tests
npx tsc --noEmit           # Validate TypeScript
npx expo export --platform web  # Produce a static web export
```

## Receipt behavior

Expense capture accepts one optional JPEG or PNG receipt image, up to 5 MB, from the camera or photo library. The image can be previewed, removed, or replaced before submission.

The expense and receipt are saved in two steps. If expense creation succeeds but receipt upload fails, the form retains the created expense ID and offers a receipt-upload retry. Retrying resumes at the upload step and does **not** create a second expense. The pending retry is an in-memory form state; it is not an offline queue and does not survive closing the flow or restarting the app.

## Development status

Mobile v0.9 is in stabilization. Authentication, personal transactions, receipt capture, shared Spaces, settlements, and the five-tab shell are implemented. OCR, receipt parsing, charts, predictive insights, offline queues, and additional Space membership administration are outside the current mobile surface.

Physical-device verification remains outstanding because the available Expo Go client and this project’s Expo SDK 57 runtime are not currently compatible. Use a compatible Expo Go build or a native development build when available. This repository does not claim a completed physical-device test.
