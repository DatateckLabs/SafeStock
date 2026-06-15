#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, "/app")

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.services.auth_service import AuthService
from app.core.exceptions import ConflictError

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    AuthService.create_user(db, username="admin", email="admin@local.dev", password="admin123")
    print("[seed] Usuário admin criado. Login: admin / admin123")
except ConflictError:
    print("[seed] Usuário admin já existe. Pulando.")
finally:
    db.close()
