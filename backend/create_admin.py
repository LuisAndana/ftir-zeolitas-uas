#!/usr/bin/env python3
"""
Script para crear o promover el primer usuario administrador.
Ejecutar: python create_admin.py
"""
import sys
import getpass
from passlib.context import CryptContext
from database import SessionLocal, engine
from models import Base, User

Base.metadata.create_all(bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    print("=" * 50)
    print(" Crear Administrador - FTIR Zeolitas UAS")
    print("=" * 50)
    print()

    name = input("Nombre completo: ").strip()
    email = input("Correo electrónico: ").strip().lower()
    password = getpass.getpass("Contraseña (mín. 8 caracteres): ")

    if not name or not email or len(password) < 8:
        print("\n❌ Error: Datos inválidos (nombre, email y contraseña >= 8 chars requeridos)")
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()

        if existing:
            if existing.role == "administrador":
                print(f"\n⚠️  Ya existe un administrador con el correo {email}")
            else:
                existing.role = "administrador"
                existing.is_active = True
                existing.is_verified = True
                existing.hashed_password = pwd_context.hash(password)
                db.commit()
                print(f"\n✅ Usuario '{existing.name}' actualizado a administrador")
            return

        admin_user = User(
            name=name,
            email=email,
            hashed_password=pwd_context.hash(password),
            role="administrador",
            is_active=True,
            is_verified=True,
            verification_token=None,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print(f"\n✅ Administrador creado exitosamente:")
        print(f"   Nombre: {admin_user.name}")
        print(f"   Email : {admin_user.email}")
        print(f"   Rol   : {admin_user.role}")
        print(f"\nYa puedes iniciar sesión en http://localhost:4200")

    finally:
        db.close()


if __name__ == "__main__":
    main()
