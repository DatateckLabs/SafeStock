import { api } from "./api";
import type { CriticidadeFerramenta } from "../types";

export class CriticidadesService {
  static async getAll(): Promise<CriticidadeFerramenta[]> {
    const { data } = await api.get<CriticidadeFerramenta[]>("/api/v1/criticidades-ferramentas/");
    return data;
  }

  static async upsert(
    cpd: string,
    payload: {
      criticidade: "alta" | "media" | "baixa";
      janela_consumo_dias?: number | null;
      threshold_inatividade?: number | null;
      observacao?: string;
    }
  ): Promise<CriticidadeFerramenta> {
    const { data } = await api.put<CriticidadeFerramenta>(
      `/api/v1/criticidades-ferramentas/${cpd}/`,
      payload
    );
    return data;
  }
}
