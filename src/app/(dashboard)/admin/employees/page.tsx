"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  workShift: string;
  departmentId: string;
  managerId: string | null;
  department: { id: string; name: string };
  manager: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

const ROLES = ["EMPLOYEE", "MANAGER", "HEAD", "ADMIN"];
const SHIFTS = ["A", "B", "C"];

export default function AdminEmployeesPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("EMPLOYEE");
  const [formShift, setFormShift] = useState("A");
  const [formDepartment, setFormDepartment] = useState("");
  const [formManager, setFormManager] = useState("");

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/employees");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      } else {
        toast.error(t("admin.employees.errLoadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/employees?departmentId=_list");
      // Fallback: get departments from employee list
      // Actually we need a departments endpoint; for now extract unique ones
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (role === "ADMIN") {
      fetchEmployees();
    }
  }, [role, fetchEmployees]);

  useEffect(() => {
    // Extract departments and potential managers from employee list
    const deptMap = new Map<string, string>();
    const mgrs: { id: string; name: string }[] = [];
    for (const emp of employees) {
      if (emp.department) {
        deptMap.set(emp.department.id, emp.department.name);
      }
      if (emp.role === "MANAGER" || emp.role === "HEAD") {
        mgrs.push({ id: emp.id, name: emp.name });
      }
    }
    setDepartments(
      Array.from(deptMap.entries()).map(([id, name]) => ({ id, name }))
    );
    setManagers(mgrs);
  }, [employees]);

  function openAddDialog() {
    setEditingEmployee(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("EMPLOYEE");
    setFormShift("A");
    setFormDepartment("");
    setFormManager("");
    setDialogOpen(true);
  }

  function openEditDialog(emp: Employee) {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormEmail(emp.email);
    setFormPassword("");
    setFormRole(emp.role);
    setFormShift(emp.workShift);
    setFormDepartment(emp.departmentId);
    setFormManager(emp.managerId || "");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingEmployee) {
        // Update
        const body: Record<string, unknown> = {
          name: formName,
          email: formEmail,
          role: formRole,
          workShift: formShift,
          departmentId: formDepartment,
          managerId: formManager || null,
        };
        if (formPassword) body.password = formPassword;

        const res = await fetch(
          `/api/admin/employees/${editingEmployee.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (res.ok) {
          toast.success(t("admin.employees.toastUpdated"));
          setDialogOpen(false);
          fetchEmployees();
        } else {
          const data = await res.json();
          toast.error(data.error || t("admin.employees.errUpdate"));
        }
      } else {
        // Create
        if (!formPassword) {
          toast.error(t("admin.employees.errPasswordRequired"));
          setSubmitting(false);
          return;
        }
        if (!formDepartment) {
          toast.error(t("admin.employees.errDepartmentRequired"));
          setSubmitting(false);
          return;
        }

        const res = await fetch("/api/admin/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            password: formPassword,
            role: formRole,
            workShift: formShift,
            departmentId: formDepartment,
            managerId: formManager || null,
          }),
        });
        if (res.ok) {
          toast.success(t("admin.employees.toastCreated"));
          setDialogOpen(false);
          fetchEmployees();
        } else {
          const data = await res.json();
          toast.error(data.error || t("admin.employees.errCreate"));
        }
      }
    } catch {
      toast.error(t("common.unexpectedError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingEmployee) return;
    const ok = window.confirm(
      t("admin.employees.confirmDelete").replace("{name}", editingEmployee.name)
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/employees/${editingEmployee.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("admin.employees.toastDeleted"));
        setDialogOpen(false);
        fetchEmployees();
      } else {
        const data = await res.json();
        toast.error(data.error || t("admin.employees.errDelete"));
      }
    } catch {
      toast.error(t("admin.employees.errDeleteGeneric"));
    } finally {
      setDeleting(false);
    }
  }

  if (role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lg text-muted-foreground">{t("common.accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.employees.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.employees.subtitle")}
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="size-4" data-icon="inline-start" />
          {t("admin.employees.add")}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.employees.colName")}</TableHead>
              <TableHead>{t("admin.employees.colEmail")}</TableHead>
              <TableHead>{t("admin.employees.colRole")}</TableHead>
              <TableHead>{t("admin.employees.colDepartment")}</TableHead>
              <TableHead>{t("admin.employees.colShift")}</TableHead>
              <TableHead>{t("admin.employees.colManager")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("admin.employees.empty")}
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEditDialog(emp)}
                >
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.role}</TableCell>
                  <TableCell>{emp.department?.name ?? "-"}</TableCell>
                  <TableCell>{emp.workShift}</TableCell>
                  <TableCell>{emp.manager?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Pencil className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? t("admin.employees.editTitle") : t("admin.employees.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? t("admin.employees.editDesc")
                : t("admin.employees.addDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-name">{t("admin.employees.name")}</Label>
              <Input
                id="emp-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">{t("admin.employees.email")}</Label>
              <Input
                id="emp-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-password">
                {t("admin.employees.password")}{editingEmployee ? t("admin.employees.passwordKeepHint") : ""}
              </Label>
              <Input
                id="emp-password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required={!editingEmployee}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.employees.role")}</Label>
                <Select value={formRole} onValueChange={(val) => setFormRole(val as string)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.employees.shift")}</Label>
                <Select value={formShift} onValueChange={(val) => setFormShift(val as string)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t("admin.employees.shiftValue").replace("{s}", s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.employees.department")}</Label>
              <Select value={formDepartment} onValueChange={(val) => setFormDepartment(val as string)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.employees.selectDepartment")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.employees.managerOptional")}</Label>
              <Select value={formManager} onValueChange={(val) => setFormManager(val as string)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.employees.noManager")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("common.none")}</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
              {editingEmployee ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting || submitting}
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  {deleting ? t("admin.employees.deleting") : t("common.delete")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={submitting || deleting}>
                {submitting
                  ? t("common.saving")
                  : editingEmployee
                    ? t("common.update")
                    : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
