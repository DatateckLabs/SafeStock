import { useState } from "react";
import datateckLogo from "./assets/datateck-logo.png";
import { AuthContext, useAuthProvider } from "./auth/useAuth";
import { AuthGuard } from "./auth/AuthGuard";
import { useTheme } from "./hooks/useTheme";
import { InsumosPage }     from "./pages/Insumos/InsumosPage";
import { FerramentasPage } from "./pages/Ferramentas/FerramentasPage";
import { CadastrosPage }   from "./pages/Cadastros/CadastrosPage";
import { UsuariosPage }    from "./pages/Usuarios/UsuariosPage";
import "./App.css";

type PageId = "insumos" | "ferramentas" | "cadastros" | "usuarios";

interface NavItem {
  id: PageId;
  label: string;
  icon: string;
  roles: string[];
}

const NAV: NavItem[] = [
  { id: "insumos",     label: "Insumos",     icon: "⬡", roles: ["admin", "gestor"] },
  { id: "ferramentas", label: "Ferramentas", icon: "⚙", roles: ["admin", "gestor"] },
  { id: "cadastros",   label: "Cadastros",   icon: "⚙", roles: ["admin"] },
  { id: "usuarios",    label: "Usuarios",    icon: "U",  roles: ["admin"] },
];

function AppContent() {
  const auth = useAuthProvider();
  const { theme, toggle: toggleTheme } = useTheme();
  const [active, setActive] = useState<PageId>("insumos");

  const visibleNav = NAV.filter(n => n.roles.includes(auth.user?.role ?? ""));

  const page: Record<PageId, JSX.Element> = {
    insumos:     <InsumosPage />,
    ferramentas: <FerramentasPage />,
    cadastros:   <CadastrosPage />,
    usuarios:    <UsuariosPage />,
  };

  return (
    <AuthContext.Provider value={auth}>
      <AuthGuard>
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <img src={datateckLogo} alt="Datateck" className="logo-icon" />
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
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              >
                {theme === "dark" ? "☀ dia" : "☾ noite"}
              </button>
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
