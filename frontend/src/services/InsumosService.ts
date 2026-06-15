import { api } from "./api";
import type { InsumoResponse, EstoqueMinimo } from "../types";

export class InsumosService {
  static async getAll(): Promise<InsumoResponse[]> {
    const { data } = await api.get<InsumoResponse[]>("/api/v1/insumos/");
    return data;
  }

  static async updateEstoque(
    cpd: string,
    payload: { estoque_minimo: number; estoque_maximo: number; observacao?: string }
  ): Promise<EstoqueMinimo> {
    const { data } = await api.put<EstoqueMinimo>(`/api/v1/insumos/${cpd}/estoque/`, payload);
    return data;
  }
}
