import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Timer,
  CheckSquare,
  BarChart3,
  Users,
  ShieldCheck,
  AlertTriangle,
  Info,
} from "lucide-react";

type Role = "ADMIN" | "HEAD" | "MANAGER" | "EMPLOYEE";

const roleLabel: Record<Role, string> = {
  ADMIN: "Quản trị hệ thống",
  HEAD: "Trưởng bộ phận",
  MANAGER: "Quản lý trực tiếp",
  EMPLOYEE: "Nhân viên",
};

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: Role; name: string } | undefined;
  const role: Role = user?.role ?? "EMPLOYEE";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BookOpen className="size-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Hướng dẫn sử dụng</h1>
          <p className="text-sm text-muted-foreground">
            Bạn đang đăng nhập với vai trò{" "}
            <Badge variant="secondary">{roleLabel[role]}</Badge>
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="leave">Xin nghỉ phép</TabsTrigger>
          <TabsTrigger value="ot">Ghi OT</TabsTrigger>
          <TabsTrigger value="flex">Flex Time</TabsTrigger>
          {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
            <TabsTrigger value="approve">Duyệt đơn</TabsTrigger>
          )}
          {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
            <TabsTrigger value="reports">Báo cáo</TabsTrigger>
          )}
          {role === "ADMIN" && <TabsTrigger value="admin">Quản trị</TabsTrigger>}
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        {/* TỔNG QUAN */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-5" /> Giới thiệu hệ thống
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>
                <b>Leave Manager</b> là hệ thống quản lý nghỉ phép, OT (làm thêm
                giờ) và Flex Time (bù giờ thiếu). Mục tiêu: số hoá toàn bộ quy
                trình xin nghỉ – duyệt – bù giờ, giảm giấy tờ, minh bạch quỹ
                phép.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <FeatureBox
                  icon={CalendarDays}
                  title="Nghỉ phép"
                  text="Xin phép năm, phép không lương; duyệt 2 cấp; có grace period 2 tháng"
                />
                <FeatureBox
                  icon={Clock}
                  title="OT"
                  text="Ghi lại giờ làm thêm ngày thường / cuối tuần / lễ với hệ số lương tương ứng"
                />
                <FeatureBox
                  icon={Timer}
                  title="Flex Time"
                  text="Theo dõi giờ thiếu trong tháng và giờ bù; tự động kết toán cuối tháng"
                />
                <FeatureBox
                  icon={CheckSquare}
                  title="Duyệt đơn"
                  text="Manager duyệt cấp 1, Head duyệt cấp 2 (nếu có)"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vai trò trong hệ thống</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <RoleRow
                role="EMPLOYEE"
                desc="Nhân viên: xin nghỉ, ghi OT, ghi Flex Time, xem báo cáo cá nhân."
              />
              <RoleRow
                role="MANAGER"
                desc="Quản lý trực tiếp: duyệt cấp 1 đơn của nhân viên trong team."
              />
              <RoleRow
                role="HEAD"
                desc="Trưởng bộ phận: duyệt cấp 2, duyệt Flex Time, xem báo cáo toàn phòng."
              />
              <RoleRow
                role="ADMIN"
                desc="Quản trị: CRUD nhân viên, ngày lễ, xem tất cả báo cáo."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Khái niệm cần biết</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Concept
                term="Chu kỳ phép (Cycle)"
                desc="Chu kỳ phép năm từ 01/06 → 31/05 năm sau. Mỗi nhân viên được cấp 96 giờ (12 ngày)."
              />
              <Concept
                term="Grace period"
                desc="2 tháng sau khi kết thúc chu kỳ (đến 31/07), vẫn được dùng phép của chu kỳ cũ nếu chưa hết."
              />
              <Concept
                term="Ca làm việc (Shift)"
                desc="A (7:00-17:00), B (7:30-17:30), C (9:00-19:00). Thứ 6 nghỉ sớm 1 giờ."
              />
              <Concept
                term="Giờ nghỉ hợp lệ"
                desc="Chỉ tính trong giờ hành chính của ca, trừ 1 giờ nghỉ trưa. Không tính cuối tuần, ngày lễ."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* XIN NGHỈ PHÉP */}
        <TabsContent value="leave" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5" /> Quy trình xin nghỉ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Step n={1} title="Tạo đơn nghỉ">
                Vào <b>My Leaves → New Leave</b>. Chọn loại (Có lương / Không
                lương), thời gian bắt đầu, số giờ xin nghỉ. Hệ thống tự tính giờ
                kết thúc theo ca làm việc.
              </Step>
              <Step n={2} title="Lưu nháp hoặc gửi duyệt">
                Có thể lưu <i>Draft</i> để chỉnh sửa sau, hoặc gửi thẳng{" "}
                <b>Submit</b> để chuyển sang trạng thái chờ duyệt.
              </Step>
              <Step n={3} title="Duyệt cấp 1 (Manager)">
                Manager sẽ nhận thông báo. Nếu đơn ≤ 8 giờ và Manager OK thì
                duyệt xong. Nếu &gt; 8 giờ hoặc Manager là bạn → chuyển tiếp cấp
                2.
              </Step>
              <Step n={4} title="Duyệt cấp 2 (Head)">
                Áp dụng với đơn dài &gt; 8 giờ hoặc người xin là Manager/Head.
              </Step>
              <Step n={5} title="Đã duyệt / Từ chối">
                Nếu được duyệt, giờ phép tự trừ vào quỹ. Nếu bị từ chối, có thể
                sửa và gửi lại.
              </Step>

              <div className="mt-4 rounded-md border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-500 mt-0.5" />
                  <div>
                    <b>Huỷ đơn đã duyệt:</b> chỉ có thể yêu cầu huỷ (Cancel
                    Request) và cần Manager/Head duyệt lại.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trạng thái đơn</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <StatusRow label="DRAFT" desc="Nháp — chưa gửi" />
              <StatusRow label="PENDING_MANAGER" desc="Chờ Manager duyệt" />
              <StatusRow label="PENDING_HEAD" desc="Chờ Head duyệt" />
              <StatusRow label="APPROVED" desc="Đã duyệt, giờ đã trừ quỹ" />
              <StatusRow label="REJECTED" desc="Bị từ chối" />
              <StatusRow label="CANCEL_PENDING" desc="Đang xin huỷ" />
              <StatusRow label="CANCELLED" desc="Đã huỷ (hoàn giờ phép)" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* OT */}
        <TabsContent value="ot" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" /> Ghi OT (Overtime)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Vào <b>OT Records</b> → <b>Record OT</b>. Nhập ngày, giờ bắt
                đầu – kết thúc, lý do. Hệ thống tự tính hệ số:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <b>Ngày thường (x1.5)</b>: sau giờ tan ca hành chính
                </li>
                <li>
                  <b>Cuối tuần (x2.0)</b>: Thứ 7, Chủ nhật
                </li>
                <li>
                  <b>Ngày lễ (x3.0)</b>: trùng danh sách holidays
                </li>
              </ul>
              <p>
                Bản ghi OT dùng cho báo cáo lương; không trừ/cộng vào quỹ phép.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FLEX TIME */}
        <TabsContent value="flex" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="size-5" /> Flex Time (Bù giờ)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Flex Time dùng cho các trường hợp <b>thiếu giờ</b> trong tháng
                (đi trễ, về sớm, việc riêng &lt; 4h…) mà <i>không trừ phép</i>.
                Nhân viên cần <b>bù lại</b> số giờ thiếu này trong cùng tháng.
              </p>
              <Step n={1} title="Ghi Deficit (thiếu giờ)">
                Vào <b>Flex Time</b> → <b>Record Deficit</b>. Ghi rõ ngày, số
                giờ thiếu, lý do.
              </Step>
              <Step n={2} title="Ghi Makeup (bù giờ)">
                Khi đã làm bù → <b>Record Makeup</b>. Head sẽ xác nhận.
              </Step>
              <Step n={3} title="Kết toán cuối tháng">
                Vào ngày cuối tháng, hệ thống tự chạy cron kết toán: nếu còn
                <i> thiếu giờ chưa bù</i>, phần đó <b>trừ vào quỹ phép năm</b>.
              </Step>
              <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5" />
                  <div>
                    Trước ngày 25 hàng tháng, hệ thống gửi cảnh báo nếu bạn còn
                    nợ giờ.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DUYỆT ĐƠN */}
        {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
          <TabsContent value="approve" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="size-5" /> Duyệt đơn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Vào mục <b>Approvals</b> để xem danh sách đơn chờ duyệt thuộc
                  quyền bạn.
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Bấm vào đơn để xem chi tiết + lịch sử.</li>
                  <li>
                    <b>Approve</b> để duyệt. Nếu cần cấp 2, đơn sẽ tự chuyển
                    tiếp.
                  </li>
                  <li>
                    <b>Reject</b> bắt buộc ghi lý do. Nhân viên sẽ nhận thông
                    báo.
                  </li>
                  <li>
                    Đơn <b>Cancel Request</b> (xin huỷ đơn đã duyệt) cũng hiện ở
                    đây.
                  </li>
                </ul>
                {role !== "MANAGER" && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    Head còn duyệt thêm các <b>Flex Time Makeup</b> của nhân
                    viên trong phòng.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* BÁO CÁO */}
        {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
          <TabsContent value="reports" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5" /> Báo cáo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Mục <b>Reports</b> cung cấp 3 khung thời gian:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    <b>Daily</b>: ai đang nghỉ hôm nay
                  </li>
                  <li>
                    <b>Weekly</b>: biểu đồ số giờ nghỉ theo ngày
                  </li>
                  <li>
                    <b>Monthly</b>: tổng hợp phép, OT, flex theo nhân viên
                  </li>
                </ul>
                <p>Có thể lọc theo phòng ban (với Head/Admin) và xuất CSV.</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ADMIN */}
        {role === "ADMIN" && (
          <TabsContent value="admin" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" /> Quản trị
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="ml-4 list-disc space-y-2">
                  <li>
                    <b>Employees</b>: thêm/sửa/xoá nhân viên, đổi role, đổi
                    manager, reset mật khẩu.
                  </li>
                  <li>
                    <b>Holidays</b>: cấu hình ngày lễ theo năm. Ảnh hưởng tới
                    tính giờ nghỉ & hệ số OT.
                  </li>
                  <li>
                    Khi tạo nhân viên mới, hệ thống tự cấp quỹ phép 96 giờ cho
                    chu kỳ hiện tại.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Câu hỏi thường gặp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Faq q="Tôi nghỉ nửa buổi sáng thì ghi thế nào?">
                Tạo đơn nghỉ phép, nhập giờ bắt đầu = giờ vào ca, số giờ = 4.
                Hệ thống tự tính giờ kết thúc.
              </Faq>
              <Faq q="Phép chu kỳ cũ tôi chưa dùng hết có mất không?">
                Bạn còn 2 tháng grace period (đến 31/07 năm sau). Sau đó phần
                chưa dùng bị xoá.
              </Faq>
              <Faq q="Tôi quên bấm Submit, sếp không thấy đơn?">
                Đơn DRAFT chỉ mình bạn thấy. Vào chi tiết đơn → <b>Submit</b>{" "}
                để gửi duyệt.
              </Faq>
              <Faq q="Tôi đổi ý muốn huỷ đơn đã duyệt?">
                Mở đơn đã duyệt → <b>Request Cancel</b>. Manager/Head sẽ duyệt
                lại. Nếu OK, giờ phép sẽ được hoàn.
              </Faq>
              <Faq q="Flex Time khác nghỉ phép như thế nào?">
                Nghỉ phép = trừ quỹ phép năm. Flex = thiếu giờ tạm thời, phải
                bù trong tháng, nếu không bù kịp mới bị trừ phép khi kết toán
                cuối tháng.
              </Faq>
              <Faq q="Tôi là Manager, tự xin nghỉ thì ai duyệt?">
                Đơn của bạn sẽ chuyển thẳng lên Head duyệt (không tự duyệt
                được).
              </Faq>
              <Faq q="Không đăng nhập được?">
                Dùng đúng email công ty + mật khẩu. Nếu quên, liên hệ Admin
                reset.
              </Faq>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" /> Hỗ trợ
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Khi cần hỗ trợ, liên hệ:</p>
              <ul className="ml-4 list-disc">
                <li>Quản trị hệ thống (Admin) qua email nội bộ</li>
                <li>Trưởng bộ phận (Head) cho các vấn đề duyệt đơn</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeatureBox({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border p-3">
      <Icon className="size-5 text-primary shrink-0 mt-0.5" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}

function RoleRow({ role, desc }: { role: Role; desc: string }) {
  return (
    <div className="flex gap-3">
      <Badge variant="outline" className="shrink-0 min-w-20 justify-center">
        {role}
      </Badge>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}

function Concept({ term, desc }: { term: string; desc: string }) {
  return (
    <div>
      <div className="font-medium">{term}</div>
      <div className="text-muted-foreground">{desc}</div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function StatusRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="font-mono text-xs">
        {label}
      </Badge>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium">{q}</div>
      <div className="text-muted-foreground mt-1">{children}</div>
    </div>
  );
}
