import { api } from "./api";
import type { ConfigFerramenta } from "../types";

export class ConfigFerramentaService {
  static async getAll(): Promise<ConfigFerramenta[]> {
    const { data } = await api.get<ConfigFerramenta[]>("/api/v1/config-ferramentas/");
    return data;
  }

  static async upsert(
    cpd_ferramenta: string,
    payload: { aplicacoes: number; leadtime_override: number | null },
  ): Promise<ConfigFerramenta> {
    const { data } = await api.put<ConfigFerramenta>(
      `/api/v1/config-ferramentas/${cpd_ferramenta}/`,
      payload,
    );
    return data;
  }

  static async deletar(cpd_ferramenta: string): Promise<void> {
    await api.delete(`/api/v1/config-ferramentas/${cpd_ferramenta}/`);
  }
}
