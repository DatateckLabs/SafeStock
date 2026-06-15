from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password,
)
from app.core.exceptions import UnauthorizedError, NotFoundError, ConflictError
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import MeResponse, TokenResponse


class AuthService:

    @staticmethod
    def login(db: Session, username: str, password: str) -> TokenResponse:
        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Credenciais inválidas.")
        return TokenResponse(
            access_token=create_access_token(user.username),
            refresh_token=create_refresh_token(user.username),
        )

    @staticmethod
    def verify_token(token: str) -> bool:
        try:
            decode_token(token)
            return True
        except JWTError:
            return False

    @staticmethod
    def refresh_access_token(refresh_token: str) -> str:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise UnauthorizedError("Token inválido para refresh.")
            return create_access_token(payload["sub"])
        except JWTError:
            raise UnauthorizedError("Refresh token inválido ou expirado.")

    @staticmethod
    def get_me(db: Session, token: str) -> MeResponse:
        try:
            payload = decode_token(token)
            username = payload["sub"]
        except JWTError:
            raise UnauthorizedError("Token inválido.")

        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        if not user:
            raise NotFoundError("Usuário não encontrado.")

        prefix = settings.app_prefix
        return MeResponse(
            username=user.username,
            role="ADMIN",
            groups=[f"{prefix}_admin"],
            permissions=[f"{prefix}.manage_users", f"{prefix}.view_users"],
            apps=[prefix],
        )

    @staticmethod
    def create_user(db: Session, username: str, email: str, password: str) -> User:
        if db.query(User).filter(User.username == username).first():
            raise ConflictError(f"Usuário '{username}' já existe.")
        user = User(username=username, email=email, hashed_password=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
