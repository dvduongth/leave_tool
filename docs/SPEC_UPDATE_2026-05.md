# Spec Update — 5 yêu cầu mới (2026-05-08)

> **Status**: DRAFT — pending review
> **Author**: dvduong (with Claude assistance)
> **Reviewer**: TBD

## Mục tiêu

Cập nhật `leave-tool` với 6 yêu cầu nghiệp vụ mới do anh Duong đưa ra:

1. **OT bank** có thời hạn theo cycle (1/6 → 31/5 năm sau, grace đến 31/7), đơn vị PHÚT (không round 0.25h), được consume bù vào nghỉ phép.
2. **Đơn nghỉ phép** đổi UX: chọn **range giờ (start ↔ end)**, hệ thống tự tính tổng giờ làm tròn 0.25h.
3. **Ca làm việc** đăng ký theo từng ngày trong tuần, có approval workflow 1 cấp (Manager duyệt).
4. **Chế độ thai sản** (mẹ có con < 1 tuổi): nghỉ sớm hoặc đi muộn 1 tiếng/ngày, cần Manager duyệt.
5. **Báo cáo** filter chặt theo cấp quản lý (đã có 65%, cần fix 3 gap).
6. **Quản lý tài khoản cá nhân**: nhân viên tự đổi mật khẩu, xem & cập nhật thông tin cơ bản.

## Decisions đã chốt

| # | Decision |
|---|----------|
| 1 | OT cycle 1/6 → 31/5 + grace 2 tháng (31/7) — pattern y hệt LeaveBalance |
| 1 | OT bank được CONSUME khi leave APPROVED (không chỉ display) |
| 1 | Consume order: grace cycle (sắp xóa) → current cycle → LeaveBalance thường |
| 1 | OT cancel/restore: decrement `usedMinutes` ở OTBalance được tag |
| 2 | Replace UX hoàn toàn (không giữ song song mode cũ) |
| 3 | Employee đăng ký, Manager duyệt 1 cấp |
| 3 | Lưu theo tuần với `effectiveDate` (hỗ trợ history) |
| 3 | KHÔNG cho phép overlap pending (1 employee = 1 PENDING tại 1 thời điểm) |
| 4 | Eligibility = mẹ có con < 1 tuổi (FEMALE + EmployeeChild APPROVED + birthDate trong 1 năm) |
| 4 | Employee tự khai báo Child + Manager duyệt 1 cấp |
| 4 | Hỗ trợ nhiều con (sinh đôi, con thứ 2) qua bảng `EmployeeChild` riêng |
| 4 | Phase 1 chỉ note text (không upload chứng từ) |
| - | Cleanup hết dữ liệu cũ, dùng từ đầu |
| - | Admin mặc định: `hachiko@sgsa.jp` / `191091` |
| - | Nhân viên: import từ `D:/info.xlsx`, password mặc định `12345678` |
| - | Cron OT rollover: 00:05 ngày 1/6 (mirror cron LeaveBalance) |

---

## Schema changes

### 1. OTBalance (mới)

```prisma
model OTBalance {
  id             String   @id @default(uuid())
  employeeId     String   @map("employee_id")
  cycleYear      Int      @map("cycle_year")          // năm bắt đầu (2026 = 1/6/2026)
  cycleStart     DateTime @map("cycle_start") @db.Date
  cycleEnd       DateTime @map("cycle_end") @db.Date
  graceDeadline  DateTime @map("grace_deadline") @db.Date
  totalMinutes   Int      @default(0) @map("total_minutes")
  usedMinutes    Int      @default(0) @map("used_minutes")
  pendingMinutes Int      @default(0) @map("pending_minutes")
  createdAt      DateTime @default(now())

  employee Employee @relation(fields: [employeeId], references: [id])

  @@unique([employeeId, cycleYear])
  @@map("ot_balances")
}
```

### 2. OTRecord (sửa)

```prisma
model OTRecord {
  // ... existing fields ...
  otBalanceId String?   @map("ot_balance_id")  // gắn cycle khi APPROVED
  otBalance   OTBalance? @relation(fields: [otBalanceId], references: [id])
}
```

Logic: khi OTRecord APPROVED → tìm OTBalance match `date` → tăng `totalMinutes` += `otMinutes` → set `otBalanceId`.

### 3. LeaveRequest (sửa) — track OT consumption

```prisma
model LeaveRequest {
  // ... existing fields ...
  otConsumedMinutes Int     @default(0) @map("ot_consumed_minutes")
  otBalanceUsedId   String? @map("ot_balance_used_id")  // cycle bị consume
}
```

Logic: khi LeaveRequest APPROVED → consume từ OTBalance (grace → current → LeaveBalance). Khi CANCEL → decrement `usedMinutes`.

### 4. EmployeeWeekShift (mới)

```prisma
model EmployeeWeekShift {
  id            String    @id @default(uuid())
  employeeId    String    @map("employee_id")
  dayOfWeek     Int       // 1=Mon..5=Fri (Sat/Sun excluded)
  shiftType     ShiftType
  effectiveDate DateTime  @map("effective_date") @db.Date
  endDate       DateTime? @map("end_date") @db.Date  // null = active
  createdAt     DateTime  @default(now())

  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId, dayOfWeek, effectiveDate])
  @@index([employeeId, effectiveDate])
  @@map("employee_week_shifts")
}
```

### 5. ShiftChangeRequest (mới)

```prisma
model ShiftChangeRequest {
  id             String       @id @default(uuid())
  employeeId     String       @map("employee_id")
  effectiveDate  DateTime     @map("effective_date") @db.Date
  weeklyShifts   Json         @map("weekly_shifts")  // {"1":"A","2":"B","3":"B","4":"C","5":"C"}
  reason         String?
  status         RecordStatus @default(PENDING)
  approvedBy     String?      @map("approved_by")
  approvedAt     DateTime?    @map("approved_at")
  managerComment String?      @map("manager_comment")
  createdAt      DateTime     @default(now())

  employee Employee @relation(fields: [employeeId], references: [id])
  approver Employee? @relation("ShiftApprover", fields: [approvedBy], references: [id])

  @@index([employeeId, status])
  @@map("shift_change_requests")
}
```

Constraint: **Service-level check** trước POST — không cho tạo nếu employee đã có 1 PENDING.

### 6. EmployeeChild (mới)

```prisma
model EmployeeChild {
  id          String       @id @default(uuid())
  employeeId  String       @map("employee_id")
  birthDate   DateTime     @map("birth_date") @db.Date
  name        String?
  status      RecordStatus @default(PENDING)
  approvedBy  String?      @map("approved_by")
  approvedAt  DateTime?    @map("approved_at")
  note        String?
  createdAt   DateTime     @default(now())

  employee Employee @relation(fields: [employeeId], references: [id])
  approver Employee? @relation("ChildApprover", fields: [approvedBy], references: [id])

  @@index([employeeId, birthDate])
  @@map("employee_children")
}
```

### 7. MaternityLeave (mới)

```prisma
model MaternityLeave {
  id         String       @id @default(uuid())
  employeeId String       @map("employee_id")
  childId    String       @map("child_id")
  date       DateTime     @db.Date
  mode       String       // "EARLY_LEAVE" | "LATE_ARRIVAL"
  startTime  String       @map("start_time")
  endTime    String       @map("end_time")
  note       String?
  status     RecordStatus @default(PENDING)
  approvedBy String?      @map("approved_by")
  approvedAt DateTime?    @map("approved_at")
  createdAt  DateTime     @default(now())

  employee Employee     @relation(fields: [employeeId], references: [id])
  child    EmployeeChild @relation(fields: [childId], references: [id])
  approver Employee?    @relation("MaternityApprover", fields: [approvedBy], references: [id])

  @@unique([employeeId, date])
  @@index([employeeId, date])
  @@map("maternity_leaves")
}
```

### 8. WorkShift (DELETE)

Model `WorkShift` trong schema hiện tại là **dead code** (không có Prisma query nào dùng). Migration sẽ DROP bảng này.

### 9. AppConfig keys mới

| Key | Default | Mô tả |
|-----|---------|-------|
| `OT_CYCLE_START_MONTH` | 6 | Tháng bắt đầu cycle (mặc định tháng 6) |
| `OT_GRACE_MONTHS` | 2 | Số tháng grace sau cycleEnd |
| `MATERNITY_DURATION_MINUTES` | 60 | Duration mỗi lần dùng |
| `MATERNITY_CHILD_AGE_LIMIT_MONTHS` | 12 | Tuổi con giới hạn |

---

## API contract changes

### REQ 1 — OT bank
- `GET /api/ot/balance` — trả về OTBalance hiện tại + grace + totalRemainingMinutes
- `POST /api/ot/[id]/approve` — sửa: sau khi APPROVED, trigger ledger update
- `POST /api/leaves/[id]/approve` — sửa: thêm logic consume OT bank

### REQ 2 — Leave by range
- **NEW** `GET /api/leaves/preview?startDate&startTime&endDate&endTime` → `{totalHours, dailyBreakdown, warnings}`
- `POST /api/leaves` — body đổi: `{startDate, startTime, endDate, endTime, reason}` (bỏ `totalHours`)
- `PATCH /api/leaves/[id]` — body đổi tương tự

### REQ 3 — Shift change
- `GET /api/shift/me` — current weekly shift của user
- `POST /api/shift/change-request` — tạo request (validate no-overlap-pending)
- `GET /api/shift/change-request?status=PENDING` — list (Manager xem subordinates)
- `POST /api/shift/change-request/[id]/approve` — Manager duyệt → apply lên `EmployeeWeekShift`
- `POST /api/shift/change-request/[id]/reject`

### REQ 4 — Maternity
- `POST /api/maternity/child` — khai báo con
- `GET /api/maternity/child` — list của user; Manager xem subordinates
- `POST /api/maternity/child/[id]/approve` — Manager duyệt
- `POST /api/maternity/child/[id]/reject`
- `POST /api/maternity-leave` — tạo log (validate eligibility)
- `GET /api/maternity-leave?month=YYYY-MM`
- `POST /api/maternity-leave/[id]/approve` — Manager duyệt log
- `POST /api/maternity-leave/[id]/reject`

### REQ 5 — Reports fixes
- `GET /api/reports` — sửa: validate `departmentId` cho MANAGER role
- `src/app/(dashboard)/reports/page.tsx` — UI dropdown filter departments theo role
- Audit log cho `REPORT_VIEW` và `REPORT_EXPORT`

### REQ 6 — Account management
- `GET /api/user/me` — đọc profile (name, email, phone, gender, preferredLocale, joinDate, role, departmentName, managerName) — read-only fields trả về kèm để hiển thị
- `PATCH /api/user/me` — update các field cho phép: `name`, `phone` (nếu schema thêm), `gender`, `preferredLocale`. KHÔNG cho update: `email`, `role`, `departmentId`, `managerId`, `workShift`, `joinDate` (Admin-only)
- `POST /api/user/change-password` — body `{currentPassword, newPassword}`. Validate:
  - `currentPassword` match (bcrypt.compare)
  - `newPassword` ≥ 8 ký tự, khác `currentPassword`
  - Rate limit: 5 lần/phút/IP để chống brute force
  - Update `password = bcrypt(newPassword)`, log audit
- UI mới tại `/settings/profile` (hoặc tab trong page settings hiện tại):
  - Section "Profile" — form edit `name/gender/locale`
  - Section "Change password" — 3 fields (current, new, confirm) với eye toggle
  - Section "Email notifications" (giữ nguyên feature hiện có)
  - Section "Display info" (read-only): email, role, department, manager, joinDate

---

## Function signature changes (BREAKING)

### `working-hours.ts`

```typescript
// BEFORE
export function calculateLeaveEnd(
  shift: ShiftType, startDate, startTime, totalHours, holidays
): {endDate, endTime, dailyBreakdown}

// AFTER
export async function calculateLeaveEnd(
  employeeId: string,
  startDate: Date, startTime: string, totalHours: number, holidays: Date[]
): Promise<{endDate, endTime, dailyBreakdown}>

// NEW
export async function calculateHoursFromRange(
  employeeId: string,
  startDate: Date, startTime: string,
  endDate: Date, endTime: string,
  holidays: Date[]
): Promise<{totalHours: number, dailyBreakdown}>

// NEW helper
async function getShiftForDate(employeeId: string, date: Date): Promise<ShiftType>
```

Callers cần update (đã verify qua `gitnexus impact`):
- `src/app/api/leaves/route.ts:151` (POST)
- `src/app/api/leaves/[id]/route.ts:147` (PATCH)
- `src/app/api/leaves/preview/route.ts` (NEW)

---

## Data migration & seed plan

### Step 1: Cleanup
- Drop tất cả bảng (manual `prisma migrate reset --force`).
- Apply schema mới.

### Step 2: Seed admin
```ts
{
  email: 'hachiko@sgsa.jp',
  password: bcrypt('191091'),
  name: 'Hachiko Admin',
  role: 'ADMIN',
  departmentId: <default>,
  workShift: 'A',
  gender: 'UNSPECIFIED'
}
```

### Step 3: Seed employees from `D:/info.xlsx` (sheet TTNV)
**Phân loại theo fill color cột B (Họ tên):**
- `FFD9EAD3` (xanh nhạt) = ACTIVE → import
- Mọi màu khác (đỏ/no fill) = đã nghỉ → SKIP

**Mapping (đã chốt):**
- `departmentId`: phòng "SGSA" (chỉ 1 phòng)
- `role`: `EMPLOYEE` cho tất cả
- `managerId`: admin.id (admin quản lý hết, sau update)
- `gender`: `FEMALE` cho tất cả (trừ exception — xem dưới)
- `workShift`: `A`
- `password`: `bcrypt('12345678')`
- `mustChangePassword`: `true` (force change lần đầu login)
- `name`, `birthday`, `phone`, `email`, `joinDate`: từ xlsx

**19 active employees** (email đã finalize — 7 sẵn có + 12 generate theo pattern `slugify(name)@sgsa.jp`):

| # | Tên | Email | Gender | Birthday | Phone | Join |
|---|-----|-------|--------|----------|-------|------|
| 1 | Đặng Thị Thơm | dangthom@sgsa.jp | F | 1989-07-02 | 0975531542 | 2016-04-01 |
| 2 | Phạm Linh Chi | linhchi@sgsa.jp | F | 1993-12-09 | 0345015568 | 2016-04-01 |
| 3 | Nguyễn Thu Thanh | nguyenthuthanh@sgsa.jp | F | 1990-06-26 | 0971325098 | 2016-04-10 |
| 4 | Chu Diệu Linh | chudieulinh@sgsa.jp 🆕 | F | 1994-07-25 | 0986692094 | 2016-04-08 |
| 5 | Trương Diệu Linh | truong_dieulinh@sgsa.jp | F | 1994-10-31 | 0962147369 | 2016-11-04 |
| 6 | Phạm Quỳnh Trang | quynhtrang@sgsa.jp | F | 1991-10-20 | 0393077968 | 2016-12-04 |
| 7 | Nguyễn Văn Thành ⚠️ | NguyenVanThanh@sgsa.jp | **M** | 1996-09-11 | 0962195463 | 2017-06-10 |
| 8 | Phan Thị Mỹ Hạnh | phanthimyhanh@sgsa.jp 🆕 | F | 1991-02-06 | 0989636039 | 2017-12-01 |
| 9 | Trần Thị Hồng | tranthihong@sgsa.jp 🆕 | F | 1996-11-09 | 0389210783 | 2018-07-17 |
| 10 | Nguyễn Hồng Ngọc | nguyenhongngoc@sgsa.jp 🆕 | F | 1994-10-29 | 0942746488 | 2018-08-17 |
| 11 | Vũ Thị Bích Ngọc | vuthibichngoc@sgsa.jp 🆕 | F | 1991-12-08 | 0356101059 | 2018-10-01 |
| 12 | Nguyễn Thị Ngọc | nguyenthingoc@sgsa.jp 🆕 | F | 1990-09-17 | 0986414602 | 2018-10-01 |
| 13 | Lại Thị Nhật | laithinhat@sgsa.jp 🆕 | F | 1992-06-10 | 0377560762 | 2019-01-01 |
| 14 | Nguyễn Thị Minh Huệ | nguyenthiminhhue@sgsa.jp 🆕 | F | 1993-05-02 | 0974020593 | 2019-01-01 |
| 15 | Đoàn Thị Thu Hòa | doanthithuhoa@sgsa.jp 🆕 | F | 1995-05-18 | 0373640979 | 2019-01-01 |
| 16 | Phạm Thị Thúy | phamthithuy@sgsa.jp 🆕 | F | 1998-02-24 | 0375752935 | 2019-06-01 |
| 17 | Đặng Thị Thanh Thúy | dangthithanhthuy@sgsa.jp 🆕 | F | 1991-08-22 | (none) | (none) |
| 18 | Nguyễn Thị Quỳnh | nguyenthiquynh@sgsa.jp 🆕 | F | 1995-09-03 | 0332859088 | 2020-10-01 |
| 19 | Trần Thị Ngọc Tú | tranthingoctu@sgsa.jp 🆕 | F | 1990-08-21 | 0982976509 | 2021-07-01 |

🆕 = email auto-generated. Phone normalize bỏ khoảng trắng. Không có email duplicate ✓.

⚠️ **Row #7 Nguyễn Văn Thành** là tên nam giới — em đề xuất set `gender: MALE`. Anh confirm.

### Step 4: Seed default shifts
- Mỗi employee → 5 row `EmployeeWeekShift` (Mon-Fri = workShift default), `effectiveDate = today`.

### Step 5: Seed OTBalance cycle hiện tại
- `cycleYear = 2026` (giả sử seed sau 1/6/2026), `cycleStart = 2026-06-01`, `cycleEnd = 2027-05-31`, `graceDeadline = 2027-07-31`, `totalMinutes = 0`.

### Step 6: Seed default holidays + AppConfig keys mới

**Holidays (giữ nguyên từ DB hiện tại trước khi cleanup):**
| Date | Name | Year |
|------|------|------|
| 2026-01-01 | New Year | 2026 |
| 2026-04-27 | Giỗ Tổ Hùng Vương | 2026 |
| 2026-04-30 | Reunification Day | 2026 |
| 2026-05-01 | Labor Day | 2026 |
| 2026-09-02 | National Day | 2026 |
| 2027-02-06 | Tết Âm lịch | 2026 |

---

## Pipeline thực thi

| Phase | Nội dung | Effort |
|---|---|---|
| 0 | Spec + review (đang làm) | 0.5d |
| 1 | Cleanup data + new schema migration + seed admin + seed employees | 1d |
| 2 | REQ 5: fix reports gap (Manager validation + UI dropdown + audit log) | 1d |
| 3 | REQ 1a: OTBalance schema + cron rollover/cleanup + auto-update khi OT APPROVED + `/api/ot/balance` | 2d |
| 4 | REQ 2: `calculateHoursFromRange` + `/api/leaves/preview` (NEW) + replace form UX + POST/PATCH schema | 2d |
| 5 | REQ 1b: consume OT trong leave approval + restore on cancel + tests | 1.5d |
| 6 | REQ 3a: EmployeeWeekShift schema + `getShiftForDate` async + cleanup dead WorkShift model | 1.5d |
| 7 | REQ 3b: refactor `calculateLeaveEnd`/`HoursFromRange` async + update callers + tests | 1.5d |
| 8 | REQ 3c: ShiftChangeRequest API + employee form + manager approval UI | 1d |
| 9 | REQ 4: EmployeeChild + MaternityLeave APIs + employee declare + manager approve + UI | 1.5d |
| 10 | REQ 6: profile page + change password API + audit log | 0.5d |
| 11 | Polish: USER_GUIDE.md update, i18n vi/en, E2E tests, `npx gitnexus analyze` | 1d |

**Tổng: ~13.5 ngày** (thêm 0.5 ngày cho REQ 6).

---

## Critical risks

1. **Async refactor (REQ 3)** — đổi `calculateLeaveEnd` sync → async lan ra callers; gitnexus impact = LOW (chỉ 2 callers) nhưng test coverage cần đầy đủ.
2. **Race condition OT consume** — 2 leave APPROVED đồng thời có thể double-consume; phải `prisma.$transaction` + row lock.
3. **Shift change không retroactive** — đơn nghỉ phép đã APPROVED kéo qua `effectiveDate` của shift change → giữ `totalHours` đã store, KHÔNG recalculate. Cần warning UI khi tạo shift change.
4. **Leave + maternity overlap** — nhân viên dùng maternity và xin leave cùng ngày → quyết định: ALLOW (maternity là 1h, leave là chính). Validation: maternity ngoài khoảng leave.
5. **Migration risk** — cleanup data → mất hết test data. Cần snapshot DB trước.

---

## Open questions cho user

1. **Department mapping**: tạo mặc định 1 phòng "SGSA" cho tất cả? Hay anh có danh sách phòng + map nhân viên?
2. **Manager mapping**: ai là Manager / Head trong 26 nhân viên? Cần list `email → role` và `email → managerId email`.
3. **Gender**: có cách nào suy từ tên không (đa số tên VN có thể đoán), hay set UNSPECIFIED hết?
4. **WorkShift default**: tất cả nhân viên ca A, hay anh chỉ định riêng?
5. **Holidays mặc định**: import danh sách lễ VN 2026 không? Hay để Admin tự nhập?

---

## Next steps

1. ⏳ Anh review spec này + trả lời 5 open questions.
2. ⏳ Reviewer agent sẽ check spec (parallel).
3. ⏳ Sau khi spec lock → Phase 1: cleanup + migrate + seed.
