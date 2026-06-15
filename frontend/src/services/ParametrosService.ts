import { api } from "./api";
import type { ParametroGlobal } from "../types";

export class ParametrosService {
  static async getAll(): Promise<ParametroGlobal[]> {
    const { data } = await api.get<ParametroGlobal[]>("/api/v1/parametros-globais/");
    return data;
  }

  static async update(chave: string, valor: string): Promise<ParametroGlobal> {
    const { data } = await api.put<ParametroGlobal>(`/api/v1/parametros-globais/${chave}/`, { valor });
    return data;
  }
}
