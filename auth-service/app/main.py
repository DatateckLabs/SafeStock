from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import UnauthorizedError, NotFoundError
from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest, TokenResponse, AccessTokenResponse,
    TokenVerifyRequest, TokenVerifyResponse, MeResponse,
)
from app.services.auth_service import AuthService

app = FastAPI(title="SafeStock — Auth Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = settings.app_prefix


def get_bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente.")
    return auth.split(" ", 1)[1]


@app.get(f"/{PREFIX}/login/", response_class=HTMLResponse, tags=["auth"])
def login_page(next: str = "/"):
    return f"""
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — SafeStock</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ min-height: 100vh; display: flex; align-items: center; justify-content: center;
            background: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
    .card {{ background: #1a1d27; border: 1px solid #2e3250; border-radius: 12px;
             padding: 2.5rem 2rem; width: 100%; max-width: 380px; }}
    h1 {{ color: #e2e8f0; font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; text-align: center; }}
    .subtitle {{ color: #64748b; font-size: 0.82rem; text-align: center; margin-bottom: 1.75rem; }}
    label {{ display: block; color: #94a3b8; font-size: .82rem; margin-bottom: .35rem; margin-top: 1rem; }}
    input {{ width: 100%; padding: .6rem .85rem; background: #22263a; border: 1px solid #2e3250;
             border-radius: 7px; color: #e2e8f0; font-size: .95rem; outline: none; }}
    input:focus {{ border-color: #0ea5e9; }}
    button {{ margin-top: 1.5rem; width: 100%; padding: .7rem; background: #0ea5e9;
              color: #fff; font-size: 1rem; font-weight: 600; border: none; border-radius: 7px;
              cursor: pointer; transition: background .2s; }}
    button:hover {{ background: #38bdf8; }}
    .error {{ color: #ef4444; font-size: .82rem; margin-top: .5rem; display: none; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>◈ SafeStock</h1>
    <p class="subtitle">Controle de Insumos e Ferramentas</p>
    <label>Usuário</label>
    <input id="u" type="text" placeholder="admin" autocomplete="username">
    <label>Senha</label>
    <input id="p" type="password" placeholder="••••••••" autocomplete="current-password">
    <p class="error" id="err">Usuário ou senha inválidos.</p>
    <button onclick="doLogin()">Entrar</button>
  </div>
  <script>
    const NEXT = decodeURIComponent("{next}");
    async function doLogin() {{
      const res = await fetch("/{PREFIX}/token", {{
        method: "POST",
        headers: {{"Content-Type": "application/json"}},
        body: JSON.stringify({{username: document.getElementById("u").value,
                              password: document.getElementById("p").value}})
      }});
      if (!res.ok) {{ document.getElementById("err").style.display = "block"; return; }}
      const data = await res.json();
      const url = new URL(NEXT, location.origin);
      url.searchParams.set("access_token", data.access_token);
      if (data.refresh_token) url.searchParams.set("refresh_token", data.refresh_token);
      location.href = url.toString();
    }}
    document.addEventListener("keydown", e => {{ if (e.key === "Enter") doLogin(); }});
  </script>
</body>
</html>
"""


@app.post(f"/{PREFIX}/token", response_model=TokenResponse, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        return AuthService.login(db, payload.username, payload.password)
    except UnauthorizedError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post(f"/{PREFIX}/token/refresh", response_model=AccessTokenResponse, tags=["auth"])
def refresh_token(request: Request):
    token = get_bearer_token(request)
    try:
        access = AuthService.refresh_access_token(token)
        return AccessTokenResponse(access_token=access)
    except UnauthorizedError as e:
        raise HTTPException(status_code=401, detail=str(e))


# Fix 5 — sem barra final
@app.get(f"/{PREFIX}/me", response_model=MeResponse, tags=["auth"])
def get_me_prefixed(request: Request, db: Session = Depends(get_db)):
    token = get_bearer_token(request)
    try:
        return AuthService.get_me(db, token)
    except (UnauthorizedError, NotFoundError) as e:
        raise HTTPException(status_code=401, detail=str(e))


# Fix 5 — compatível com auth central
@app.get("/api/me/", response_model=MeResponse, tags=["auth"])
def get_me_api(request: Request, db: Session = Depends(get_db)):
    token = get_bearer_token(request)
    try:
        return AuthService.get_me(db, token)
    except (UnauthorizedError, NotFoundError) as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/api/token/verify/", response_model=TokenVerifyResponse, tags=["auth"])
def verify_token(payload: TokenVerifyRequest):
    return TokenVerifyResponse(valid=AuthService.verify_token(payload.token))


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}
