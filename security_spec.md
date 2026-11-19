# Idle Spot Firestore Security Specification (Phase 0)

## Data Invariants
1. **Identity Integrity**: Every user-owned document (`users`, `spaces`, `spacePrivateDetails`, `parkingRequests`, `surveyResponses`) MUST match `request.auth.uid` and require `request.auth.token.email_verified == true`.
2. **PII Isolation**: Public `/spaces/{spaceId}` listings NEVER contain owner `phone`, `email`, `ownerName`, `locationLink`, or `propertyOwnerOrManager`. Those live exclusively in `/spacePrivateDetails/{spaceId}`, readable only by `ownerUid` or verified admin (`aayaansingh404@gmail.com`). `/surveyResponses/{responseId}` contains personal contact fields and is strictly readable only by `respondentUid` or verified admin.
3. **Atomic Pairing**: Creating `/spaces/{spaceId}` or `/spacePrivateDetails/{spaceId}` requires `existsAfter(...)` on its counterpart so neither orphaned public listings nor unlinked private records can exist.
4. **Relational Integrity**: Creating `/parkingRequests/{requestId}` with a non-empty `matchedSpaceId` verifies `exists(/databases/.../spaces/$(matchedSpaceId))`.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and never change on update. `ownerUid`, `driverUid`, `respondentUid`, and `refId` are immutable; `surveyResponses` rejects updates and deletes.
6. **Strict Keys & Bounds**: Every write validates `keys().hasAll(...)` + `keys().hasOnly(...)`, string `.size()`, regex IDs (`^[a-zA-Z0-9_-]+$`), phone regex (`^[0-9]{10}$`), city/areaKey allowlists (`Mumbai`, `Pune`), nullable new fields (`city`, `pageUrl`, `locationLink`, `quotedPriceInr`) for legacy records, and action-scoped `affectedKeys().hasOnly(...)` on updates.
7. **Terminal State Locking**: Once a `parkingRequests` document has `status == 'cancelled'`, non-admin updates are rejected.
8. **Secure List Queries**: Every `allow list` validates `resource.data` (`status == 'active'` or `ownerUid/driverUid/respondentUid == request.auth.uid` or verified admin email without `get()`/`exists()` inside `allow list`).

## Dirty Dozen Adversarial Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Create**: Unauthenticated user writes to `/spaces/spc_01`.
2. **Identity Spoofing**: Authenticated User A writes `/spaces/spc_02` with `ownerUid = "user_B"`.
3. **Unverified Email Spoof**: Token with `email = "aayaansingh404@gmail.com"` and `email_verified = false` attempts to list `/parkingRequests`.
4. **Ghost Field / Shadow Write**: User creates `/spaces/spc_03` with extra `"isAdminVerified": true`.
5. **Orphaned Public Listing**: User creates `/spaces/spc_04` without atomic `/spacePrivateDetails/spc_04` in the same batch.
6. **PII Blanket Read**: Driver B attempts `get` on `/spacePrivateDetails/spc_A` or `/parkingRequests/req_A`.
7. **List Scraping**: Non-admin user lists `/parkingRequests` without filtering `driverUid == request.auth.uid`, or lists paused `/spaces`.
8. **Invalid Phone / Regex Bypass**: User creates `/parkingRequests/req_badphone` with `phone = "12345"`.
9. **Resource Poisoning (ID)**: User attempts `get`/`create` on `/spaces/` with a 300-character ID or slashes/dots.
10. **Timestamp Tampering**: User creates `/parkingRequests/req_backdate` with a client-supplied past `createdAt` instead of `request.time`.
11. **Terminal State Bypass**: Driver tries to update `/parkingRequests/req_cancelled` back to `'pending'` after cancellation.
12. **Self-Assigned Admin**: User attempts to write `/admins/{uid}` or set `role: "admin"` on `/users/{uid}`.
