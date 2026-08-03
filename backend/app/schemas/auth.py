from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username_or_email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class InviteRequestCreate(BaseModel):
    email: EmailStr
    display_name: str | None = Field(None, max_length=100)
    message: str | None = Field(None, max_length=2000)


class InviteRequestCreateResponse(BaseModel):
    message: str
    request_id: int
