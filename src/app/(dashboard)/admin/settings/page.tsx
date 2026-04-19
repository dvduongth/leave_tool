"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";

interface ConfigRow {
  key: string;
  value: number | string;
  type: "int" | "float" | "string";
  description: string;
  group: string;
  isDefault: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  leave: "adminSettings.groupLeave",
  ot: "adminSettings.groupOt",
  menstrual: "adminSettings.groupMenstrual",
};

export default function AdminSettingsPage() {
  const t = useT();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        const data: ConfigRow[] = await res.json();
        setRows(data);
        setDrafts(
          Object.fromEntries(data.map((r) => [r.key, String(r.value)]))
        );
      } else {
        toast.error(t("adminSettings.errLoad"));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: drafts[key] }),
      });
      if (res.ok) {
        toast.success(t("adminSettings.savedToast"));
        await load();
      } else {
        const data = await res.json();
        toast.error(data.error || t("adminSettings.saveFailedToast"));
      }
    } finally {
      setSaving(null);
    }
  }

  const grouped = rows.reduce<Record<string, ConfigRow[]>>((acc, r) => {
    (acc[r.group] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("adminSettings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("adminSettings.subtitle")}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{t(GROUP_LABELS[group] || group)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((row) => {
                const dirty = drafts[row.key] !== String(row.value);
                return (
                  <div key={row.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="font-mono text-xs">{row.key}</Label>
                      {row.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          {t("adminSettings.badgeDefault")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type={row.type === "string" ? "text" : "number"}
                        step={row.type === "float" ? "0.5" : "1"}
                        value={drafts[row.key] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [row.key]: e.target.value,
                          }))
                        }
                        className="max-w-[200px]"
                      />
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        disabled={!dirty || saving === row.key}
                        onClick={() => save(row.key)}
                      >
                        <Save className="size-4" data-icon="inline-start" />
                        {saving === row.key
                          ? t("common.saving")
                          : t("common.save")}
                      </Button>
                      {dirty && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDrafts((d) => ({
                              ...d,
                              [row.key]: String(row.value),
                            }))
                          }
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
