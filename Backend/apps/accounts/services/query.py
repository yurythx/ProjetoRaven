from typing import Optional, List
import uuid
from django.contrib.auth import get_user_model
from ..repositories.user import UserRepository, DjangoUserRepository

User = get_user_model()

class UserQueryService:
    """Service for querying users (read operations).
    
    DIP: Depends on UserRepository abstraction, not concrete implementation.
    SRP: Only handles user query operations.
    """

    def __init__(self, repository: UserRepository = None):
        self.repository = repository or DjangoUserRepository()

    def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return self.repository.get_by_id(user_id)

    def get_user_by_uuid(self, uuid_str: str) -> Optional[User]:
        return self.repository.get_by_uuid(uuid_str)

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.repository.get_by_email_case_insensitive(email)

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.repository.get_by_username_case_insensitive(username)

    def get_all_users(self, page: int = 1, page_size: int = 20) -> List[User]:
        offset = (page - 1) * page_size
        return self.repository.get_active(offset=offset, limit=page_size)

    def search_users(self, query: str, page: int = 1, page_size: int = 20) -> List[User]:
        offset = (page - 1) * page_size
        return self.repository.search(query=query, offset=offset, limit=page_size)

    def get_banned_users(self, page: int = 1, page_size: int = 20) -> List[User]:
        offset = (page - 1) * page_size
        return self.repository.get_banned(offset=offset, limit=page_size)

    def get_active_users(self, page: int = 1, page_size: int = 20) -> List[User]:
        offset = (page - 1) * page_size
        return self.repository.get_active(offset=offset, limit=page_size)
