import prisma from "@/lib/prisma";
import * as defaults from "@/lib/constants";

/**
 * Editable app configs, DB-backed with in-memory cache.
 * Keys below are tunable via /admin/settings. If not present in DB,
 * falls back to the compiled-in default from @/lib/constants.
 */
export type ConfigKey =
  | "BASE_ANNUAL_LEAVE_HOURS"
  | "SENIORITY_BONUS_HOURS_PER_TIER"
  | "SENIORITY_YEARS_PER_TIER"
  | "LOW_BALANCE_THRESHOLD_HOURS"
  | "GRACE_PERIOD_MONTHS"
  | "HIGH_OT_THRESHOLD_HOURS"
  | "MENSTRUAL_LEAVE_MAX_DAYS_PER_MONTH"
  | "MENSTRUAL_LEAVE_DURATION_MINUTES";

export type ConfigType = "int" | "float" | "string";

interface ConfigDef {
  type: ConfigType;
  defaultValue: () => number | string;
  description: string;
  group: "leave" | "ot" | "menstrual";
}

export const CONFIG_DEFS: Record<ConfigKey, ConfigDef> = {
  BASE_ANNUAL_LEAVE_HOURS: {
    type: "float",
    defaultValue: () => defaults.BASE_ANNUAL_LEAVE_HOURS,
    description: "Số giờ phép năm cơ bản (chưa gồm thâm niên)",
    group: "leave",
  },
  SENIORITY_BONUS_HOURS_PER_TIER: {
    type: "float",
    defaultValue: () => defaults.SENIORITY_BONUS_HOURS_PER_TIER,
    description: "Số giờ cộng thâm niên mỗi mốc",
    group: "leave",
  },
  SENIORITY_YEARS_PER_TIER: {
    type: "int",
    defaultValue: () => defaults.SENIORITY_YEARS_PER_TIER,
    description: "Số năm thâm niên cho mỗi mốc bonus",
    group: "leave",
  },
  LOW_BALANCE_THRESHOLD_HOURS: {
    type: "float",
    defaultValue: () => defaults.LOW_BALANCE_THRESHOLD_HOURS,
    description: "Ngưỡng cảnh báo quỹ phép thấp (giờ)",
    group: "leave",
  },
  GRACE_PERIOD_MONTHS: {
    type: "int",
    defaultValue: () => defaults.GRACE_PERIOD_MONTHS,
    description: "Số tháng gia hạn phép năm sau khi hết chu kỳ",
    group: "leave",
  },
  HIGH_OT_THRESHOLD_HOURS: {
    type: "float",
    defaultValue: () => defaults.HIGH_OT_THRESHOLD_HOURS,
    description: "Ngưỡng cảnh báo OT cao (giờ/tháng)",
    group: "ot",
  },
  MENSTRUAL_LEAVE_MAX_DAYS_PER_MONTH: {
    type: "int",
    defaultValue: () => 3,
    description: "Số ngày tối đa nhân viên nữ được dùng mỗi tháng",
    group: "menstrual",
  },
  MENSTRUAL_LEAVE_DURATION_MINUTES: {
    type: "int",
    defaultValue: () => 30,
    description: "Thời lượng cho mỗi lượt (phút)",
    group: "menstrual",
  },
};

const CACHE_TTL_MS = 60_000;
let cache: { data: Map<string, string>; expiresAt: number } | null = null;

async function loadAll(): Promise<Map<string, string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  const rows = await prisma.appConfig.findMany();
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.key, r.value);
  cache = { data: map, expiresAt: Date.now() + CACHE_TTL_MS };
  return map;
}

export function invalidateConfigCache(): void {
  cache = null;
}

function coerce(value: string, type: ConfigType): number | string {
  if (type === "int") return parseInt(value, 10);
  if (type === "float") return parseFloat(value);
  return value;
}

export async function getConfigNumber(key: ConfigKey): Promise<number> {
  const def = CONFIG_DEFS[key];
  const map = await loadAll();
  const raw = map.get(key);
  if (raw != null) {
    const v = coerce(raw, def.type);
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  return Number(def.defaultValue());
}

export async function getConfigString(key: ConfigKey): Promise<string> {
  const def = CONFIG_DEFS[key];
  const map = await loadAll();
  const raw = map.get(key);
  if (raw != null) return raw;
  return String(def.defaultValue());
}

export async function setConfig(
  key: ConfigKey,
  value: string
): Promise<void> {
  const def = CONFIG_DEFS[key];
  // Validate
  if (def.type === "int") {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) throw new Error(`Invalid int for ${key}: ${value}`);
    value = String(n);
  } else if (def.type === "float") {
    const n = parseFloat(value);
    if (Number.isNaN(n)) throw new Error(`Invalid float for ${key}: ${value}`);
    value = String(n);
  }
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value, type: def.type, description: def.description },
    update: { value, type: def.type, description: def.description },
  });
  invalidateConfigCache();
}

export async function getAllConfigs(): Promise<
  Array<{
    key: ConfigKey;
    value: number | string;
    type: ConfigType;
    description: string;
    group: string;
    isDefault: boolean;
  }>
> {
  const map = await loadAll();
  return (Object.keys(CONFIG_DEFS) as ConfigKey[]).map((key) => {
    const def = CONFIG_DEFS[key];
    const raw = map.get(key);
    const value =
      raw != null ? coerce(raw, def.type) : def.defaultValue();
    return {
      key,
      value,
      type: def.type,
      description: def.description,
      group: def.group,
      isDefault: raw == null,
    };
  });
}
