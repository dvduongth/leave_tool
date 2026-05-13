# Spec: 4 Updates (2026-05-13)

> **Status**: DRAFT — pending review  
> **Author**: dvduong (with Claude assistance)  
> **Reviewer**: TBD

## Summary

4 yeu cau cap nhat:

1. **Filter nghi phep theo startDate/endDate** (overlaps logic)
2. **Sap xep danh sach nhan vien theo tham nien** (joinDate ascending)
3. **Tinh bonus tham nien tu mung 1/6, chu ky 5 nam**
4. **Friday override** — admin/head config tuan nao thu 6 = thu 2-5

---

## REQ 1: Filter Leave by Date Range (Overlaps)

### Current behavior

File `src/app/api/leaves/route.ts:100-104`:
```typescript
if (startDate) where.startDate = { gte: new Date(startDate) };
if (endDate)   where.endDate   = { lte: new Date(endDate) };
```
=> Filter "contained within" — don nghi phai nam TRONG khoang filter.

### New behavior

Filter "overlaps" — don nghi CO CHONG LAN voi khoang filter:
```typescript
if (startDate && endDate) {
  where.startDate = { lte: new Date(endDate) };
  where.endDate   = { gte: new Date(startDate) };
} else if (startDate) {
  where.endDate = { gte: new Date(startDate) };
} else if (endDate) {
  where.startDate = { lte: new Date(endDate) };
}
```

### Files to change

| File | Change |
|------|--------|
| `src/app/api/leaves/route.ts` | Update filter logic (lines 100-104) |

### Test cases

| Filter | Leave (15/5 - 20/5) | Expected |
|--------|---------------------|----------|
| 10/5 - 14/5 | | NOT shown (no overlap) |
| 10/5 - 16/5 | | SHOWN (overlaps start) |
| 18/5 - 25/5 | | SHOWN (overlaps end) |
| 16/5 - 18/5 | | SHOWN (contained) |
| 10/5 - 25/5 | | SHOWN (contains leave) |

---

## REQ 2: Sort Employees by Seniority

### Current behavior

`src/lib/reports.ts:433` sorts by `name: "asc"`.

### New behavior

Sort by `joinDate: "asc"` (oldest first = highest seniority first).

Null joinDate goes to end.

### Files to change

| File | Function | Change |
|------|----------|--------|
| `src/lib/reports.ts` | `getMonthlyDetailReport` | `orderBy: { joinDate: "asc" }` |
| `src/lib/reports.ts` | `getWeeklyReport` | Sort `employees` array by joinDate |
| `src/lib/reports.ts` | `getMonthlyReport` | Sort `topLeaveTakers` by joinDate |
| `src/app/api/employees/route.ts` | GET | Add `orderBy: { joinDate: "asc" }` |

### Edge case

Employees with `joinDate = null` should appear at the END of the list (treated as newest).

Prisma: `orderBy: { joinDate: { sort: "asc", nulls: "last" } }`

---

## REQ 3: Seniority Bonus from June 1st, 5-year Cycle

### Current behavior

`src/lib/seniority.ts:28-35`:
```typescript
const years = yearsBetween(joinDate, asOf);
const tiers = Math.floor(years / SENIORITY_YEARS_PER_TIER);
return tiers * SENIORITY_BONUS_HOURS_PER_TIER;
```

This counts full years from exact joinDate to asOf.

### New behavior

Seniority tiers are calculated based on **June 1st alignment**:

1. Find the **first June 1st on or after joinDate** = `anchorDate`
2. Find the **most recent June 1st on or before asOf** = `evalDate`
3. `tiers = floor((evalDate - anchorDate) / 5 years)`

### Logic (có lợi cho nhân viên)

- **anchorDate** = June 1st BEFORE joinDate (năm tài chính mà nhân viên gia nhập)
  - Join trước 1/6 → anchor = 1/6 năm trước
  - Join từ 1/6 trở đi → anchor = 1/6 năm đó
- **evalDate** = June 1st on or before asOf (mốc milestone gần nhất)
- **seniority years** = evalDate.year - anchorDate.year
- **tiers** = floor(seniority years / 5)

### Examples

| joinDate | asOf | anchorDate | evalDate | Seniority Years | Tiers | Bonus |
|----------|------|------------|----------|-----------------|-------|-------|
| 2020-03-15 | 2020-06-01 | 2019-06-01 | 2020-06-01 | 1 | 0 | +0h |
| 2020-03-15 | 2024-06-01 | 2019-06-01 | 2024-06-01 | 5 | 1 | +8h |
| 2020-03-15 | 2024-05-31 | 2019-06-01 | 2023-06-01 | 4 | 0 | +0h |
| 2020-03-15 | 2025-06-01 | 2019-06-01 | 2025-06-01 | 6 | 1 | +8h |
| 2020-06-01 | 2025-06-01 | 2020-06-01 | 2025-06-01 | 5 | 1 | +8h |
| 2020-06-02 | 2025-06-01 | 2020-06-01 | 2025-06-01 | 5 | 1 | +8h |
| 2016-04-01 | 2026-06-01 | 2015-06-01 | 2026-06-01 | 11 | 2 | +16h |
| 2016-06-01 | 2026-06-01 | 2016-06-01 | 2026-06-01 | 10 | 2 | +16h |

### Implementation

```typescript
/**
 * Returns June 1st BEFORE joinDate (fiscal year start when employee joined).
 * - Join before June 1st → anchor = June 1st of previous year
 * - Join on/after June 1st → anchor = June 1st of same year
 */
export function getJune1stAnchor(joinDate: Date): Date {
  const year = joinDate.getFullYear();
  const june1 = new Date(year, 5, 1); // month is 0-indexed
  if (joinDate < june1) return new Date(year - 1, 5, 1);
  return june1;
}

/**
 * Returns June 1st on or before asOf (most recent milestone).
 */
export function getJune1stMilestone(asOf: Date): Date {
  const year = asOf.getFullYear();
  const june1 = new Date(year, 5, 1);
  if (asOf >= june1) return june1;
  return new Date(year - 1, 5, 1);
}

export function calculateSeniorityBonusHours(
  joinDate: Date | null | undefined,
  asOf: Date
): number {
  if (!joinDate) return 0;
  
  const anchor = getJune1stAnchor(joinDate);
  const milestone = getJune1stMilestone(asOf);
  
  if (milestone < anchor) return 0;
  
  const years = milestone.getFullYear() - anchor.getFullYear();
  const tiers = Math.floor(years / SENIORITY_YEARS_PER_TIER);
  return tiers * SENIORITY_BONUS_HOURS_PER_TIER;
}
```

### Files to change

| File | Change |
|------|--------|
| `src/lib/seniority.ts` | Replace `calculateSeniorityBonusHours` |
| `src/lib/seniority-server.ts` | Update if using different logic |

---

## REQ 4: Friday Override (Extended Hours)

### Business rule

Some weeks, Friday works like Mon-Thu (full 8h instead of 7h). Admin or HEAD can configure.

### Schema

```prisma
model FridayOverride {
  id        String   @id @default(uuid())
  weekStart DateTime @db.Date  // Monday of that week
  note      String?            // optional reason
  createdBy String   @map("created_by")
  createdAt DateTime @default(now()) @map("created_at")

  creator   Employee @relation("FridayOverrideCreator", fields: [createdBy], references: [id])

  @@unique([weekStart])
  @@map("friday_overrides")
}
```

Add to Employee:
```prisma
model Employee {
  // ... existing fields
  fridayOverrides FridayOverride[] @relation("FridayOverrideCreator")
}
```

### API

#### GET /api/friday-override

Returns list of configured Friday overrides.

Query params:
- `from` (optional): filter weekStart >= from
- `to` (optional): filter weekStart <= to

Response:
```json
[
  {
    "id": "uuid",
    "weekStart": "2026-05-12",
    "note": "Du an gap",
    "createdBy": "uuid",
    "createdAt": "2026-05-10T10:00:00Z",
    "creator": { "id": "uuid", "name": "Admin" }
  }
]
```

#### POST /api/friday-override

Create a Friday override.

Auth: ADMIN or HEAD only.

Body:
```json
{
  "weekStart": "2026-05-12",  // must be a Monday
  "note": "Tang ca tuan nay"
}
```

Validation:
- `weekStart` must be a Monday
- Cannot create duplicate (weekStart unique)

#### DELETE /api/friday-override/[id]

Remove a Friday override.

Auth: ADMIN or HEAD only.

### Working hours logic change

File `src/lib/working-hours.ts`, function `getWorkingRanges`:

```typescript
export async function getWorkingRanges(
  shift: ShiftType,
  date: Date
): Promise<{ ranges: { start: string; end: string }[]; totalMinutes: number } | null> {
  const day = date.getDay();
  if (day === 0 || day === 6) return null;

  const config = SHIFT_CONFIG[shift];
  
  // Check if Friday should use weekday hours
  let ranges: { start: string; end: string }[];
  if (day === 5) {
    const isFridayExtended = await isFridayOverride(date);
    ranges = isFridayExtended ? config.weekday : config.friday;
  } else {
    ranges = config.weekday;
  }

  const totalMinutes = ranges.reduce((sum, r) => {
    return sum + (timeToMinutes(r.end) - timeToMinutes(r.start));
  }, 0);

  return { ranges, totalMinutes };
}

async function isFridayOverride(date: Date): Promise<boolean> {
  const monday = getMondayOfWeek(date);
  const override = await prisma.fridayOverride.findUnique({
    where: { weekStart: monday }
  });
  return !!override;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
```

### BREAKING CHANGE

`getWorkingRanges` changes from sync to async.

Callers to update:
- `calculateLeaveEnd` (already async)
- `calculateHoursFromRange` (already async)

Since these callers are already async, impact is LOW.

### UI

Add section in Admin Settings page:
- Table showing upcoming Friday overrides
- "Add" button to create new override (date picker for Monday)
- "Delete" button per row
- Show creator name + note

---

## Migration Plan

### Phase 1: Schema

1. Create migration for `FridayOverride` table
2. Run `npx prisma migrate dev`

### Phase 2: Implementation

1. REQ 1: Update leave filter (15 min)
2. REQ 2: Update employee sorting (30 min)
3. REQ 3: Update seniority logic (45 min)
4. REQ 4: Friday override API + working-hours (2h)

### Phase 3: Testing

- Unit tests for seniority edge cases
- Integration tests for leave filter
- Manual test Friday override with leave calculation

---

## Risk Assessment

| REQ | Risk | Mitigation |
|-----|------|------------|
| 1 | LOW | Simple filter change |
| 2 | LOW | Ordering change only |
| 3 | MEDIUM | Edge cases need thorough testing |
| 4 | MEDIUM | Async change, but callers already async |

---

## Open Questions

All resolved:
- [x] Filter type: **Overlaps** (confirmed)
- [x] Friday override auth: **Admin + HEAD** (confirmed)
