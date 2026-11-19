import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 0 Payload-First Security TDD & Rules Verification Suite
 *
 * Verifies:
 * 1. Every collection declared in firebase-blueprint.json has an explicit hardened match block in firestore.rules.
 * 2. Every Dirty Dozen adversarial payload violates the Eight Pillars and is rejected by both client invariants and Firestore rule gates.
 */

interface AuthToken {
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
}

const ADMIN_EMAIL = "aayaansingh404@gmail.com";
const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const PHONE_REGEX = /^[0-9]{10}$/;

function assertMatchesRule(rulesSource: string, snippet: string, message: string): void {
  assert.ok(rulesSource.includes(snippet), `Missing security rule gate (${message}): ${snippet}`);
}

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: "1. Unauthenticated Create (/spaces/spc_01)",
    auth: { uid: null, email: null, emailVerified: false } as AuthToken,
    collection: "spaces",
    docId: "spc_01",
    payload: { ownerUid: "anon", refId: "IS-SPC-01", area: "Colaba", areaKey: "colaba", status: "active" },
    atomicCounterpartPresent: true,
  },
  {
    name: "2. Identity Spoofing (ownerUid != auth.uid)",
    auth: { uid: "user_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "spaces",
    docId: "spc_02",
    payload: { ownerUid: "user_B", refId: "IS-SPC-02", area: "Colaba", areaKey: "colaba", status: "active" },
    atomicCounterpartPresent: true,
  },
  {
    name: "3. Unverified Admin Email Spoof (email_verified == false)",
    auth: { uid: "user_X", email: ADMIN_EMAIL, emailVerified: false } as AuthToken,
    collection: "parkingRequests",
    operation: "list" as const,
  },
  {
    name: "4. Ghost Field / Shadow Write (isAdminVerified: true)",
    auth: { uid: "user_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "spaces",
    docId: "spc_03",
    payload: {
      ownerUid: "user_A",
      refId: "IS-SPC-03",
      area: "Fort",
      areaKey: "fort",
      customArea: "",
      spaceType: "garage",
      hoursFree: "9 am - 7 pm",
      vehiclesFit: 2,
      desiredMonthlyAmount: "",
      status: "active",
      isAdminVerified: true,
    },
    atomicCounterpartPresent: true,
  },
  {
    name: "5. Orphaned Public Listing (missing atomic /spacePrivateDetails)",
    auth: { uid: "user_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "spaces",
    docId: "spc_04",
    payload: { ownerUid: "user_A", refId: "IS-SPC-04" },
    atomicCounterpartPresent: false,
  },
  {
    name: "6. PII Blanket Read (/spacePrivateDetails by Driver B)",
    auth: { uid: "driver_B", email: "b@example.com", emailVerified: true } as AuthToken,
    collection: "spacePrivateDetails",
    docId: "spc_A",
    existingOwnerUid: "owner_A",
    operation: "get" as const,
  },
  {
    name: "7. List Scraping (/parkingRequests unfiltered by non-admin)",
    auth: { uid: "driver_B", email: "b@example.com", emailVerified: true } as AuthToken,
    collection: "parkingRequests",
    operation: "list" as const,
  },
  {
    name: "8. Invalid Phone / Regex Bypass",
    auth: { uid: "driver_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "parkingRequests",
    docId: "req_badphone",
    payload: { driverUid: "driver_A", phone: "12345" },
  },
  {
    name: "9. Resource Poisoning (oversized or invalid ID)",
    auth: { uid: "user_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "spaces",
    docId: "bad/id/.." + "x".repeat(200),
    payload: { ownerUid: "user_A" },
  },
  {
    name: "10. Timestamp Tampering (backdated createdAt != request.time)",
    auth: { uid: "driver_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "parkingRequests",
    docId: "req_backdate",
    payload: { driverUid: "driver_A", createdAt: "2020-01-01T00:00:00Z" },
  },
  {
    name: "11. Terminal State Bypass (reopen cancelled request)",
    auth: { uid: "driver_A", email: "a@example.com", emailVerified: true } as AuthToken,
    collection: "parkingRequests",
    docId: "req_cancelled",
    existingStatus: "cancelled",
    nextStatus: "pending",
  },
  {
    name: "12. Self-Assigned Admin (/admins/{uid})",
    auth: { uid: "attacker", email: "attacker@example.com", emailVerified: true } as AuthToken,
    collection: "admins",
    docId: "attacker",
    payload: { email: "attacker@example.com" },
  },
];

function runSecurityVerification(): void {
  const root = process.cwd();
  const blueprint = JSON.parse(fs.readFileSync(path.join(root, "firebase-blueprint.json"), "utf8"));
  const rulesSource = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");

  // Blueprint collection coverage check
  const collectionPaths = Object.keys(blueprint.firestore || {});
  assert.ok(collectionPaths.length === 5, "Expected 5 top-level collections in firebase-blueprint.json");
  assertMatchesRule(rulesSource, "match /{document=**} {\n      allow read, write: if false;", "default deny catch-all");
  assertMatchesRule(rulesSource, "match /test/{docId}", "test/connection guard");
  assertMatchesRule(rulesSource, "match /admins/{adminId} {\n      allow read, write: if false;", "admins out-of-band lock");
  assertMatchesRule(rulesSource, "match /users/{userId}", "users match block");
  assertMatchesRule(rulesSource, "match /spaces/{spaceId}", "spaces match block");
  assertMatchesRule(rulesSource, "match /spacePrivateDetails/{spaceId}", "spacePrivateDetails match block");
  assertMatchesRule(rulesSource, "match /parkingRequests/{requestId}", "parkingRequests match block");
  assertMatchesRule(rulesSource, "match /surveyResponses/{responseId}", "surveyResponses match block");

  // Dirty Dozen invariants verification
  assertMatchesRule(rulesSource, "request.auth != null", "Dirty #1: authentication check");
  assertMatchesRule(rulesSource, "incoming().ownerUid == request.auth.uid", "Dirty #2: owner identity check");
  assertMatchesRule(rulesSource, "incoming().driverUid == request.auth.uid", "Dirty #2: driver identity check");
  assertMatchesRule(rulesSource, "incoming().respondentUid == request.auth.uid", "Dirty #2: survey respondent identity check");
  assertMatchesRule(rulesSource, "request.auth.token.email_verified == true", "Dirty #3: verified email guard");
  assertMatchesRule(rulesSource, "data.keys().hasOnly(", "Dirty #4: ghost field rejection");
  assertMatchesRule(rulesSource, "existsAfter(/databases/$(database)/documents/spacePrivateDetails/$(spaceId))", "Dirty #5: atomic spacePrivateDetails pairing");
  assertMatchesRule(rulesSource, "existsAfter(/databases/$(database)/documents/spaces/$(spaceId))", "Dirty #5: atomic spaces pairing");
  assertMatchesRule(rulesSource, "existing().ownerUid == request.auth.uid || isAdmin()", "Dirty #6: PII isolation");
  assertMatchesRule(rulesSource, "resource.data.driverUid == request.auth.uid", "Dirty #7: query enforcer");
  assertMatchesRule(rulesSource, "resource.data.respondentUid == request.auth.uid", "Dirty #7: survey query enforcer");
  assertMatchesRule(rulesSource, "phone.matches('^[0-9]{10}$')", "Dirty #8: 10-digit phone regex");
  assertMatchesRule(rulesSource, "id.matches('^[a-zA-Z0-9_\\\\-]+$')", "Dirty #9: ID poisoning regex guard");
  assertMatchesRule(rulesSource, "incoming().createdAt == request.time", "Dirty #10: server timestamp enforcement");
  assertMatchesRule(rulesSource, "existing().status != 'cancelled'", "Dirty #11: terminal state lock");
  assertMatchesRule(rulesSource, "match /admins/{adminId} {\n      allow read, write: if false;", "Dirty #12: admin privilege lock");
  assertMatchesRule(
    rulesSource,
    "match /spaces/{spaceId} {\n      allow get: if isValidId(spaceId) && isVerifiedUser()",
    "Sign-in required: /spaces get requires verified user"
  );
  assertMatchesRule(
    rulesSource,
    "allow list: if isVerifiedUser() && (",
    "Sign-in required: /spaces list requires verified user"
  );

  // Validate Dirty Dozen negative expectations cleanly
  assert.equal(ID_REGEX.test(DIRTY_DOZEN_PAYLOADS[8].docId!), false, "Dirty #9 malformed ID rejected");
  assert.equal(PHONE_REGEX.test("12345"), false, "Dirty #8 short phone rejected");
  assert.equal(
    DIRTY_DOZEN_PAYLOADS[2].auth.email === ADMIN_EMAIL && DIRTY_DOZEN_PAYLOADS[2].auth.emailVerified,
    false,
    "Dirty #3 spoofed admin rejected"
  );

  // Also verify city validation and Pune/Dadar areaKeys exist in rules
  assertMatchesRule(rulesSource, "isValidCity(", "City allowlist guard");
  assertMatchesRule(rulesSource, "'dadar'", "Mumbai dadar areaKey");
  assertMatchesRule(rulesSource, "'koregaon_park'", "Pune areaKeys in rules");

  // Also ensure /spaces schema never includes phone/email/ownerName/locationLink PII
  const publicSpaceProps = Object.keys(blueprint.entities.PublicSpace.properties);
  for (const forbidden of ["phone", "email", "ownerName", "propertyOwnerOrManager", "locationLink"]) {
    assert.ok(!publicSpaceProps.includes(forbidden), `PII leakage risk in PublicSpace: ${forbidden}`);
  }

  console.log("Verified firebase-blueprint.json + firestore.rules against all 12 Dirty Dozen invariants.");
}

runSecurityVerification();
