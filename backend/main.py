from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routers import auth, admin
import os
from dotenv import load_dotenv

load_dotenv()

# Crear tablas automáticamente al iniciar
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FTIR Zeolitas UAS - API",
    description="Sistema de Análisis Espectroscópico por FTIR",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(admin.router, prefix="/api/admin", tags=["Administración"])


@app.get("/")
async def root():
    return {"message": "FTIR Zeolitas UAS API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
