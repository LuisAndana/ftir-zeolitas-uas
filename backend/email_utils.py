import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
FROM_NAME = os.getenv("FROM_NAME", "FTIR Zeolitas UAS")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Envía un correo HTML mediante SMTP."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[EMAIL] SMTP no configurado. Simulando envío a {to_email}")
        print(f"[EMAIL] Asunto: {subject}")
        return True  # En desarrollo, no falla si SMTP no está configurado

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())

        print(f"[EMAIL] Correo enviado exitosamente a {to_email}")
        return True

    except Exception as e:
        print(f"[EMAIL] Error al enviar correo a {to_email}: {e}")
        return False


def send_verification_email(to_email: str, name: str, token: str) -> bool:
    verification_url = f"{FRONTEND_URL}/verify-email?token={token}"

    html_body = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu correo - FTIR Zeolitas UAS</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#16324f);padding:35px 40px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:26px;letter-spacing:-0.5px;">🔬 FTIR Zeolitas UAS</h1>
            <p style="color:rgba(255,255,255,0.75);margin:8px 0 0 0;font-size:14px;">Sistema de Análisis Espectroscópico</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#1e3a5f;margin-top:0;font-size:22px;">Verifica tu correo electrónico</h2>
            <p style="color:#4b5563;line-height:1.7;">Hola <strong>{name}</strong>,</p>
            <p style="color:#4b5563;line-height:1.7;">Gracias por registrarte en el sistema FTIR Zeolitas UAS. Para completar tu registro debes verificar tu dirección de correo haciendo clic en el botón de abajo.</p>

            <div style="background:#eef7ff;border-left:4px solid #2E75B6;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
              <p style="margin:0;color:#1e3a5f;font-size:14px;line-height:1.6;">
                <strong>Nota:</strong> Después de verificar tu correo, un administrador deberá activar tu cuenta antes de que puedas acceder al sistema.
              </p>
            </div>

            <div style="text-align:center;margin:32px 0;">
              <a href="{verification_url}" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#2E75B6);color:white;padding:15px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
                ✓ Verificar Correo Electrónico
              </a>
            </div>

            <p style="color:#6b7280;font-size:13px;line-height:1.6;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p style="word-break:break-all;color:#2E75B6;font-size:13px;background:#f8fafc;padding:10px 15px;border-radius:6px;">{verification_url}</p>
            <p style="color:#9ca3af;font-size:13px;margin-top:24px;">Este enlace es válido por <strong>24 horas</strong>.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:13px;margin:0;">Si no creaste esta cuenta, ignora este correo.</p>
            <p style="color:#9ca3af;font-size:13px;margin:8px 0 0 0;">© {2025} FTIR Zeolitas UAS · Universidad Autónoma de Sinaloa</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return send_email(to_email, "Verifica tu correo - FTIR Zeolitas UAS", html_body)


def send_welcome_email(to_email: str, name: str) -> bool:
    """Correo que se envía cuando el admin activa la cuenta."""
    login_url = f"{FRONTEND_URL}/welcome"

    html_body = f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#16324f);padding:35px 40px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:26px;">🔬 FTIR Zeolitas UAS</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#1e3a5f;margin-top:0;">¡Tu cuenta ha sido activada!</h2>
            <p style="color:#4b5563;line-height:1.7;">Hola <strong>{name}</strong>,</p>
            <p style="color:#4b5563;line-height:1.7;">Un administrador ha activado tu cuenta en el sistema FTIR Zeolitas UAS. Ya puedes iniciar sesión y comenzar a utilizar el sistema.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="{login_url}" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#2E75B6);color:white;padding:15px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
                Iniciar Sesión
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:13px;margin:0;">© 2025 FTIR Zeolitas UAS · Universidad Autónoma de Sinaloa</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return send_email(to_email, "¡Tu cuenta ha sido activada! - FTIR Zeolitas UAS", html_body)
