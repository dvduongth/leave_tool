import useSWR, { preload } from "swr";
import { fetcher } from "./fetcher";

export const preloadDashboard = () => preload("/api/dashboard", fetcher);
export const preloadLeaves = () => preload("/api/leaves", fetcher);
export const preloadLeaveBalance = () => preload("/api/leaves/balance", fetcher);
export const preloadOT = () => preload("/api/ot", fetcher);
export const preloadFlexTime = () => preload("/api/flex-time", fetcher);
export const preloadReports = (type: string) => preload(`/api/reports?type=${type}`, fetcher);
export const preloadWellness = () => preload("/api/menstrual-leave", fetcher);

export function useDashboard() {
  return useSWR("/api/dashboard", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30000,
  });
}

export function useLeaves(params?: { status?: string; from?: string; to?: string; employeeId?: string; scope?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.employeeId) searchParams.set("employeeId", params.employeeId);
  if (params?.scope) searchParams.set("scope", params.scope);
  const query = searchParams.toString();
  const url = query ? `/api/leaves?${query}` : "/api/leaves";

  return useSWR(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
}

export function useLeaveBalance() {
  return useSWR("/api/leaves/balance", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function useTeamMembers() {
  return useSWR("/api/team-members", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });
}

export function useOT(params?: { month?: string; employeeId?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.month) searchParams.set("month", params.month);
  if (params?.employeeId) searchParams.set("employeeId", params.employeeId);
  const query = searchParams.toString();
  const url = query ? `/api/ot?${query}` : "/api/ot";

  return useSWR(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
}

export function useOTBalance() {
  return useSWR("/api/ot/balance", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function useFlexTime(params?: { month?: string; employeeId?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.month) searchParams.set("month", params.month);
  if (params?.employeeId) searchParams.set("employeeId", params.employeeId);
  const query = searchParams.toString();
  const url = query ? `/api/flex-time?${query}` : "/api/flex-time";

  return useSWR(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
}

export function useFlexSummary(params?: { month?: string; employeeId?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.month) searchParams.set("month", params.month);
  if (params?.employeeId) searchParams.set("employeeId", params.employeeId);
  const query = searchParams.toString();
  const url = query ? `/api/flex-time/summary?${query}` : "/api/flex-time/summary";

  return useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
}

export function useReports(params: { type: string; date?: string; departmentId?: string }) {
  const searchParams = new URLSearchParams();
  searchParams.set("type", params.type);
  if (params.date) searchParams.set("date", params.date);
  if (params.departmentId) searchParams.set("departmentId", params.departmentId);
  const url = `/api/reports?${searchParams.toString()}`;

  return useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function useApprovals(status: string) {
  return useSWR(`/api/leaves?status=${status}`, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
}

export function useWellness(month?: string) {
  const url = month ? `/api/menstrual-leave?month=${month}` : "/api/menstrual-leave";
  return useSWR(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
}
