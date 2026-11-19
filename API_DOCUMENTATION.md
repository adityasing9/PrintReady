# PrintReady Backend API Documentation

All API routes are served by `server.ts` on the same origin (`/api/*`) with JSON bodies and per-IP rate limiting.

## Integration Health

### `GET /api/integrations/status`
Returns non-sensitive configuration status for external services:
- `gemini`: boolean (`GEMINI_API_KEY` present)
- `razorpayMode`: `'live' | 'sandbox'`
- `smtpEmail`: boolean (`SMTP_HOST` configured)
- `whatsappCloudApi`: boolean (`WHATSAPP_CLOUD_API_TOKEN` configured)

## AI Document Intelligence (Server-Side Gemini)

### `POST /api/ai/classify`
Classifies a document based on filename, MIME type, and extracted text excerpt.
- **Request**: `{ fileName: string, mimeType?: string, textSample?: string }`
- **Response**: `{ category, tags, suggestedFolder, summary, confidence, provider: 'gemini' | 'heuristic' }`

### `POST /api/ai/search`
Matches a natural-language query against user document metadata/summaries.
- **Request**: `{ query: string, documents: Array<{ id, name, category, tags, aiSummary }> }`
- **Response**: `{ matchedIds: string[], explanation: string, provider: 'gemini' | 'heuristic' }`

### `POST /api/ai/summarize`
Produces a concise print-readiness summary for a document excerpt.
- **Request**: `{ fileName: string, textSample?: string }`
- **Response**: `{ summary: string, keyDetails: string[], provider: 'gemini' | 'heuristic' }`

## Razorpay Standard Web Checkout

### `POST /api/create-order`
Creates a Razorpay order via the official `razorpay` Node.js SDK (`POST https://api.razorpay.com/v1/orders`).
- **Request**: `{ amount: number (paise, min 100), currency?: string (default 'INR'), receipt?: string, notes?: Record<string, string> }`
- **Response**: `{ order_id, amount, currency, receipt, key_id }`
- **Errors**: `400` if `amount < 100` paise; `401` on missing/invalid Razorpay credentials; `500` on Razorpay API errors.

### `POST /api/verify-payment`
Verifies Razorpay Standard Checkout signatures using `HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)` and constant-time comparison (`crypto.timingSafeEqual`).
- **Request**: `{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }`
- **Response**: `{ verified: true, razorpay_order_id, razorpay_payment_id, transactionId, verifiedAt, mode }`
- **Errors**: `400` on missing fields or signature mismatch (order is NOT marked as paid).

### `POST /api/payments/webhook`
Validates incoming Razorpay webhook signatures (`x-razorpay-signature`) using `RAZORPAY_WEBHOOK_SECRET`.
