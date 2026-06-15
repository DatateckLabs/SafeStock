import { api } from "./api";
import type { FerramentaResponse, DrilldownItem, ConsumoMensalItem, SemFerramentaItem } from "../types";

export class FerramentasService {
  static async getAll(): Promise<FerramentaResponse[]> {
    const { data } = await api.get<FerramentaResponse[]>("/api/v1/ferramentas/");
    return data;
  }

  static async getDrilldown(cpd: string): Promise<DrilldownItem[]> {
    const { data } = await api.get<DrilldownItem[]>(`/api/v1/ferramentas/${cpd}/drilldown/`);
    return data;
  }

  static async getConsumoMensal(cpd: string): Promise<ConsumoMensalItem[]> {
    const { data } = await api.get<ConsumoMensalItem[]>(`/api/v1/ferramentas/${cpd}/consumo-mensal/`);
    return data;
  }

  static async getConsumoMensalTerminal(cpd: string): Promise<ConsumoMensalItem[]> {
    const { data } = await api.get<ConsumoMensalItem[]>(`/api/v1/ferramentas/terminais/${cpd}/consumo-mensal/`);
    return data;
  }

  static async getSemFerramenta(): Promise<SemFerramentaItem[]> {
    const { data } = await api.get<SemFerramentaItem[]>("/api/v1/ferramentas/sem-ferramenta/");
    return data;
  }
}
