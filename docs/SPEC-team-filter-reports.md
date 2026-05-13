# Spec: Team Filter & Reports Enhancement

**Created**: 2026-05-13  
**Status**: In Progress  
**Reviewer**: Pending

---

## Overview

Enhancement cho leave_tool: thêm filter theo thành viên team và nâng cấp báo cáo.

---

## Phase 1: Filter thành viên (A1-A4)

### A1: API `/api/team-members`

**Endpoint**: `GET /api/team-members`

**Response**:
```json
{
  "members": [
    { "id": "uuid", "name": "Nguyễn A", "email": "a@example.com" }
  ]
}
```

**Logic theo role**:
- EMPLOYEE: chỉ trả về chính mình
- MANAGER: trả về subordinates (managerId = user.id)
- HEAD: trả về tất cả nhân viên trong department
- ADMIN: trả về tất cả nhân viên (có thể filter theo departmentId)

### A2: Filter employee cho `/leaves` (team mode)

**UI**: Dropdown "Nhân viên" xuất hiện khi `scope=team`
- Options: "Tất cả" | [danh sách từ A1]
- Khi chọn nhân viên, gọi API với `employeeId` param

### A3: Filter employee cho `/ot`

**UI**: Dropdown "Nhân viên" cho Manager/Head/Admin
- Tương tự A2

### A4: Filter employee cho `/flex-time`

**UI**: Dropdown "Nhân viên" cho Manager/Head/Admin
- Tương tự A2

---

## Phase 2: Nghỉ đèn đỏ 1.5h (B1)

### B1: Mode chọn duration

**Schema change**: Thêm column `mode` vào `MenstrualLeave`
```prisma
model MenstrualLeave {
  // ... existing fields
  mode  String @default("SHORT") // "SHORT" (30m) | "LONG" (90m)
}
```

**UI**: Radio/Select trong form đăng ký
- "Nghỉ ngắn (30 phút)"
- "Nghỉ 1.5 giờ"

**API**: Chấp nhận `mode` param, tính `endTime` theo mode

---

## Phase 3: Báo cáo nâng cao (C1-C3)

### C1: Bảng tổng hợp theo tháng

**New report type**: `type=monthly-detail`

**Response**:
```json
{
  "type": "monthly-detail",
  "month": "2026-05",
  "employees": [
    {
      "id": "uuid",
      "name": "Nguyễn A",
      "leaveHours": 16,
      "otMinutes": 480,
      "flexRemaining": -30,
      "menstrualDays": 2,
      "menstrualMinutes": 60
    }
  ],
  "totals": {
    "leaveHours": 24,
    "otMinutes": 1200,
    "menstrualDays": 3
  }
}
```

### C2: Daily export CSV

**Endpoint**: `GET /api/reports/export?type=daily&date=2026-05-15`

**CSV format**:
```csv
Ngày,Nhân viên,Loại,Giờ bắt đầu,Giờ kết thúc,Số giờ/phút,Ghi chú
2026-05-15,Nguyễn A,Nghỉ phép,08:00,17:00,8h,Việc gia đình
2026-05-15,Trần B,OT,18:00,21:00,180m,Deploy production
```

### C3: Chi tiết team trong reports

**Enhancement**: Daily/Weekly report hiển thị chi tiết từng người cho Manager/Head
- Hiện tại đã có, chỉ cần đảm bảo UI hiển thị đầy đủ

---

## i18n Keys cần thêm

```json
{
  "common": {
    "allMembers": "Tất cả",
    "selectMember": "Chọn nhân viên"
  },
  "wellness": {
    "modeShort": "Nghỉ ngắn (30 phút)",
    "modeLong": "Nghỉ 1.5 giờ"
  },
  "reports": {
    "monthlyDetail": "Tổng hợp theo tháng",
    "exportDaily": "Xuất báo cáo ngày"
  }
}
```

---

## Files cần thay đổi

| File | Thay đổi |
|------|----------|
| `src/app/api/team-members/route.ts` | **NEW** |
| `src/app/(dashboard)/leaves/page.tsx` | Thêm employee filter |
| `src/app/(dashboard)/ot/page.tsx` | Thêm employee filter |
| `src/app/(dashboard)/flex-time/page.tsx` | Thêm employee filter |
| `prisma/schema.prisma` | Thêm mode cho MenstrualLeave |
| `src/app/(dashboard)/wellness/page.tsx` | Thêm mode selector |
| `src/app/api/menstrual-leave/route.ts` | Hỗ trợ mode param |
| `src/lib/reports.ts` | Thêm monthly-detail report |
| `src/app/api/reports/route.ts` | Hỗ trợ monthly-detail |
| `src/app/(dashboard)/reports/page.tsx` | Thêm tab/UI cho monthly-detail |
| `src/lib/i18n/locales/*.json` | i18n keys |

---

## Acceptance Criteria

- [ ] A1: API team-members trả về đúng theo role
- [ ] A2: Leaves page có dropdown filter employee (team mode)
- [ ] A3: OT page có dropdown filter employee
- [ ] A4: Flex-time page có dropdown filter employee
- [ ] B1: Wellness page có mode chọn 30p/1.5h
- [ ] C1: Reports page có bảng tổng hợp theo tháng
- [ ] C2: Có nút xuất CSV cho daily report
- [ ] C3: Reports hiển thị chi tiết từng người cho Manager/Head
- [ ] TypeScript compile thành công
- [ ] i18n đầy đủ (vi/en/ja)
