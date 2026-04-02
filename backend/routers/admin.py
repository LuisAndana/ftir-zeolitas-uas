from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserUpdateAdmin
from dependencies import get_admin_user
from email_utils import send_welcome_email

router = APIRouter()


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ── Listar usuarios ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {"success": True, "data": [user_dict(u) for u in users]}


# ── Actualizar usuario ────────────────────────────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdateAdmin,
    background_tasks: BackgroundTasks,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=400, detail="No puedes modificar tu propia cuenta desde aquí"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    was_inactive = not user.is_active

    if body.is_active is not None:
        user.is_active = body.is_active

    if body.role is not None:
        if body.role not in ("investigador", "administrador"):
            raise HTTPException(status_code=400, detail="Rol inválido")
        user.role = body.role

    db.commit()
    db.refresh(user)

    # Enviar correo de bienvenida cuando el admin activa la cuenta
    if was_inactive and user.is_active and user.is_verified:
        background_tasks.add_task(send_welcome_email, user.email, user.name)

    return {
        "success": True,
        "message": "Usuario actualizado",
        "data": user_dict(user),
    }


# ── Eliminar usuario ──────────────────────────────────────────────────────────

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=400, detail="No puedes eliminar tu propia cuenta"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    db.delete(user)
    db.commit()

    return {"success": True, "message": "Usuario eliminado"}
