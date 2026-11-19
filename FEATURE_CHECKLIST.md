# PrintReady Feature Checklist

Status legend:
- **Implemented & Verified**: Working end-to-end in the running web application and backed by unit tests or interactive checks.
- **Integration Ready (Credentials Required)**: Server endpoint and status detection implemented; external third-party credentials required for live network dispatch.

| Area | Feature | Status | Notes |
| --- | --- | --- | --- |
| **Customer Vault** | Multi-file upload, MIME/size validation, duplicate warning | Implemented & Verified | Client validation + binary/preview handling |
| **Customer Vault** | Folders, custom categories, favourites, trash & restore | Implemented & Verified | Persisted locally and synced to Firestore when signed in |
| **Customer Vault** | AI Document Classification, OCR Summary & Natural Search | Implemented & Verified | Server-side `/api/ai/*` via Gemini (`gemini-4-hydrogen`) with local fallback |
| **Scanner & PDF** | Camera Scanner + Sample Scan + Filter adjustments + PDF Export | Implemented & Verified | Web Camera API + Canvas filters + `pdf-lib` export to Vault |
| **Scanner & PDF** | Merge, Split/Extract, Rotate, Watermark, Page Numbers | Implemented & Verified | Real client-side `pdf-lib` processing with download & save-to-vault |
| **Print Basket** | Per-item print config, page range parser, presets, warnings | Implemented & Verified | Backed by `src/domain/printCalculator.test.ts` |
| **Print Basket** | Live shop-specific cost breakdown & coupon discounts | Implemented & Verified | Recalculates per selected shop pricing matrix |
| **Direct Sharing** | WhatsApp (`wa.me`), Email (`mailto:`), Web Share, Templates | Implemented & Verified | Supports unregistered local shops with formatted print specs |
| **Shop Discovery** | Search, service/price/rating filters, List + Interactive Map | Implemented & Verified | Optional browser geolocation sorting + Shop Profile drawer |
| **Orders & Chat** | 19-state lifecycle, price approval, pickup code, order chat, reviews | Implemented & Verified | Role-enforced transitions in `orderStateMachine.ts` |
| **Payments** | Server-verified payment initiation & HMAC-SHA256 verification | Implemented & Verified | Sandbox HMAC server verification active; live Razorpay requires `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` |
| **Shop Portal** | Computed KPI dashboard, revenue chart, low-stock alerts | Implemented & Verified | Real order/inventory calculations + Recharts |
| **Shop Portal** | Incoming order queue, custom pricing, staff/printer assignment | Implemented & Verified | Shared live state with Customer Orders |
| **Shop Portal** | Editable pricing, shop profile, inventory, printers, staff, onboarding | Implemented & Verified | Updates reflect in Customer cost calculator and discovery |
| **Admin Console** | Platform KPIs, shop verification queue, audit logs | Implemented & Verified | Approve/reject/suspend updates marketplace visibility & logs |
| **Admin Console** | Order disputes/refunds, support tickets, coupons, review moderation | Implemented & Verified | Full state updates across portals |
| **External Channels** | Silent WhatsApp Business Cloud API & SMTP Email dispatch | Integration Ready (Credentials Required) | Documented in `.env.example` & surfaced in Account -> Integration Status |
| **Native Mobile** | Native Flutter Android/iOS binary wrapper | Out of Scope (Web Runtime) | Responsive web SPA with mobile navigation drawer provided |
