import { useState } from "react";
import { AuthContext, useAuthProvider } from "./auth/useAuth";
import { AuthGuard } from "./auth/AuthGuard";
import { DashboardPage }   from "./pages/Dashboard/DashboardPage";
import { InsumosPage }     from "./pages/Insumos/InsumosPage";
import { FerramentasPage } from "./pages/Ferramentas/FerramentasPage";
import { OrdensCompraPage } from "./pages/OrdensCompra/OrdensCompraPage";
import { CadastrosPage }   from "./pages/Cadastros/CadastrosPage";
import { UsuariosPage }    from "./pages/Usuarios/UsuariosPage";
import "./App.css";

type PageId = "dashboard" | "insumos" | "ferramentas" | "ordens" | "cadastros" | "usuarios";

interface NavItem {
  id: PageId;
  label: string;
  icon: string;
  roles: string[];
}

const NAV: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",       icon: "◈", roles: ["admin", "gestor", "operador"] },
  { id: "insumos",     label: "Insumos",          icon: "⬡", roles: ["admin", "gestor"] },
  { id: "ferramentas", label: "Ferramentas",      icon: "⚙", roles: ["admin", "gestor"] },
  { id: "ordens",      label: "Ordens de Compra", icon: "📄", roles: ["admin", "gestor"] },
  { id: "cadastros",   label: "Cadastros",        icon: "⚙", roles: ["admin"] },
  { id: "usuarios",    label: "Usuários",         icon: "👤", roles: ["admin"] },
];

function AppContent() {
  const auth = useAuthProvider();
  const [active, setActive] = useState<PageId>("dashboard");

  const visibleNav = NAV.filter(n => n.roles.includes(auth.user?.role ?? ""));

  const page: Record<PageId, JSX.Element> = {
    dashboard:   <DashboardPage />,
    insumos:     <InsumosPage />,
    ferramentas: <FerramentasPage />,
    ordens:      <OrdensCompraPage />,
    cadastros:   <CadastrosPage />,
    usuarios:    <UsuariosPage />,
  };

  return (
    <AuthContext.Provider value={auth}>
      <AuthGuard>
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <span className="logo-icon">◈</span>
              <span className="logo-text">SafeStock</span>
            </div>
            <nav className="sidebar-nav">
              {visibleNav.map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${active === item.id ? "active" : ""}`}
                  onClick={() => setActive(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-footer">
              <span className="user-info">{auth.user?.username} · {auth.user?.role}</span>
              <button className="logout-btn" onClick={auth.logout}>Sair</button>
            </div>
          </aside>
          <main className="main-content">
            {page[active]}
          </main>
        </div>
      </AuthGuard>
    </AuthContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
