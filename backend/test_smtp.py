import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv('backend/.env')

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)

print(f"Testing SMTP login for user: {SMTP_USER}")

msg = EmailMessage()
msg.set_content("This is a test OTP: 123456")
msg["Subject"] = "DORI SMTP Test"
msg["From"] = SMTP_FROM
msg["To"] = SMTP_USER  # send to self

try:
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.starttls()
    server.login(SMTP_USER, SMTP_PASSWORD)
    server.send_message(msg)
    server.quit()
    print("Success! Test email sent successfully.")
except Exception as e:
    print(f"Failed to send email: {e}")
