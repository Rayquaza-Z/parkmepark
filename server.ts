import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

interface StoredSpace {
  id: string;
  area: string;
  area_key: string;
  custom_area: string;
  space_type: string;
  hours_free: string;
  vehicles_fit: number;
  desired_monthly_amount: string | null;
  name: string;
  phone: string;
  property_owner_or_manager: string;
  source: string;
  referrer: string;
  language: string;
  commitment_confirmed: string;
  commitment_time: string;
  confirmation_text: string;
  created_at: string;
}

interface PublicSpace {
  id: string;
  area: string;
  area_key: string;
  custom_area: string;
  space_type: string;
  hours_free: string;
  vehicles_fit: number;
  desired_monthly_amount: string | null;
  created_at: string;
}

interface StoredRequest {
  id: string;
  matched_space_id: string | null;
  matched_space_summary: string | null;
  area: string;
  area_key: string;
  vehicle_type: string;
  duration: string;
  quoted_price_inr: number | null;
  start_date: string;
  hours_needed: string;
  name: string;
  phone: string;
  vehicle_number: string;
  source: string;
  referrer: string;
  language: string;
  commitment_confirmed: string;
  commitment_time: string;
  confirmation_text: string;
  created_at: string;
}

interface ParkingStore {
  spaces: StoredSpace[];
  requests: StoredRequest[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "parking-store.json");

function ensureStore(): ParkingStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const empty: ParkingStore = { spaces: [], requests: [] };
      fs.writeFileSync(STORE_FILE, JSON.stringify(empty, null, 2), "utf8");
      return empty;
    }
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ParkingStore>;
    return {
      spaces: Array.isArray(parsed.spaces) ? parsed.spaces : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    };
  } catch (err) {
    console.error("Failed reading store file:", err);
    return { spaces: [], requests: [] };
  }
}

function writeStore(store: ParkingStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = STORE_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmpFile, STORE_FILE);
}

function toPublicSpace(space: StoredSpace): PublicSpace {
  return {
    id: space.id,
    area: space.area,
    area_key: space.area_key,
    custom_area: space.custom_area,
    space_type: space.space_type,
    hours_free: space.hours_free,
    vehicles_fit: space.vehicles_fit,
    desired_monthly_amount: space.desired_monthly_amount,
    created_at: space.created_at,
  };
}

function cleanString(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function isTenDigitPhone(value: string): boolean {
  return /^[0-9]{10}$/.test(value);
}

let store: ParkingStore = ensureStore();

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "250kb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Public list of verified/submitted owner spaces (never exposes phone, name, or manager details)
  app.get("/api/spaces", (req: Request, res: Response) => {
    const areaFilter = cleanString(req.query.area, 64);
    const list = store.spaces
      .filter((space) => !areaFilter || areaFilter === "all" || space.area_key === areaFilter)
      .slice()
      .reverse()
      .map(toPublicSpace);
    res.json({ ok: true, spaces: list });
  });

  // Owner lists a parking space -> persisted & immediately visible to drivers across devices
  app.post("/api/spaces", (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const name = cleanString(body.name, 120);
    const phone = cleanString(body.phone, 20).replace(/[\s\-()]/g, "");
    const area = cleanString(body.area, 200);
    const areaKey = cleanString(body.area_key, 40);
    const customArea = cleanString(body.custom_area, 160);
    const spaceType = cleanString(body.space_type, 40);
    const hoursFree = cleanString(body.hours_free, 120);
    const vehiclesFit = Number(body.vehicles_fit);
    const manager = cleanString(body.property_owner_or_manager, 160);
    const desiredAmount = cleanString(body.desired_monthly_amount, 60) || null;

    if (
      !name ||
      !isTenDigitPhone(phone) ||
      !area ||
      !areaKey ||
      !spaceType ||
      !hoursFree ||
      !Number.isFinite(vehiclesFit) ||
      vehiclesFit < 1 ||
      !manager ||
      body.commitment_confirmed !== "yes"
    ) {
      res.status(400).json({ ok: false, error: "Invalid space submission payload." });
      return;
    }

    const newSpace: StoredSpace = {
      id: "spc_" + crypto.randomUUID().slice(0, 8),
      area,
      area_key: areaKey,
      custom_area: customArea,
      space_type: spaceType,
      hours_free: hoursFree,
      vehicles_fit: Math.floor(vehiclesFit),
      desired_monthly_amount: desiredAmount,
      name,
      phone,
      property_owner_or_manager: manager,
      source: cleanString(body.source, 80) || "direct",
      referrer: cleanString(body.referrer, 300) || "none",
      language: cleanString(body.language, 10) || "en",
      commitment_confirmed: "yes",
      commitment_time: cleanString(body.commitment_time, 64) || new Date().toISOString(),
      confirmation_text: cleanString(body.confirmation_text, 600),
      created_at: new Date().toISOString(),
    };

    store.spaces.push(newSpace);
    writeStore(store);

    res.status(201).json({ ok: true, space: toPublicSpace(newSpace) });
  });

  // Driver requests either a listed space or a custom space (kept private on server)
  app.post("/api/requests", (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const area = cleanString(body.area, 200);
    const areaKey = cleanString(body.area_key, 40);
    const vehicleType = cleanString(body.vehicle_type, 40);
    const duration = cleanString(body.duration, 40);
    const startDate = cleanString(body.start_date, 30);
    const hoursNeeded = cleanString(body.hours_needed, 120);
    const name = cleanString(body.name, 120);
    const phone = cleanString(body.phone, 20).replace(/[\s\-()]/g, "");
    const vehicleNumber = cleanString(body.vehicle_number, 40);

    if (
      !area ||
      !areaKey ||
      !vehicleType ||
      !duration ||
      !startDate ||
      !hoursNeeded ||
      !name ||
      !isTenDigitPhone(phone) ||
      !vehicleNumber ||
      body.commitment_confirmed !== "yes"
    ) {
      res.status(400).json({ ok: false, error: "Invalid request submission payload." });
      return;
    }

    const quotedPrice =
      typeof body.quoted_price_inr === "number" && Number.isFinite(body.quoted_price_inr)
        ? body.quoted_price_inr
        : null;

    const newRequest: StoredRequest = {
      id: "req_" + crypto.randomUUID().slice(0, 8),
      matched_space_id: cleanString(body.matched_space_id, 40) || null,
      matched_space_summary: cleanString(body.matched_space_summary, 240) || null,
      area,
      area_key: areaKey,
      vehicle_type: vehicleType,
      duration,
      quoted_price_inr: quotedPrice,
      start_date: startDate,
      hours_needed: hoursNeeded,
      name,
      phone,
      vehicle_number: vehicleNumber,
      source: cleanString(body.source, 80) || "direct",
      referrer: cleanString(body.referrer, 300) || "none",
      language: cleanString(body.language, 10) || "en",
      commitment_confirmed: "yes",
      commitment_time: cleanString(body.commitment_time, 64) || new Date().toISOString(),
      confirmation_text: cleanString(body.confirmation_text, 600),
      created_at: new Date().toISOString(),
    };

    store.requests.push(newRequest);
    writeStore(store);

    res.status(201).json({ ok: true, id: newRequest.id });
  });

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
