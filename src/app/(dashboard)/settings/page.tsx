"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const t = useT();
  const [email, setEmail] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/email-notif");
        if (res.ok) {
          const data = await res.json();
          setEmail(data.email);
          setEnabled(Boolean(data.enabled));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/user/email-notif", {
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
      toast.error(t("common.unexpectedError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            {t("settings.emailNotifTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">
                    {t("settings.emailNotifLabel")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("settings.emailNotifDesc").replace(
                      "{email}",
                      email || "—"
                    )}
                  </p>
                </div>
                <Button
                  variant={enabled ? "default" : "outline"}
                  onClick={() => toggle(!enabled)}
                  disabled={saving}
                >
                  {enabled ? t("settings.on") : t("settings.off")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.emailNotifHint")}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
