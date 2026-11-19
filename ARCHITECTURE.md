# PrintReady Architecture

## System Layers

1. **Pure Domain Layer (`src/domain/`)**
   - `types.ts`: Shared TypeScript models for documents, folders, print specs, shops, orders, messages, inventory, printers, staff, reviews, coupons, support tickets, and audit logs.
   - `printCalculator.ts`: Page range parsing/validation (`"1-5, 8, 10-12"`), duplex sheet calculations, shop-specific pricing matrix evaluation, coupon validation, and non-blocking warnings.
   - `orderStateMachine.ts`: 19-state order lifecycle, role-enforced transition matrix (`customer`, `shop`, `admin`), terminal state locks (`completed`, `refunded`), and contextual next-action helpers.
   - `fileValidation.ts`: Upload MIME/extension/size checks, duplicate file signature detection, share message template interpolation, and WhatsApp/Email handoff URL builders.
   - Covered by automated unit tests (`src/domain/*.test.ts`).

2. **Client-Side PDF Engine (`src/utils/pdfTools.ts`)**
   - Powered by `pdf-lib` running locally in the browser: multi-page scan export to PDF, multi-PDF merge, page extraction/split, rotation, diagonal watermark stamping, and footer page numbering.

3. **State & Persistence Layer (`src/context/PrintReadyContext.tsx`, `src/firebase.ts`, `src/data/firestoreSync.ts`)**
   - Unified reactive state across Customer, Shop, and Admin portals with `localStorage` persistence in Demo Workspace mode and Cloud Firestore synchronization when authenticated with Google Sign-In.
   - Explicit Firestore collection blueprint in `firebase-blueprint.json` and deployed security rules in `firestore.rules`.

4. **Backend API Server (`server.ts`)**
   - Express server on port `3000` with per-IP rate limiting, Vite dev middleware in development, and static `dist/` serving in production.
   - Never exposes secrets to the client; reads `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, SMTP, and WhatsApp environment variables strictly server-side.

## Firestore Collections & Security Model

- `/users/{uid}` and user subcollections (`folders`, `documents`, `presets`, `savedShops`): Owner-only read/write, schema-validated fields.
- `/shops/{shopId}` and subcollections (`inventory`, `printers`, `staff`): Publicly readable for verified shops; write access restricted to the owning `ownerId` or bootstrap admin (`cypt300@gmail.com`).
- `/orders/{orderId}` and `/orders/{orderId}/messages/{messageId}`: Accessible only to the order's `customerId`, `shopOwnerId`, or admin. Customers cannot forge `paymentStatus: 'verified'`.
- `/reviews/{reviewId}`, `/coupons/{couponId}`, `/supportTickets/{ticketId}`, `/auditLogs/{logId}`: Role-scoped access with immutable audit logging.
