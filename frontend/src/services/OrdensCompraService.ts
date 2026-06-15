import { api } from "./api";
import type { GerarOCResponse, OrdemCompraGerada } from "../types";

interface OrdensCompraListResponse {
  locais: OrdemCompraGerada[];
  historico_bq: Record<string, unknown>[];
}

export class OrdensCompraService {
  static async getAll(): Promise<OrdensCompraListResponse> {
    const { data } = await api.get<OrdensCompraListResponse>("/api/v1/ordens-compra/");
    return data;
  }

  static async gerarInsumos(): Promise<GerarOCResponse> {
    const { data } = await api.post<GerarOCResponse>("/api/v1/ordens-compra/gerar-insumos/");
    return data;
  }

  static async gerarFerramentas(): Promise<GerarOCResponse> {
    const { data } = await api.post<GerarOCResponse>("/api/v1/ordens-compra/gerar-ferramentas/");
    return data;
  }
}
