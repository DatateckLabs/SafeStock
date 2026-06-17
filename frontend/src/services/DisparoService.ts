import { api } from "./api";
import type { DisparoLog, DisparoResult } from "../types";

export class DisparoService {
  static async dispararInsumos(): Promise<DisparoResult> {
    const { data } = await api.post<DisparoResult>("/api/v1/disparos/insumos");
    return data;
  }

  static async dispararFerramentas(): Promise<DisparoResult> {
    const { data } = await api.post<DisparoResult>("/api/v1/disparos/ferramentas");
    return data;
  }

  static async getLog(modulo?: "insumos" | "ferramentas"): Promise<DisparoLog[]> {
    const params = modulo ? { modulo } : {};
    const { data } = await api.get<DisparoLog[]>("/api/v1/disparos/log", { params });
    return data;
  }
}
