from typing import Protocol, List, Optional
import uuid
from django.contrib.auth import get_user_model

User = get_user_model()

class UserRepository(Protocol):
    """Abstração (interface) para acesso a usuários.
    Todas as implementações devem obedecer a este contrato.
    DIP: Services dependem desta abstração, não da implementação.
    """

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        ...

    def get_by_uuid(self, uuid_str: str) -> Optional[User]:
        ...

    def get_by_email(self, email: str) -> Optional[User]:
        ...

    def get_by_email_case_insensitive(self, email: str) -> Optional[User]:
        ...

    def get_by_username_case_insensitive(self, username: str) -> Optional[User]:
        ...

    def filter_by_username(self, username: str) -> List[User]:
        ...

    def search(self, query: str, offset: int = 0, limit: int = 20) -> List[User]:
        ...

    def get_banned(self, offset: int = 0, limit: int = 20) -> List[User]:
        ...

    def get_active(self, offset: int = 0, limit: int = 20) -> List[User]:
        ...

    def create(self, *, email: str, username: str, password: str, **extra_fields) -> User:
        ...

    def update(self, user: User, **fields) -> User:
        ...

    def delete(self, user: User) -> None:
        ...


class DjangoUserRepository:
    """Implementação concreta usando o ORM do Django.
    Cumpre a interface ``UserRepository`` (DIP).
    """

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return User.objects.filter(id=user_id).first()

    def get_by_uuid(self, uuid_str: str) -> Optional[User]:
        try:
            return User.objects.filter(uuid=uuid_str).first()
        except (ValueError, AttributeError):
            return None

    def get_by_email(self, email: str) -> Optional[User]:
        return User.objects.filter(email=email).first()

    def get_by_email_case_insensitive(self, email: str) -> Optional[User]:
        return User.objects.filter(email__iexact=email).first()

    def get_by_username_case_insensitive(self, username: str) -> Optional[User]:
        return User.objects.filter(username__iexact=username).first()

    def filter_by_username(self, username: str) -> List[User]:
        return list(User.objects.filter(username__icontains=username))

    def search(self, query: str, offset: int = 0, limit: int = 20) -> List[User]:
        return list(
            User.objects.filter(email__icontains=query) |
            User.objects.filter(username__icontains=query) |
            User.objects.filter(display_name__icontains=query)
        )[offset:offset + limit]

    def get_banned(self, offset: int = 0, limit: int = 20) -> List[User]:
        return list(User.objects.get_banned()[offset:offset + limit])

    def get_active(self, offset: int = 0, limit: int = 20) -> List[User]:
        return list(User.objects.get_active()[offset:offset + limit])

    def create(self, *, email: str, username: str, password: str, **extra_fields) -> User:
        user = User(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def update(self, user: User, **fields) -> User:
        for attr, value in fields.items():
            setattr(user, attr, value)
        user.save()
        return user

    def delete(self, user: User) -> None:
        user.delete()
