import { api } from "./api";
import type { UserProfile } from "../types";

export class UsuariosService {
  static async getAll(): Promise<UserProfile[]> {
    const { data } = await api.get<UserProfile[]>("/api/v1/usuarios/");
    return data;
  }

  static async create(payload: {
    username: string;
    role: "admin" | "gestor" | "operador";
    is_active?: boolean;
  }): Promise<UserProfile> {
    const { data } = await api.post<UserProfile>("/api/v1/usuarios/", payload);
    return data;
  }

  static async update(
    id: number,
    payload: { role?: "admin" | "gestor" | "operador"; is_active?: boolean }
  ): Promise<UserProfile> {
    const { data } = await api.put<UserProfile>(`/api/v1/usuarios/${id}/`, payload);
    return data;
  }

  static async desativar(id: number): Promise<void> {
    await api.delete(`/api/v1/usuarios/${id}/`);
  }
}
