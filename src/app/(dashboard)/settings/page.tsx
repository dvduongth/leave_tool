"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, User, Lock, Eye, EyeOff } from "lucide-react";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";

interface MeProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  preferredLocale: string;
  role: string;
  joinDate: string | null;
  birthDate: string | null;
  mustChangePassword: boolean;
  emailNotifEnabled: boolean;
  department: { id: string; name: string } | null;
  manager: { id: string; name: string; email: string } | null;
}

export default function SettingsPage() {
  const t = useT();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED">("UNSPECIFIED");
  const [locale, setLocale] = useState("vi");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, notifRes] = await Promise.all([
          fetch("/api/user/me"),
          fetch("/api/user/email-notif"),
        ]);
        if (meRes.ok) {
          const me = (await meRes.json()) as MeProfile;
          setProfile(me);
          setName(me.name);
          setPhone(me.phone || "");
          setGender(me.gender);
          setLocale(me.preferredLocale);
        }
        if (notifRes.ok) {
          const data = await notifRes.json();
          setEnabled(Boolean(data.enabled));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetchWithRetry("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null, gender, preferredLocale: locale }),
      });
      if (res.ok) {
        toast.success("Cập nhật thông tin thành công");
        const fresh = await fetch("/api/user/me").then((r) => r.json());
        setProfile(fresh);
      } else {
        const d = await res.json();
        toast.error(d.error || "Cập nhật thất bại");
      }
    } catch {
      toast.error("Kết nối thất bại sau 3 lần thử, vui lòng thử lại");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPwd !== confirmPwd) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetchWithRetry("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      if (res.ok) {
        toast.success("Đổi mật khẩu thành công");
        setCurrentPwd("");
        setNewPwd("");
        setConfirmPwd("");
        setProfile(profile ? { ...profile, mustChangePassword: false } : null);
      } else {
        const d = await res.json();
        toast.error(d.error || "Đổi mật khẩu thất bại");
      }
    } catch {
      toast.error("Kết nối thất bại sau 3 lần thử, vui lòng thử lại");
    } finally {
      setSavingPwd(false);
    }
  }

  async function toggleNotif(next: boolean) {
    setSavingNotif(true);
    try {
      const res = await fetchWithRetry("/api/user/email-notif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        setEnabled(next);
        toast.success(t("settings.savedToast"));
      } else {
        toast.error(t("settings.saveFailedToast"));
      }
    } catch {
      toast.error("Kết nối thất bại sau 3 lần thử, vui lòng thử lại");
    } finally {
      setSavingNotif(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      {profile?.mustChangePassword && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠️ Bạn đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            Thông tin cá nhân
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Họ và tên</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Số điện thoại</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0xxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label>Giới tính</Label>
                  <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEMALE">Nữ</SelectItem>
                      <SelectItem value="MALE">Nam</SelectItem>
                      <SelectItem value="OTHER">Khác</SelectItem>
                      <SelectItem value="UNSPECIFIED">Chưa xác định</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ngôn ngữ</Label>
                  <Select value={locale} onValueChange={(v) => setLocale(v ?? "vi")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{profile?.email}</span></div>
                <div><span className="text-muted-foreground">Vai trò:</span> {profile?.role}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {profile?.department?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">Quản lý:</span> {profile?.manager?.name ?? "—"}</div>
                {profile?.joinDate && <div><span className="text-muted-foreground">Ngày vào:</span> {profile.joinDate.slice(0, 10)}</div>}
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Đang lưu..." : "Lưu thông tin"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Đổi mật khẩu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Mật khẩu hiện tại</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mật khẩu mới (≥ 8 ký tự, có chữ và số)</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Xác nhận mật khẩu mới</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}>
              {savingPwd ? "Đang đổi..." : "Đổi mật khẩu"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            {t("settings.emailNotifTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">{t("settings.emailNotifLabel")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("settings.emailNotifDesc").replace("{email}", profile?.email || "—")}
                  </p>
                </div>
                <Button
                  variant={enabled ? "default" : "outline"}
                  onClick={() => toggleNotif(!enabled)}
                  disabled={savingNotif}
                >
                  {enabled ? t("settings.on") : t("settings.off")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.emailNotifHint")}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
