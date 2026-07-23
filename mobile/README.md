# Munmai Mobile

Munmai Mobile is the Expo/React Native companion to Munmai. It is designed for quick daily money capture, recent activity, current-month context, and shared group expenses. The app uses Expo Router and runs on iOS, Android, and the web.

## Current capabilities

- Authenticated registration, sign-in, secure native session storage, web session storage, route protection, session restoration, and sign-out.
- A five-destination shell: **Today**, **Activity**, **Capture**, **Insights**, and **Spaces**.
- **Today:** current-month net, income, and expense totals, recent personal transactions, and refresh behavior.
- **Activity:** combined income and expense history with type and month filters, pull-to-refresh, and refresh-safe transaction details.
- **Capture:** a two-option **Capture & go** hub. Scan document opens the camera only after a tap, then reviews the photo and asks the user to choose Expense or Income once before opening the shared form with that type locked. Manual entry opens a clean form without a stale attachment.
- **Insights:** verified current-month In, Out, and Net totals only. Charts and predictive analytics are not implemented.
- **Spaces:** existing group list, group balances, member activity, shared expenses entered from an individual Space, and settlement recording/history.
- A hidden account screen, reached from the Today avatar, with basic profile details and sign-out.

Transaction dates use a platform calendar picker, accept dates from today back through the rolling 12-month boundary, and require explicit confirmation when a date is more than 90 days old.

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

## Supporting-document behavior

Expense capture accepts one optional JPEG, PNG, or PDF receipt up to 5 MB. Income capture accepts one optional JPEG, PNG, or PDF proof document up to 5 MB. Photos use the camera or image library; PDFs use the system document picker. Images retain their preview, while PDFs show their filename without an in-app document preview. Attachments can be removed or replaced. Manual type switching clears an incompatible selection; camera-originated type changes return to review and retain the exact captured image.

Capture & go keeps a captured image only in authenticated in-memory state while moving between review and the transaction form. The image is never placed in a URL and nothing is created or uploaded until the user submits. Explicit cancellation or attachment removal, successful submission, opening manual entry, signing out, or losing the session clears the temporary capture. Native Back navigation alone does not discard an active draft.

Transactions and their supporting documents are saved in two steps. If transaction creation succeeds but the upload fails, the form retains the created transaction ID and offers an upload retry. Retrying resumes at the upload step and does **not** create a second income or expense record. Successful mutations refresh Today, Activity, Insights, and matching transaction details; attachment mutations receive one additional silent revalidation after three seconds without permanent polling. The pending retry is an in-memory form state; it is not an offline queue and does not survive closing the flow or restarting the app.

After a failed upload, users may explicitly discard the upload retry. The already-created transaction remains saved without its supporting document, while the form, selected attachment, retry identifier, and errors reset before another transaction type can be selected.

## Development status

Mobile v1.0 is in stabilization. Authentication, personal transactions, Capture and Go, supporting documents, shared Spaces, settlements, and the five-tab shell are implemented. OCR-assisted field suggestions are planned for Mobile v1.1. OCR parsing, AI classification, bank-statement import, charts, predictive insights, offline queues, and additional Space membership administration remain future backlog and outside the current mobile surface.

Physical-device verification remains outstanding because the available Expo Go client and this project’s Expo SDK 57 runtime are not currently compatible. Use a compatible Expo Go build or a native development build when available. This repository does not claim a completed physical-device test.
