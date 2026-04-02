from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import secrets
import os
from dotenv import load_dotenv

from database import get_db
from models import User
from schemas import UserCreate, LoginRequest, RefreshRequest
from email_utils import send_verification_email
from dependencies import get_current_user, SECRET_KEY, ALGORITHM

load_dotenv()

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + expires_delta
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def build_tokens(user: User) -> dict:
    access_token = create_token(
        {"sub": user.id, "role": user.role},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_token(
        {"sub": user.id, "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
    }


# ── Registro ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(
    body: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    verification_token = secrets.token_urlsafe(48)

    new_user = User(
        name=body.name,
        email=body.email,
        hashed_password=pwd_context.hash(body.password),
        role="investigador",
        is_active=False,     # El administrador debe activar la cuenta
        is_verified=False,   # El usuario debe verificar su correo
        verification_token=verification_token,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    background_tasks.add_task(
        send_verification_email, new_user.email, new_user.name, verification_token
    )

    return {
        "success": True,
        "message": "Cuenta creada. Revisa tu correo para verificar tu dirección.",
        "data": None,
    }


# ── Verificación de correo ────────────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        raise HTTPException(
            status_code=400, detail="Token de verificación inválido o ya utilizado"
        )

    if user.is_verified:
        return {"success": True, "message": "Tu correo ya fue verificado previamente"}

    user.is_verified = True
    user.verification_token = None
    db.commit()

    return {
        "success": True,
        "message": "Correo verificado exitosamente. Un administrador activará tu cuenta pronto.",
    }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="ACCOUNT_PENDING_APPROVAL")

    tokens = build_tokens(user)

    return {
        "success": True,
        "message": "Login exitoso",
        "data": {"user": user_dict(user), **tokens},
    }


# ── Perfil ────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "message": "Perfil obtenido",
        "data": {"user": user_dict(current_user)},
    }


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    # JWT es stateless; el cliente elimina los tokens
    return {"success": True, "message": "Sesión cerrada"}


# ── Refresh token ─────────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user_id: int = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")

    tokens = build_tokens(user)
    return {"success": True, "message": "Token renovado", "data": tokens}
