import { api } from "./api";
import type { FerramentaResponse, DrilldownItem } from "../types";

export class FerramentasService {
  static async getAll(): Promise<FerramentaResponse[]> {
    const { data } = await api.get<FerramentaResponse[]>("/api/v1/ferramentas/");
    return data;
  }

  static async getDrilldown(cpd: string): Promise<DrilldownItem[]> {
    const { data } = await api.get<DrilldownItem[]>(`/api/v1/ferramentas/${cpd}/drilldown/`);
    return data;
  }
}
