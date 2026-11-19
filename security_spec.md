# PrintReady Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Core Data Invariants
1. **Strict Document Vault Isolation**: A document in `/users/{userId}/documents/{documentId}` is strictly private to `{userId}` (or verified Admin). Unauthenticated users, other customers, and print shops can never read or list another user's private document vault.
2. **No Self-Assigned Privilege Escalation**: Users creating or updating `/users/{userId}` may never set `role: "admin"` or `role: "support"`, and cannot escalate `role` after creation. Admin authorization is verified exclusively via `/admins/{uid}` existence or the verified bootstrap administrator email (`email_verified == true`).
3. **Shop Verification Isolation**: A shop owner creating `/shops/{shopId}` must create with `verificationStatus: "pending"` and cannot self-verify to `"verified"`. Only verified Admins can update `verificationStatus`.
4. **Order Access & Master Gate**: `/orders/{orderId}` and its subcollection `/orders/{orderId}/messages/{messageId}` are readable and writable only by `customerId`, `shopOwnerId`, or Admin. Subcollection writes validate parent order existence and participant identity via `get()`.
5. **Terminal Order Locking**: Once an order reaches terminal status (`completed` or `refunded`), non-admin updates are strictly blocked.
6. **Temporal & Schema Integrity**: Every create validates `createdAt == request.time`, `updatedAt == request.time`, bounded string lengths, bounded array sizes (`tags.size() <= 15`), strict key allowlists (`hasAll` + `hasOnly`), and `isValidId()` on single-document path IDs.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Admin Registration**: `POST /users/{uid}` with `{ role: "admin", ... }` -> DENIED (`role` must be `"customer"` or `"shop_owner"` on self-registration).
2. **Shadow Field Injection on User Update**: `PATCH /users/{uid}` adding `{ isVerifiedAdmin: true }` -> DENIED (`affectedKeys().hasOnly(...)` + `hasOnly(...)`).
3. **Cross-User Vault Read**: User B executes `GET /users/{userA}/documents/{docId}` -> DENIED (`request.auth.uid != userId`).
4. **Unauthenticated Vault List**: Anonymous user lists `/users/{userA}/documents` -> DENIED (`isSignedIn()` required).
5. **ID Poisoning**: Creating document with 200-char or invalid-character ID `../admin$evil` -> DENIED (`isValidId()`).
6. **Shop Self-Verification**: Shop owner updates `/shops/{shopId}` with `{ verificationStatus: "verified" }` -> DENIED (only Admin may change `verificationStatus`).
7. **Shop Spoofing Owner**: User B creates `/shops/{shopId}` with `{ ownerId: "userA" }` -> DENIED (`incoming().ownerId == request.auth.uid`).
8. **Order Tampering by Third Party**: User C reads or updates `/orders/{orderId}` where `customerId == userA` and `shopOwnerId == userB` -> DENIED.
9. **Terminal Order Mutation**: Shop owner modifies `confirmedTotal` after order status is `"completed"` -> DENIED (terminal state lock).
10. **Client-Forged Timestamp**: Creating `/orders/{orderId}` with client-supplied `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` -> DENIED (`createdAt == request.time`).
11. **Order Message Spoofing**: Customer posts to `/orders/{orderId}/messages/{msgId}` with `senderRole: "shop"` or `senderId: "otherUid"` -> DENIED.
12. **Audit Log Tampering**: Non-admin user attempts to read, create, update, or delete `/auditLogs/{logId}` -> DENIED.
