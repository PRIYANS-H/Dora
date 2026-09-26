from typing import Any, Dict

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import JWT_SECRET

bearer = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> Dict[str, Any]:
    """Validate DORI's short-lived bearer identity before serving private APIs."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="DORI JWT signing is not configured. Set SUPABASE_JWT_SECRET.")
    try:
        claims = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id = claims.get("sub")
        if not user_id or claims.get("role") != "authenticated":
            raise ValueError("Missing authenticated subject")
        return {"id": user_id, "email": claims.get("email", "")}
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.")


def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None:
        return None
    return get_current_user(credentials)
