import os
from fastapi import Header, HTTPException, status


def require_secret(x_analytics_key: str = Header(default="")) -> None:
    expected = os.environ.get("ANALYTICS_SHARED_SECRET", "")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ANALYTICS_SHARED_SECRET not configured on server",
        )
    if x_analytics_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid analytics key",
        )
