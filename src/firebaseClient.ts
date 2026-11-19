import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const ADMIN_EMAIL = "aayaansingh404@gmail.com";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connection validation
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
void testConnection();

// Blueprint constants for validation synchronicity
const VALID_CITIES = new Set(["Mumbai", "Pune"]);
const VALID_AREA_KEYS = new Set([
  "colaba",
  "fort",
  "churchgate",
  "bandra",
  "juhu",
  "dadar",
  "hadapsar",
  "koregaon_park",
  "camp",
  "wakad",
  "karvenagar",
  "other",
]);
const VALID_SPACE_TYPES = new Set(["shop_front", "office", "garage", "other"]);
const VALID_VEHICLE_TYPES = new Set(["car", "taxi", "auto", "two_wheeler"]);
const VALID_LANGS = new Set(["en", "hi", "mr"]);
const VALID_OWNS_SPOT = new Set(["yes_available", "yes_unavailable", "no"]);
const VALID_PARKING_PROBLEM = new Set(["yes_often", "yes_sometimes", "no"]);
const VALID_WOULD_USE_APP = new Set(["yes", "maybe", "no"]);
const VALID_WILLING_TO_PAY = new Set(["free_only", "under_50", "50_100", "100_150", "150_250", "above_250"]);
const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const PHONE_REGEX = /^[0-9]{10}$/;

function clampStr(value: unknown, maxLen: number, fallback = ""): string {
  const text = typeof value === "string" ? value.trim() : fallback;
  return text.slice(0, maxLen);
}

function toIsoDate(ts: unknown): string {
  if (ts && typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate().toISOString();
  }
  if (typeof ts === "string" && ts) return ts;
  return new Date().toISOString();
}

function toEpochMs(ts: unknown): number {
  if (ts && typeof (ts as Timestamp).toMillis === "function") {
    return (ts as Timestamp).toMillis();
  }
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export interface AuthUserSummary {
  uid: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  photoUrl: string;
  isAdmin: boolean;
}

export interface PublicSpaceRecord {
  id: string;
  owner_uid: string;
  ref_id: string;
  city: "Mumbai" | "Pune" | null;
  area: string;
  area_key: string;
  custom_area: string;
  space_type: string;
  hours_free: string;
  vehicles_fit: number;
  desired_monthly_amount: string | null;
  status: "active" | "paused";
  created_at: string;
  _sortMs: number;
}

export interface PrivateSpaceRecord {
  id: string;
  owner_uid: string;
  ref_id: string;
  city: "Mumbai" | "Pune" | null;
  area_key: string | null;
  owner_name: string;
  phone: string;
  email: string;
  location_link: string | null;
  property_owner_or_manager: string;
  confirmation_text: string;
  commitment_time: string;
  source: string;
  page_url: string | null;
  language: string;
  created_at: string;
  _sortMs: number;
}

export interface ParkingRequestRecord {
  id: string;
  driver_uid: string;
  ref_id: string;
  matched_space_id: string | null;
  matched_space_summary: string | null;
  city: "Mumbai" | "Pune" | null;
  area: string;
  area_key: string;
  vehicle_type: string;
  duration: "per_day" | "per_month";
  quoted_price_inr: number | null;
  start_date: string;
  hours_needed: string;
  name: string;
  phone: string;
  email: string;
  vehicle_number: string;
  confirmation_text: string;
  commitment_time: string;
  status: "pending" | "confirmed" | "cancelled";
  source: string;
  page_url: string | null;
  language: string;
  created_at: string;
  _sortMs: number;
}

export interface SurveyResponseRecord {
  id: string;
  respondent_uid: string;
  ref_id: string;
  name: string;
  phone: string;
  email: string;
  area: string;
  owns_spot_status: "yes_available" | "yes_unavailable" | "no";
  faced_parking_problem: "yes_often" | "yes_sometimes" | "no";
  would_use_app: "yes" | "maybe" | "no";
  willing_to_pay_3hrs: "free_only" | "under_50" | "50_100" | "100_150" | "150_250" | "above_250";
  additional_notes: string;
  source: string;
  language: string;
  created_at: string;
  _sortMs: number;
}

function toAuthSummary(user: User | null): AuthUserSummary | null {
  if (!user) return null;
  const email = clampStr(user.email, 160);
  return {
    uid: user.uid,
    displayName: clampStr(user.displayName || email.split("@")[0] || "Idle Spot User", 120),
    email,
    emailVerified: Boolean(user.emailVerified),
    photoUrl: clampStr(user.photoURL, 500),
    isAdmin: Boolean(user.emailVerified && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()),
  };
}

async function syncUserProfileDoc(user: User): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const docPath = `users/${user.uid}`;
  const ref = doc(db, "users", user.uid);
  const displayName = clampStr(user.displayName || user.email.split("@")[0] || "Idle Spot User", 120) || "Idle Spot User";
  const email = clampStr(user.email, 160);
  const photoUrl = clampStr(user.photoURL, 500);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
  }

  try {
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        photoUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        photoUrl,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, existingSnap.exists() ? OperationType.UPDATE : OperationType.CREATE, docPath);
  }
}

export async function signInWithGoogle(): Promise<AuthUserSummary> {
  const credential = await signInWithPopup(auth, googleProvider);
  await syncUserProfileDoc(credential.user);
  const summary = toAuthSummary(credential.user);
  if (!summary) {
    throw new Error("Google sign-in did not return an account.");
  }
  return summary;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(callback: (user: AuthUserSummary | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    callback(toAuthSummary(user));
  });
}

function parseNullableCity(value: unknown): "Mumbai" | "Pune" | null {
  if (value === "Mumbai" || value === "Pune") return value;
  return null;
}

function mapPublicSpace(id: string, data: Record<string, unknown>): PublicSpaceRecord {
  const desired = clampStr(data.desiredMonthlyAmount, 60);
  return {
    id,
    owner_uid: clampStr(data.ownerUid, 128),
    ref_id: clampStr(data.refId, 32),
    city: parseNullableCity(data.city),
    area: clampStr(data.area, 200),
    area_key: clampStr(data.areaKey, 40),
    custom_area: clampStr(data.customArea, 160),
    space_type: clampStr(data.spaceType, 40),
    hours_free: clampStr(data.hoursFree, 120),
    vehicles_fit: Number(data.vehiclesFit || 1),
    desired_monthly_amount: desired || null,
    status: data.status === "paused" ? "paused" : "active",
    created_at: toIsoDate(data.createdAt),
    _sortMs: toEpochMs(data.createdAt),
  };
}

function mapPrivateSpace(id: string, data: Record<string, unknown>): PrivateSpaceRecord {
  const areaKey = clampStr(data.areaKey, 40);
  const locLink = clampStr(data.locationLink, 500);
  const pageUrl = clampStr(data.pageUrl, 500);
  return {
    id,
    owner_uid: clampStr(data.ownerUid, 128),
    ref_id: clampStr(data.refId, 32),
    city: parseNullableCity(data.city),
    area_key: areaKey || null,
    owner_name: clampStr(data.ownerName, 120),
    phone: clampStr(data.phone, 20),
    email: clampStr(data.email, 160),
    location_link: locLink || null,
    property_owner_or_manager: clampStr(data.propertyOwnerOrManager, 160),
    confirmation_text: clampStr(data.confirmationText, 600),
    commitment_time: clampStr(data.commitmentTime, 64),
    source: clampStr(data.source, 80),
    page_url: pageUrl || null,
    language: clampStr(data.language, 10),
    created_at: toIsoDate(data.createdAt),
    _sortMs: toEpochMs(data.createdAt),
  };
}

function mapParkingRequest(id: string, data: Record<string, unknown>): ParkingRequestRecord {
  const matchedId = clampStr(data.matchedSpaceId, 128);
  const matchedSummary = clampStr(data.matchedSpaceSummary, 240);
  const pageUrl = clampStr(data.pageUrl, 500);
  const statusRaw = data.status;
  const status = statusRaw === "confirmed" ? "confirmed" : statusRaw === "cancelled" ? "cancelled" : "pending";
  return {
    id,
    driver_uid: clampStr(data.driverUid, 128),
    ref_id: clampStr(data.refId, 32),
    matched_space_id: matchedId || null,
    matched_space_summary: matchedSummary || null,
    city: parseNullableCity(data.city),
    area: clampStr(data.area, 200),
    area_key: clampStr(data.areaKey, 40),
    vehicle_type: clampStr(data.vehicleType, 40),
    duration: data.duration === "per_month" ? "per_month" : "per_day",
    quoted_price_inr: typeof data.quotedPriceInr === "number" ? data.quotedPriceInr : null,
    start_date: clampStr(data.startDate, 30),
    hours_needed: clampStr(data.hoursNeeded, 120),
    name: clampStr(data.driverName, 120),
    phone: clampStr(data.phone, 20),
    email: clampStr(data.email, 160),
    vehicle_number: clampStr(data.vehicleNumber, 40),
    confirmation_text: clampStr(data.confirmationText, 600),
    commitment_time: clampStr(data.commitmentTime, 64),
    status,
    source: clampStr(data.source, 80),
    page_url: pageUrl || null,
    language: clampStr(data.language, 10),
    created_at: toIsoDate(data.createdAt),
    _sortMs: toEpochMs(data.createdAt),
  };
}

function mapSurveyResponse(id: string, data: Record<string, unknown>): SurveyResponseRecord {
  const ownsRaw = clampStr(data.ownsSpotStatus, 30);
  const problemRaw = clampStr(data.facedParkingProblem, 30);
  const useRaw = clampStr(data.wouldUseApp, 20);
  const payRaw = clampStr(data.willingToPay3Hrs, 30);
  return {
    id,
    respondent_uid: clampStr(data.respondentUid, 128),
    ref_id: clampStr(data.refId, 32),
    name: clampStr(data.respondentName, 120),
    phone: clampStr(data.phone, 20),
    email: clampStr(data.email, 160),
    area: clampStr(data.area, 160),
    owns_spot_status: (VALID_OWNS_SPOT.has(ownsRaw) ? ownsRaw : "no") as SurveyResponseRecord["owns_spot_status"],
    faced_parking_problem: (VALID_PARKING_PROBLEM.has(problemRaw) ? problemRaw : "no") as SurveyResponseRecord["faced_parking_problem"],
    would_use_app: (VALID_WOULD_USE_APP.has(useRaw) ? useRaw : "maybe") as SurveyResponseRecord["would_use_app"],
    willing_to_pay_3hrs: (VALID_WILLING_TO_PAY.has(payRaw) ? payRaw : "50_100") as SurveyResponseRecord["willing_to_pay_3hrs"],
    additional_notes: clampStr(data.additionalNotes, 400),
    source: clampStr(data.source, 80),
    language: clampStr(data.language, 10),
    created_at: toIsoDate(data.createdAt),
    _sortMs: toEpochMs(data.createdAt),
  };
}

export function subscribePublicSpaces(
  onData: (spaces: PublicSpaceRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = "spaces";
  const q = query(collection(db, path), where("status", "==", "active"), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapPublicSpace(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b._sortMs - a._sortMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeMySpaces(
  uid: string,
  onData: (spaces: PublicSpaceRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = "spaces";
  const q = query(collection(db, path), where("ownerUid", "==", uid), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapPublicSpace(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b._sortMs - a._sortMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeMyRequests(
  uid: string,
  onData: (requests: ParkingRequestRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = "parkingRequests";
  const q = query(collection(db, path), where("driverUid", "==", uid), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapParkingRequest(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b._sortMs - a._sortMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeMySurveys(
  uid: string,
  onData: (surveys: SurveyResponseRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = "surveyResponses";
  const q = query(collection(db, path), where("respondentUid", "==", uid), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapSurveyResponse(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b._sortMs - a._sortMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeAdminInbox(
  onData: (payload: {
    requests: ParkingRequestRecord[];
    spaces: PublicSpaceRecord[];
    privateDetailsById: Record<string, PrivateSpaceRecord>;
    surveys: SurveyResponseRecord[];
  }) => void,
  onError: (err: Error) => void
): Unsubscribe {
  let latestRequests: ParkingRequestRecord[] = [];
  let latestSpaces: PublicSpaceRecord[] = [];
  let latestDetails: Record<string, PrivateSpaceRecord> = {};
  let latestSurveys: SurveyResponseRecord[] = [];

  const emit = () => {
    onData({
      requests: latestRequests,
      spaces: latestSpaces,
      privateDetailsById: latestDetails,
      surveys: latestSurveys,
    });
  };

  const unsubRequests = onSnapshot(
    query(collection(db, "parkingRequests"), orderBy("createdAt", "desc"), limit(100)),
    (snap) => {
      latestRequests = snap.docs.map((d) => mapParkingRequest(d.id, d.data() as Record<string, unknown>));
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "parkingRequests");
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubSpaces = onSnapshot(
    query(collection(db, "spaces"), orderBy("createdAt", "desc"), limit(100)),
    (snap) => {
      latestSpaces = snap.docs.map((d) => mapPublicSpace(d.id, d.data() as Record<string, unknown>));
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "spaces");
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubDetails = onSnapshot(
    query(collection(db, "spacePrivateDetails"), orderBy("createdAt", "desc"), limit(100)),
    (snap) => {
      const next: Record<string, PrivateSpaceRecord> = {};
      for (const d of snap.docs) {
        next[d.id] = mapPrivateSpace(d.id, d.data() as Record<string, unknown>);
      }
      latestDetails = next;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "spacePrivateDetails");
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubSurveys = onSnapshot(
    query(collection(db, "surveyResponses"), orderBy("createdAt", "desc"), limit(100)),
    (snap) => {
      latestSurveys = snap.docs.map((d) => mapSurveyResponse(d.id, d.data() as Record<string, unknown>));
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "surveyResponses");
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubRequests();
    unsubSpaces();
    unsubDetails();
    unsubSurveys();
  };
}

export interface CreateSpaceInput {
  city?: string | null;
  area: string;
  area_key: string;
  custom_area?: string;
  space_type: string;
  hours_free: string;
  vehicles_fit: number;
  desired_monthly_amount?: string | null;
  location_link?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  property_owner_or_manager: string;
  confirmation_text: string;
  commitment_time: string;
  source?: string;
  referrer?: string;
  page_url?: string | null;
  language?: string;
}

export async function createSpaceListing(input: CreateSpaceInput): Promise<{
  id: string;
  refId: string;
  space: PublicSpaceRecord;
}> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error("Please sign in with Google before listing a space.");
  }

  const city: "Mumbai" | "Pune" = input.city && VALID_CITIES.has(input.city) ? (input.city as "Mumbai" | "Pune") : "Mumbai";
  const areaKey = VALID_AREA_KEYS.has(input.area_key) ? input.area_key : "other";
  const spaceType = VALID_SPACE_TYPES.has(input.space_type) ? input.space_type : "other";
  const lang = VALID_LANGS.has(input.language || "en") ? (input.language as string) : "en";
  const phone = clampStr(input.phone, 20).replace(/[\s\-()]/g, "");
  if (!PHONE_REGEX.test(phone)) {
    throw new Error("Phone number must be 10 digits.");
  }

  const locationLinkClean = clampStr(input.location_link, 500);
  const pageUrlClean = clampStr(input.page_url, 500);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const spaceId = `spc_${suffix}`;
  const refId = `IS-SPC-${suffix.toUpperCase()}`;

  const publicDoc = {
    ownerUid: user.uid,
    refId,
    city,
    area: clampStr(input.area, 200) || areaKey,
    areaKey,
    customArea: clampStr(input.custom_area, 160),
    spaceType,
    hoursFree: clampStr(input.hours_free, 120) || "9 am - 7 pm",
    vehiclesFit: Math.min(500, Math.max(1, Math.floor(Number(input.vehicles_fit) || 1))),
    desiredMonthlyAmount: clampStr(input.desired_monthly_amount, 60),
    status: "active" as const,
    createdAt: serverTimestamp(),
  };

  const privateDoc = {
    ownerUid: user.uid,
    refId,
    city,
    areaKey,
    ownerName: clampStr(input.name, 120) || clampStr(user.displayName, 120) || "Owner",
    phone,
    email: clampStr(input.email || user.email, 160),
    locationLink: locationLinkClean || null,
    propertyOwnerOrManager: clampStr(input.property_owner_or_manager, 160) || "Owner",
    confirmationText: clampStr(input.confirmation_text, 600) || `Space listing (${spaceType}) in ${publicDoc.area}.`,
    commitmentConfirmed: "yes" as const,
    commitmentTime: clampStr(input.commitment_time, 64) || new Date().toISOString(),
    source: clampStr(input.source, 80) || "direct",
    referrer: clampStr(input.referrer, 300) || "none",
    pageUrl: pageUrlClean || null,
    language: lang,
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, "spaces", spaceId), publicDoc);
  batch.set(doc(db, "spacePrivateDetails", spaceId), privateDoc);

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `spaces/${spaceId}`);
  }

  return {
    id: spaceId,
    refId,
    space: {
      id: spaceId,
      owner_uid: user.uid,
      ref_id: refId,
      city: publicDoc.city,
      area: publicDoc.area,
      area_key: publicDoc.areaKey,
      custom_area: publicDoc.customArea,
      space_type: publicDoc.spaceType,
      hours_free: publicDoc.hoursFree,
      vehicles_fit: publicDoc.vehiclesFit,
      desired_monthly_amount: publicDoc.desiredMonthlyAmount || null,
      status: "active",
      created_at: new Date().toISOString(),
      _sortMs: Date.now(),
    },
  };
}

export interface CreateRequestInput {
  matched_space_id?: string | null;
  matched_space_summary?: string | null;
  city?: string | null;
  area: string;
  area_key: string;
  vehicle_type: string;
  duration: string;
  quoted_price_inr?: number | null;
  start_date: string;
  hours_needed: string;
  name: string;
  phone: string;
  email?: string | null;
  vehicle_number: string;
  confirmation_text: string;
  commitment_time: string;
  source?: string;
  referrer?: string;
  page_url?: string | null;
  language?: string;
}

export async function createParkingRequest(input: CreateRequestInput): Promise<{
  id: string;
  refId: string;
}> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error("Please sign in with Google before submitting a request.");
  }

  const city: "Mumbai" | "Pune" = input.city && VALID_CITIES.has(input.city) ? (input.city as "Mumbai" | "Pune") : "Mumbai";
  const areaKey = VALID_AREA_KEYS.has(input.area_key) ? input.area_key : "other";
  const vehicleType = VALID_VEHICLE_TYPES.has(input.vehicle_type) ? input.vehicle_type : "car";
  const duration = input.duration === "per_month" ? "per_month" : "per_day";
  const lang = VALID_LANGS.has(input.language || "en") ? (input.language as string) : "en";
  const phone = clampStr(input.phone, 20).replace(/[\s\-()]/g, "");
  if (!PHONE_REGEX.test(phone)) {
    throw new Error("Phone number must be 10 digits.");
  }

  const matchedSpaceId =
    input.matched_space_id && ID_REGEX.test(input.matched_space_id) ? input.matched_space_id : "";
  const quotedPriceInr =
    typeof input.quoted_price_inr === "number" &&
    Number.isFinite(input.quoted_price_inr) &&
    input.quoted_price_inr >= 0 &&
    input.quoted_price_inr <= 1000000
      ? input.quoted_price_inr
      : null;

  const pageUrlClean = clampStr(input.page_url, 500);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const requestId = `req_${suffix}`;
  const refId = `IS-REQ-${suffix.toUpperCase()}`;

  const docPath = `parkingRequests/${requestId}`;
  const payload = {
    driverUid: user.uid,
    refId,
    matchedSpaceId,
    matchedSpaceSummary: clampStr(input.matched_space_summary, 240),
    city,
    area: clampStr(input.area, 200) || areaKey,
    areaKey,
    vehicleType,
    duration,
    quotedPriceInr,
    startDate: clampStr(input.start_date, 30),
    hoursNeeded: clampStr(input.hours_needed, 120),
    driverName: clampStr(input.name, 120) || clampStr(user.displayName, 120) || "Driver",
    phone,
    email: clampStr(input.email || user.email, 160),
    vehicleNumber: clampStr(input.vehicle_number, 40),
    confirmationText: clampStr(input.confirmation_text, 600) || `Parking request in ${areaKey}.`,
    commitmentConfirmed: "yes" as const,
    commitmentTime: clampStr(input.commitment_time, 64) || new Date().toISOString(),
    status: "pending" as const,
    source: clampStr(input.source, 80) || "direct",
    referrer: clampStr(input.referrer, 300) || "none",
    pageUrl: pageUrlClean || null,
    language: lang,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "parkingRequests", requestId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, docPath);
  }

  return { id: requestId, refId };
}

export async function cancelParkingRequest(requestId: string): Promise<void> {
  if (!ID_REGEX.test(requestId)) throw new Error("Invalid request ID.");
  const path = `parkingRequests/${requestId}`;
  try {
    await updateDoc(doc(db, "parkingRequests", requestId), { status: "cancelled" });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleSpaceStatus(spaceId: string, nextStatus: "active" | "paused"): Promise<void> {
  if (!ID_REGEX.test(spaceId)) throw new Error("Invalid space ID.");
  const path = `spaces/${spaceId}`;
  try {
    await updateDoc(doc(db, "spaces", spaceId), { status: nextStatus });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminSetRequestStatus(
  requestId: string,
  nextStatus: "pending" | "confirmed" | "cancelled"
): Promise<void> {
  if (!ID_REGEX.test(requestId)) throw new Error("Invalid request ID.");
  const path = `parkingRequests/${requestId}`;
  try {
    await updateDoc(doc(db, "parkingRequests", requestId), { status: nextStatus });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export interface CreateSurveyInput {
  name: string;
  phone?: string;
  email?: string | null;
  area: string;
  owns_spot_status: string;
  faced_parking_problem: string;
  would_use_app: string;
  willing_to_pay_3hrs: string;
  additional_notes?: string;
  source?: string;
  language?: string;
}

export async function createSurveyResponse(input: CreateSurveyInput): Promise<{
  id: string;
  refId: string;
}> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error("Please sign in with Google before submitting the survey.");
  }

  const phoneRaw = clampStr(input.phone, 20).replace(/[\s\-()]/g, "");
  if (phoneRaw && !PHONE_REGEX.test(phoneRaw)) {
    throw new Error("Phone number must be 10 digits.");
  }

  const ownsSpotStatus = VALID_OWNS_SPOT.has(input.owns_spot_status) ? input.owns_spot_status : "no";
  const facedParkingProblem = VALID_PARKING_PROBLEM.has(input.faced_parking_problem)
    ? input.faced_parking_problem
    : "yes_sometimes";
  const wouldUseApp = VALID_WOULD_USE_APP.has(input.would_use_app) ? input.would_use_app : "yes";
  const willingToPay3Hrs = VALID_WILLING_TO_PAY.has(input.willing_to_pay_3hrs)
    ? input.willing_to_pay_3hrs
    : "50_100";
  const lang = VALID_LANGS.has(input.language || "en") ? (input.language as string) : "en";
  const area = clampStr(input.area, 160);
  if (!area) {
    throw new Error("Please enter your area or neighbourhood.");
  }

  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const responseId = `srv_${suffix}`;
  const refId = `IS-SRV-${suffix.toUpperCase()}`;
  const docPath = `surveyResponses/${responseId}`;

  const payload = {
    respondentUid: user.uid,
    refId,
    respondentName: clampStr(input.name, 120) || clampStr(user.displayName, 120) || "Respondent",
    phone: phoneRaw,
    email: clampStr(input.email || user.email, 160),
    area,
    ownsSpotStatus,
    facedParkingProblem,
    wouldUseApp,
    willingToPay3Hrs,
    additionalNotes: clampStr(input.additional_notes, 400),
    source: clampStr(input.source, 80) || "direct",
    language: lang,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "surveyResponses", responseId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, docPath);
  }

  return { id: responseId, refId };
}

export interface IdleSpotFirebaseBridge {
  getCurrentUser: () => AuthUserSummary | null;
  signInWithGoogle: typeof signInWithGoogle;
  signOutGoogle: typeof signOutGoogle;
  subscribeAuth: typeof subscribeAuth;
  subscribePublicSpaces: typeof subscribePublicSpaces;
  subscribeMySpaces: typeof subscribeMySpaces;
  subscribeMyRequests: typeof subscribeMyRequests;
  subscribeMySurveys: typeof subscribeMySurveys;
  subscribeAdminInbox: typeof subscribeAdminInbox;
  createSpaceListing: typeof createSpaceListing;
  createParkingRequest: typeof createParkingRequest;
  createSurveyResponse: typeof createSurveyResponse;
  cancelParkingRequest: typeof cancelParkingRequest;
  toggleSpaceStatus: typeof toggleSpaceStatus;
  adminSetRequestStatus: typeof adminSetRequestStatus;
}

declare global {
  interface Window {
    IdleSpotFirebase?: IdleSpotFirebaseBridge;
  }
}

window.IdleSpotFirebase = {
  getCurrentUser: () => toAuthSummary(auth.currentUser),
  signInWithGoogle,
  signOutGoogle,
  subscribeAuth,
  subscribePublicSpaces,
  subscribeMySpaces,
  subscribeMyRequests,
  subscribeMySurveys,
  subscribeAdminInbox,
  createSpaceListing,
  createParkingRequest,
  createSurveyResponse,
  cancelParkingRequest,
  toggleSpaceStatus,
  adminSetRequestStatus,
};

window.dispatchEvent(new CustomEvent("idlespot-firebase-ready"));
