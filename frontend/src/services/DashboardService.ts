import { api } from "./api";
import type { DashboardStats } from "../types";

export class DashboardService {
  static async getStats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>("/api/v1/dashboard/stats/");
    return data;
  }
}
