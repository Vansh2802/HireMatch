from datetime import datetime

from pydantic import BaseModel, Field


class AuthRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime | None = None


class AuthResponse(BaseModel):
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    confirm: str = Field(..., description='Must be the literal text DELETE')
