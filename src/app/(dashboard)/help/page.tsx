import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveLocale } from "@/lib/i18n/server";
import { messages, translate } from "@/lib/i18n";
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
import { HelpTranslator } from "@/components/help-translator";

type Role = "ADMIN" | "HEAD" | "MANAGER" | "EMPLOYEE";

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: Role; name: string } | undefined;
  const role: Role = user?.role ?? "EMPLOYEE";

  const locale = await resolveLocale();
  const t = (k: string) => translate(messages[locale], k);
  const roleLabel: Record<Role, string> = {
    ADMIN: t("help.role.admin"),
    HEAD: t("help.role.head"),
    MANAGER: t("help.role.manager"),
    EMPLOYEE: t("help.role.employee"),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BookOpen className="size-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("help.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("help.loggedInAs")}{" "}
            <Badge variant="secondary">{roleLabel[role]}</Badge>
          </p>
        </div>
      </div>

      <HelpTranslator>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview">{t("help.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="leave">{t("help.tabs.leave")}</TabsTrigger>
          <TabsTrigger value="ot">{t("help.tabs.ot")}</TabsTrigger>
          <TabsTrigger value="flex">{t("help.tabs.flex")}</TabsTrigger>
          <TabsTrigger value="wellness">{t("help.tabs.wellness")}</TabsTrigger>
          {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
            <TabsTrigger value="approve">{t("help.tabs.approve")}</TabsTrigger>
          )}
          {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
            <TabsTrigger value="reports">{t("help.tabs.reports")}</TabsTrigger>
          )}
          {role === "ADMIN" && <TabsTrigger value="admin">{t("help.tabs.admin")}</TabsTrigger>}
          <TabsTrigger value="faq">{t("help.tabs.faq")}</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-5" /> {t("help.overview.introTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>{t("help.overview.introDesc")}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <FeatureBox
                  icon={CalendarDays}
                  title={t("help.overview.featureLeaveTitle")}
                  text={t("help.overview.featureLeaveDesc")}
                />
                <FeatureBox
                  icon={Clock}
                  title={t("help.overview.featureOtTitle")}
                  text={t("help.overview.featureOtDesc")}
                />
                <FeatureBox
                  icon={Timer}
                  title={t("help.overview.featureFlexTitle")}
                  text={t("help.overview.featureFlexDesc")}
                />
                <FeatureBox
                  icon={CheckSquare}
                  title={t("help.overview.featureApproveTitle")}
                  text={t("help.overview.featureApproveDesc")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("help.overview.rolesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <RoleRow role="EMPLOYEE" desc={t("help.overview.roleEmployee")} />
              <RoleRow role="MANAGER" desc={t("help.overview.roleManager")} />
              <RoleRow role="HEAD" desc={t("help.overview.roleHead")} />
              <RoleRow role="ADMIN" desc={t("help.overview.roleAdmin")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("help.overview.conceptsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Concept term={t("help.overview.conceptCycle")} desc={t("help.overview.conceptCycleDesc")} />
              <Concept term={t("help.overview.conceptGrace")} desc={t("help.overview.conceptGraceDesc")} />
              <Concept term={t("help.overview.conceptSeniority")} desc={t("help.overview.conceptSeniorityDesc")} />
              <Concept term={t("help.overview.conceptShift")} desc={t("help.overview.conceptShiftDesc")} />
              <Concept term={t("help.overview.conceptValidHours")} desc={t("help.overview.conceptValidHoursDesc")} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEAVE */}
        <TabsContent value="leave" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5" /> {t("help.leave.processTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Step n={1} title={t("help.leave.step1Title")}>{t("help.leave.step1Desc")}</Step>
              <Step n={2} title={t("help.leave.step2Title")}>{t("help.leave.step2Desc")}</Step>
              <Step n={3} title={t("help.leave.step3Title")}>{t("help.leave.step3Desc")}</Step>
              <Step n={4} title={t("help.leave.step4Title")}>{t("help.leave.step4Desc")}</Step>
              <Step n={5} title={t("help.leave.step5Title")}>{t("help.leave.step5Desc")}</Step>

              <div className="mt-4 rounded-md border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-500 mt-0.5" />
                  <div>{t("help.leave.cancelNote")}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("help.leave.statusTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <StatusRow label="DRAFT" desc={t("help.leave.statusDraft")} />
              <StatusRow label="PENDING_MANAGER" desc={t("help.leave.statusPendingManager")} />
              <StatusRow label="PENDING_HEAD" desc={t("help.leave.statusPendingHead")} />
              <StatusRow label="APPROVED" desc={t("help.leave.statusApproved")} />
              <StatusRow label="REJECTED" desc={t("help.leave.statusRejected")} />
              <StatusRow label="CANCEL_PENDING" desc={t("help.leave.statusCancelPending")} />
              <StatusRow label="CANCELLED" desc={t("help.leave.statusCancelled")} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* OT */}
        <TabsContent value="ot" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" /> {t("help.ot.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{t("help.ot.desc")}</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>{t("help.ot.rateWeekday")}</li>
                <li>{t("help.ot.rateWeekend")}</li>
                <li>{t("help.ot.rateHoliday")}</li>
              </ul>
              <p>{t("help.ot.convertNote")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FLEX TIME */}
        <TabsContent value="flex" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="size-5" /> {t("help.flex.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{t("help.flex.desc")}</p>
              <Step n={1} title={t("help.flex.step1Title")}>{t("help.flex.step1Desc")}</Step>
              <Step n={2} title={t("help.flex.step2Title")}>{t("help.flex.step2Desc")}</Step>
              <Step n={3} title={t("help.flex.step3Title")}>{t("help.flex.step3Desc")}</Step>
              <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5" />
                  <div>{t("help.flex.warningNote")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WELLNESS */}
        <TabsContent value="wellness" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" /> {t("help.wellness.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{t("help.wellness.desc")}</p>
              <Step n={1} title={t("help.wellness.step1Title")}>{t("help.wellness.step1Desc")}</Step>
              <ul className="ml-10 list-disc space-y-1">
                <li>{t("help.wellness.modeShort")}</li>
                <li>{t("help.wellness.modeMedium")}</li>
                <li>{t("help.wellness.modeLong")}</li>
              </ul>
              <Step n={2} title={t("help.wellness.step2Title")}>{t("help.wellness.step2Desc")}</Step>
              <Step n={3} title={t("help.wellness.step3Title")}>{t("help.wellness.step3Desc")}</Step>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-primary mt-0.5" />
                  <div>{t("help.wellness.note")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPROVE */}
        {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
          <TabsContent value="approve" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="size-5" /> {t("help.approve.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{t("help.approve.desc")}</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{t("help.approve.item1")}</li>
                  <li>{t("help.approve.item2")}</li>
                  <li>{t("help.approve.item3")}</li>
                  <li>{t("help.approve.item4")}</li>
                </ul>
                {role !== "MANAGER" && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    {t("help.approve.headNote")}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* REPORTS */}
        {(role === "MANAGER" || role === "HEAD" || role === "ADMIN") && (
          <TabsContent value="reports" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5" /> {t("help.reports.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{t("help.reports.desc")}</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{t("help.reports.daily")}</li>
                  <li>{t("help.reports.weekly")}</li>
                  <li>{t("help.reports.monthly")}</li>
                </ul>
                <p>{t("help.reports.filterNote")}</p>
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
                  <Users className="size-5" /> {t("help.admin.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="ml-4 list-disc space-y-2">
                  <li>{t("help.admin.itemEmployees")}</li>
                  <li>{t("help.admin.itemHolidays")}</li>
                  <li>{t("help.admin.itemFridayOverride")}</li>
                  <li>{t("help.admin.newEmployeeNote")}</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("help.faq.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Faq q={t("help.faq.q1")}>{t("help.faq.a1")}</Faq>
              <Faq q={t("help.faq.q2")}>{t("help.faq.a2")}</Faq>
              <Faq q={t("help.faq.q3")}>{t("help.faq.a3")}</Faq>
              <Faq q={t("help.faq.q4")}>{t("help.faq.a4")}</Faq>
              <Faq q={t("help.faq.q5")}>{t("help.faq.a5")}</Faq>
              <Faq q={t("help.faq.q6")}>{t("help.faq.a6")}</Faq>
              <Faq q={t("help.faq.q7")}>{t("help.faq.a7")}</Faq>
              <Faq q={t("help.faq.q8")}>{t("help.faq.a8")}</Faq>
              <Faq q={t("help.faq.q9")}>{t("help.faq.a9")}</Faq>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" /> {t("help.faq.supportTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>{t("help.faq.supportDesc")}</p>
              <ul className="ml-4 list-disc">
                <li>{t("help.faq.supportAdmin")}</li>
                <li>{t("help.faq.supportHead")}</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </HelpTranslator>
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
