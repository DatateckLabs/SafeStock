import { api } from "./api";
import type { GerarOCResponse, OrdemCompraGerada, PreviewOCResponse } from "../types";

interface OrdensCompraListResponse {
  locais: OrdemCompraGerada[];
  historico_bq: Record<string, unknown>[];
}

export class OrdensCompraService {
  static async getAll(): Promise<OrdensCompraListResponse> {
    const { data } = await api.get<OrdensCompraListResponse>("/api/v1/ordens-compra/");
    return data;
  }

  static async getPreviewInsumos(): Promise<PreviewOCResponse> {
    const { data } = await api.get<PreviewOCResponse>("/api/v1/ordens-compra/preview-insumos/");
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

  static async downloadExcelInsumos(): Promise<void> {
    const response = await api.get("/api/v1/ordens-compra/excel-insumos/", {
      responseType: "blob",
    });
    OrdensCompraService._triggerDownload(response, "OC_Insumos.xlsx");
  }

  static async getPreviewFerramentas(): Promise<PreviewOCResponse> {
    const { data } = await api.get<PreviewOCResponse>("/api/v1/ordens-compra/preview-ferramentas/");
    return data;
  }

  static async downloadExcelFerramentas(): Promise<void> {
    const response = await api.get("/api/v1/ordens-compra/excel-ferramentas/", {
      responseType: "blob",
    });
    OrdensCompraService._triggerDownload(response, "OC_Ferramentas.xlsx");
  }

  private static _triggerDownload(response: { data: unknown; headers: Record<string, unknown> }, fallbackName: string) {
    const url = URL.createObjectURL(new Blob([response.data as BlobPart]));
    const a = document.createElement("a");
    a.href = url;
    const disposition = response.headers["content-disposition"] as string | undefined;
    const match = disposition?.match(/filename="(.+?)"/);
    a.download = match?.[1] ?? fallbackName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
