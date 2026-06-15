import { api } from "./api";
import type { ConfigFornecedor } from "../types";

export class ConfigFornecedorService {
  static async getAll(): Promise<ConfigFornecedor[]> {
    const { data } = await api.get<ConfigFornecedor[]>("/api/v1/config-fornecedores/");
    return data;
  }

  static async upsert(
    razao_social: string,
    payload: { leadtime_meses: number; cobertura_meses: number },
  ): Promise<ConfigFornecedor> {
    const { data } = await api.put<ConfigFornecedor>(
      `/api/v1/config-fornecedores/${encodeURIComponent(razao_social)}/`,
      payload,
    );
    return data;
  }

  static async deletar(razao_social: string): Promise<void> {
    await api.delete(`/api/v1/config-fornecedores/${encodeURIComponent(razao_social)}/`);
  }

  static async getSugestoes(): Promise<string[]> {
    const { data } = await api.get<string[]>("/api/v1/config-fornecedores/sugestoes/");
    return data;
  }
}
