import { api } from "./api";
import type { EstoqueMinimo } from "../types";

export class EstoquesMinimoService {
  static async getAll(): Promise<EstoqueMinimo[]> {
    const { data } = await api.get<EstoqueMinimo[]>("/api/v1/estoques-minimos/");
    return data;
  }

  static async upsert(
    cpd: string,
    payload: { estoque_minimo: number; estoque_maximo: number; observacao?: string }
  ): Promise<EstoqueMinimo> {
    const { data } = await api.put<EstoqueMinimo>(`/api/v1/estoques-minimos/${cpd}/`, payload);
    return data;
  }
}
