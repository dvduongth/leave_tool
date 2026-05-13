# Hướng dẫn sử dụng Leave Manager

> Phiên bản offline của trang `/help` trong app. Xem trực tiếp trong app sau khi đăng nhập để có trải nghiệm tương tác tốt hơn.

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Vai trò](#2-vai-trò)
3. [Khái niệm](#3-khái-niệm)
4. [Xin nghỉ phép](#4-xin-nghỉ-phép)
5. [Ghi OT](#5-ghi-ot)
   - 5.1. [Nghỉ đèn đỏ (Wellness)](#51-nghỉ-đèn-đỏ-wellness)
6. [Flex Time](#6-flex-time)
7. [Duyệt đơn](#7-duyệt-đơn-manager--head)
8. [Báo cáo](#8-báo-cáo)
9. [Quản trị](#9-quản-trị-admin)
10. [FAQ](#10-faq)

---

## 1. Giới thiệu

**Leave Manager** số hoá toàn bộ quy trình xin nghỉ – duyệt – bù giờ. Các tính năng chính:

- **Nghỉ phép**: xin phép năm; duyệt 2 cấp.
- **OT**: ghi giờ làm thêm, đổi thành ngày nghỉ hoặc tiền (hệ số theo loại ngày).
- **Flex Time**: theo dõi giờ thiếu và giờ bù, tự động kết toán cuối tháng.
- **Wellness**: nghỉ đèn đỏ cho nhân viên nữ (tối đa 1.5h/tháng).
- **Duyệt đơn**: Manager duyệt cấp 1, Head duyệt cấp 2.
- **Báo cáo**: daily / weekly / monthly + biểu đồ.

## 2. Vai trò

| Role | Mô tả |
|------|-------|
| `EMPLOYEE` | Xin nghỉ, ghi OT, ghi Flex, xem báo cáo cá nhân |
| `MANAGER` | Duyệt cấp 1 đơn trong team |
| `HEAD` | Duyệt cấp 2, duyệt Flex Makeup, xem báo cáo phòng |
| `ADMIN` | CRUD nhân viên, ngày lễ, xem tất cả báo cáo |

## 3. Khái niệm

- **Chu kỳ phép (Cycle)**: 01/06 → 31/05 năm sau. Cấp 96 giờ (12 ngày) / cycle.
- **Grace period (OT bank)**: Nếu dùng OT đổi thành ngày nghỉ, 2 tháng sau khi kết thúc chu kỳ (đến 31/07) vẫn được dùng OT bank của chu kỳ cũ nếu chưa hết.
- **Thâm niên (Seniority)**: mỗi 5 năm được cộng thêm 8 giờ phép (1 ngày). Tính từ mốc 01/06 của năm vào làm, có lợi cho nhân viên.
  - Ví dụ: vào 15/03/2020 → mốc tính = 01/06/2019 → đến 01/06/2024 = 5 năm → +8h bonus
- **Ca làm việc** (đã trừ 1h nghỉ trưa 12:00–13:00):
  - A: 07:00–17:00 (thứ 6: 07:00–16:00) → 8h weekday, 7h friday
  - B: 07:30–17:30 (thứ 6: 07:30–16:30) → 8h weekday, 7h friday
  - C: 09:00–19:00 (thứ 6: 10:00–19:00) → 8h weekday, 7h friday
  - D: 08:00–18:00 (thứ 6: 08:00–17:00) → 8h weekday, 7h friday
- **Friday Override**: Admin/Head có thể cấu hình tuần nào thứ 6 làm như ngày thường (8h thay vì 7h).
- **Giờ nghỉ hợp lệ**: chỉ tính trong giờ hành chính, trừ 1 giờ nghỉ trưa. Không tính cuối tuần / lễ.
- **Sắp xếp danh sách**: mọi danh sách nhân viên được sắp theo thâm niên (người vào lâu nhất trước).

## 4. Xin nghỉ phép

### Quy trình

1. **Tạo đơn**: `My Leaves → New Leave`. Chọn ngày + giờ bắt đầu, ngày + giờ kết thúc. Hệ thống tự tính tổng giờ nghỉ.
2. **Lưu nháp / Submit**: có thể lưu `DRAFT` hoặc gửi duyệt ngay.
3. **Duyệt cấp 1 (Manager)**: ≤ 8h + Manager OK → duyệt xong. &gt; 8h hoặc bạn là Manager → chuyển cấp 2.
4. **Duyệt cấp 2 (Head)**: áp dụng với đơn dài hoặc người xin là Manager / Head.
5. **Hoàn tất**: APPROVED → giờ trừ quỹ. REJECTED → sửa và gửi lại.

### Trạng thái đơn

| Status | Ý nghĩa |
|--------|---------|
| `DRAFT` | Nháp, chưa gửi |
| `PENDING_MANAGER` | Chờ Manager duyệt |
| `PENDING_HEAD` | Chờ Head duyệt |
| `APPROVED` | Đã duyệt, giờ đã trừ |
| `REJECTED` | Bị từ chối |
| `CANCEL_PENDING` | Đang xin huỷ đơn đã duyệt |
| `CANCELLED` | Đã huỷ, hoàn giờ phép |

### Huỷ đơn đã duyệt

Đơn `APPROVED` chỉ có thể **xin huỷ** qua `Request Cancel`. Cần Manager / Head duyệt lại.

## 5. Ghi OT

`OT Records → Record OT`. Nhập ngày, giờ bắt đầu – kết thúc, lý do.

OT có thể đổi thành:
- **Ngày nghỉ**: tích lũy vào OT bank, dùng bù khi xin nghỉ phép (xem mục 9.2)
- **Tiền**: hệ thống tự tính hệ số theo loại ngày:
  - Ngày thường (x1.5): sau giờ tan ca hành chính
  - Cuối tuần (x2.0): Thứ 7, Chủ nhật
  - Ngày lễ (x3.0): trùng danh sách Holidays

## 5.1. Nghỉ đèn đỏ (Wellness)

Áp dụng cho **nhân viên nữ**. Mỗi tháng được nghỉ tối đa **1.5 giờ**.

1. Vào `Wellness` → chọn ngày + giờ bắt đầu + thời lượng:
   - **Ngắn**: 30 phút
   - **Trung bình**: 1 giờ (60 phút)
   - **Dài**: 1.5 giờ (90 phút)
2. Hệ thống tự tính giờ kết thúc.
3. Không cần duyệt, không trừ phép.

> Chỉ nhân viên có giới tính FEMALE mới thấy mục này trong sidebar.

## 6. Flex Time

Dùng cho **thiếu giờ** trong tháng (đi trễ, về sớm, việc riêng &lt; 4h) mà không trừ phép.

1. **Record Deficit**: ghi ngày + số giờ thiếu + lý do.
2. **Record Makeup**: khi làm bù. Head xác nhận.
3. **Kết toán cuối tháng**: cron tự chạy. Nếu còn thiếu → trừ vào quỹ phép năm.

> Trước ngày 25 mỗi tháng, hệ thống gửi cảnh báo nếu còn nợ giờ.

## 7. Duyệt đơn (Manager / Head)

Vào `Approvals`. Bấm vào đơn để xem chi tiết và lịch sử.

- **Approve**: duyệt. Nếu cần cấp 2, tự chuyển tiếp.
- **Reject**: bắt buộc ghi lý do.
- **Cancel Request**: xử lý ở cùng mục.

Head duyệt thêm **Flex Time Makeup** trong `Flex Time`.

## 8. Báo cáo

`Reports` có 3 khung:

- **Daily**: ai đang nghỉ hôm nay.
- **Weekly**: biểu đồ giờ nghỉ theo ngày.
- **Monthly**: tổng hợp phép + OT + flex theo nhân viên.

Có filter theo phòng ban (Head / Admin) và xuất CSV.

## 9. Quản trị (Admin)

- `Employees`: CRUD nhân viên, đổi role, đổi manager, reset mật khẩu.
- `Holidays`: cấu hình ngày lễ theo năm. Ảnh hưởng tính giờ + hệ số OT.
- `Friday Override`: cấu hình tuần nào thứ 6 làm như ngày thường (xem mục 9.5).
- Tạo nhân viên mới → hệ thống tự cấp 96h phép cho cycle hiện tại.

## 9.1. Đổi ca làm theo tuần

`Shift` cho phép xem lịch ca hiện tại và đăng ký đổi ca theo từng ngày trong tuần (T2–T6 có thể là ca A/B/C khác nhau).

1. **Đăng ký đổi ca**: chọn ngày hiệu lực và lịch ca mới cho 5 ngày trong tuần. Lý do (tuỳ chọn).
2. **Manager duyệt** (1 cấp): Manager của nhân viên duyệt qua tab "Chờ duyệt".
3. **Áp dụng**: khi duyệt, hệ thống đóng các dòng EmployeeWeekShift cũ (`endDate = effectiveDate − 1`) và tạo các dòng mới với `effectiveDate` tương ứng.
4. **Constraint**: mỗi nhân viên chỉ có 1 yêu cầu đang chờ duyệt tại 1 thời điểm.

## 9.2. OT Bank — quỹ giờ OT bù phép

OT đã duyệt được tích luỹ vào **OT bank** theo cycle (1/6 → 31/5 năm sau, grace 2 tháng đến 31/7 → tổng 14 tháng dùng được). Đơn vị: **phút** (không round 0.25h).

- Khi xin nghỉ phép và đơn được duyệt → hệ thống **tự động dùng OT bank trước**, ưu tiên cycle grace (sắp hết hạn), rồi đến cycle hiện tại, rồi mới trừ vào quỹ phép năm.
- Khi huỷ đơn nghỉ đã duyệt → restore lại OT bank.
- Cron `1/6` hàng năm tạo cycle mới + dọn các cycle quá hạn.

## 9.3. Chế độ thai sản

Áp dụng cho nhân viên nữ có **con dưới 1 tuổi**. Mỗi ngày được nghỉ sớm hoặc đi muộn 1 tiếng.

1. **Khai báo con**: vào `Maternity` → "Khai báo con" → nhập ngày sinh. Manager duyệt (1 cấp).
2. **Đăng ký nghỉ**: sau khi khai báo được duyệt, vào "Đăng ký nghỉ" → chọn ngày + chế độ (về sớm / đi muộn 1 tiếng). Manager duyệt từng đăng ký.
3. **Eligibility**: tự động hết hiệu lực khi con tròn 12 tháng.

## 9.4. Tài khoản cá nhân

Tại `Settings`:
- **Thông tin cá nhân**: tự sửa Họ tên, SĐT, Giới tính, Ngôn ngữ.
- **Đổi mật khẩu**: ≥ 8 ký tự, có cả chữ và số.
- **Email notifications**: bật/tắt nhận email.
- **Lần đầu đăng nhập**: bắt buộc đổi mật khẩu mặc định trước khi tiếp tục.

## 9.5. Tăng ca thứ 6 (Friday Override)

Khi công ty cần tăng cường làm việc, Admin hoặc Head có thể cấu hình **thứ 6 làm như ngày thường** (8h thay vì 7h).

1. **Thêm tuần tăng ca**: chọn ngày thứ 2 của tuần đó + ghi chú (tuỳ chọn).
2. **Ảnh hưởng**: mọi đơn nghỉ phép trong thứ 6 của tuần đó sẽ tính theo giờ weekday.
3. **Xoá**: có thể xoá tuần đã thêm nếu huỷ kế hoạch.

> Lưu ý: chỉ ảnh hưởng đơn nghỉ phép (tính giờ). Không ảnh hưởng OT / Flex.

## 10. FAQ

**Nghỉ nửa buổi sáng thì ghi thế nào?**
Tạo đơn với giờ bắt đầu = giờ vào ca, giờ kết thúc = 12:00 (nghỉ trưa).

**OT bank cycle cũ chưa dùng hết có mất không?**
Có grace period 2 tháng (đến 31/07 năm sau) để dùng OT đổi ngày nghỉ. Sau đó OT bank hết hạn.

**Quên Submit, sếp không thấy đơn?**
DRAFT chỉ mình bạn thấy. Mở đơn → `Submit`.

**Muốn huỷ đơn đã duyệt?**
Mở đơn → `Request Cancel`. Chờ Manager / Head duyệt.

**Flex Time khác nghỉ phép thế nào?**
Nghỉ phép = trừ quỹ. Flex = thiếu giờ tạm thời, phải bù trong tháng; nếu không bù kịp mới bị trừ phép khi kết toán.

**Manager tự xin nghỉ ai duyệt?**
Đơn chuyển thẳng Head.

**Không đăng nhập được?**
Liên hệ Admin reset mật khẩu.

**Filter đơn nghỉ phép hoạt động thế nào?**
Filter theo khoảng ngày sẽ hiện tất cả đơn có ngày nghỉ **chồng lấn** với khoảng đó. Ví dụ: filter 15-20/5 sẽ hiện đơn nghỉ 10-17/5 (chồng) nhưng không hiện đơn 10-14/5 (không chồng).

**Bonus thâm niên tính thế nào?**
Mỗi 5 năm được +8h (1 ngày). Mốc tính bắt đầu từ 01/06 của năm vào làm (có lợi cho nhân viên). Ví dụ: vào 15/03/2020 → mốc = 01/06/2019 → đến 01/06/2024 được +8h bonus.

---

*Tài liệu này cũng có sẵn dạng tương tác tại `/help` trong app.*
