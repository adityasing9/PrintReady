# PrintReady — Upload once. Print anywhere.

PrintReady is a full-stack document wallet, smart printing workspace, print shop marketplace, and business operations platform covering three integrated portals:

1. **Customer Portal**: Private Document Vault, Camera Scanner & Client-Side PDF Utilities (`pdf-lib`), Print Basket & Presets & Real-Time Cost Calculator, Direct Sharing (WhatsApp, Email, Native Web Share, Reusable Templates), Print Shop Discovery (List + Interactive Map) & Saved Shops (including unregistered local shops), Marketplace Orders (strict 19-state lifecycle, price approval, server-verified payment, pickup codes, order chat, verified reviews), and Account & Integration Status.
2. **Print Shop Portal**: Business Dashboard (computed revenue & turnaround KPIs + Recharts trend chart, low-inventory alerts), Incoming Orders & Print Queue (accept/reject, custom pricing, staff/printer assignment, lifecycle progression, quick-reply chat), Editable Pricing & Shop Profile, Inventory & Printer Fleet Management, Staff & Reviews, and Shop Registration/Onboarding.
3. **Admin Console**: Platform Overview, Shop Verification Queue (approve/reject/suspend with immutable audit logs), Orders/Disputes & Support Tickets, Configurable Coupons & Review Moderation, and Platform Settings & Audit Logs.

## Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, `pdf-lib`
- **Backend**: Express (`server.ts`) serving both API routes (`/api/*`) and the React SPA on port `3000`
- **Database & Auth**: Firebase Authentication (Google Sign-In) & Cloud Firestore with deployed security rules (`firestore.rules`) and schema blueprint (`firebase-blueprint.json`)
- **AI Layer**: Server-side `@google/genai` (`gemini-4-hydrogen`) via `/api/ai/*` endpoints for document classification, natural-language vault search, and document summarization
- **Testing**: Pure domain logic unit tests using `node:test` (`npm test`)

## Running Locally

```bash
npm install
npm test
npm run dev
```

The application serves on `http://localhost:3000`.

### Workspace Modes
- **Demo Workspace (Default)**: Launches immediately with deterministic seeded data persisted in `localStorage` so every Customer, Shop, and Admin workflow works out of the box.
- **Google Cloud Sync**: Click **Sign In with Google** in the sidebar to authenticate with Firebase Auth and synchronize user profiles, folders, documents, presets, and saved shops to Cloud Firestore.

## Honest Integration Boundaries

- **AI Endpoints (`/api/ai/*`)**: Live when `GEMINI_API_KEY` is configured on the server; falls back cleanly to deterministic local classification/search when unavailable.
- **Payments (`/api/payments/*`)**: Always verified server-side with HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) and idempotency tracking. Runs in **Server-Verified Sandbox Mode** when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are absent; switches to Razorpay credentials when configured in server environment variables.
- **Direct Sharing**: Opens official WhatsApp (`wa.me`) and `mailto:` handoffs or the browser's `navigator.share()` sheet with pre-filled print instructions. Silent server-side WhatsApp Business Cloud API delivery and SMTP transactional email require external credentials (`WHATSAPP_CLOUD_API_TOKEN`, `SMTP_HOST`, etc.) documented in `.env.example`.
- **Native Mobile Wrapper**: Delivered as a responsive web application (mobile drawer, touch-friendly controls, Web Camera API scanner). A native Flutter Android/iOS binary wrapper is outside this web runtime.
