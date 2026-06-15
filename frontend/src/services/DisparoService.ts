import { api } from "./api";
import type { DisparoLog, DisparoResult } from "../types";

export class DisparoService {
  static async dispararInsumos(): Promise<DisparoResult> {
    const { data } = await api.post<DisparoResult>("/api/v1/disparos/insumos");
    return data;
  }

  static async getLog(): Promise<DisparoLog[]> {
    const { data } = await api.get<DisparoLog[]>("/api/v1/disparos/log");
    return data;
  }
}
