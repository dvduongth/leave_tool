# Hướng dẫn sử dụng Leave Manager

> Phiên bản offline của trang `/help` trong app. Xem trực tiếp trong app sau khi đăng nhập để có trải nghiệm tương tác tốt hơn.

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Vai trò](#2-vai-trò)
3. [Khái niệm](#3-khái-niệm)
4. [Xin nghỉ phép](#4-xin-nghỉ-phép)
5. [Ghi OT](#5-ghi-ot)
6. [Flex Time](#6-flex-time)
7. [Duyệt đơn](#7-duyệt-đơn-manager--head)
8. [Báo cáo](#8-báo-cáo)
9. [Quản trị](#9-quản-trị-admin)
10. [FAQ](#10-faq)

---

## 1. Giới thiệu

**Leave Manager** số hoá toàn bộ quy trình xin nghỉ – duyệt – bù giờ. Các tính năng chính:

- **Nghỉ phép**: xin phép năm, phép không lương; duyệt 2 cấp; grace period 2 tháng.
- **OT**: ghi giờ làm thêm với hệ số theo loại ngày (thường / cuối tuần / lễ).
- **Flex Time**: theo dõi giờ thiếu và giờ bù, tự động kết toán cuối tháng.
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
- **Grace period**: 2 tháng sau cycle (đến 31/07) vẫn dùng được phép cũ.
- **Ca làm việc**:
  - A: 07:00–17:00 (thứ 6: 07:00–16:00)
  - B: 07:30–17:30 (thứ 6: 07:30–16:30)
  - C: 09:00–19:00 (thứ 6: 10:00–19:00)
- **Giờ nghỉ hợp lệ**: chỉ tính trong giờ hành chính, trừ 1 giờ nghỉ trưa. Không tính cuối tuần / lễ.

## 4. Xin nghỉ phép

### Quy trình

1. **Tạo đơn**: `My Leaves → New Leave`. Chọn loại, giờ bắt đầu, số giờ. Hệ thống tự tính giờ kết thúc.
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

`OT Records → Record OT`. Nhập ngày + giờ bắt đầu – kết thúc + lý do. Hệ số tự động:

- **Ngày thường**: x1.5 (sau giờ tan ca)
- **Cuối tuần**: x2.0
- **Ngày lễ**: x3.0

> OT dùng cho báo cáo lương. Không cộng / trừ vào quỹ phép.

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
- Tạo nhân viên mới → hệ thống tự cấp 96h phép cho cycle hiện tại.

## 10. FAQ

**Nghỉ nửa buổi sáng thì ghi thế nào?**
Tạo đơn, giờ bắt đầu = giờ vào ca, số giờ = 4.

**Phép cycle cũ chưa dùng hết có mất không?**
Grace period 2 tháng (đến 31/07 năm sau). Sau đó bị xoá.

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

---

*Tài liệu này cũng có sẵn dạng tương tác tại `/help` trong app.*
