from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    favorites = relationship("FavoriteSong", back_populates="user", cascade="all, delete-orphan")
    history = relationship("ListeningHistory", back_populates="user", cascade="all, delete-orphan")


class FavoriteSong(Base):
    __tablename__ = "favorite_songs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    track_id = Column(Integer, nullable=False)
    track_name = Column(String(255), nullable=False)
    artist_name = Column(String(255), nullable=False)
    collection_name = Column(String(255), nullable=True)
    artwork_url = Column(String(500), nullable=True)
    preview_url = Column(String(500), nullable=True)
    genre = Column(String(120), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")

    __table_args__ = (
        UniqueConstraint("user_id", "track_id", name="unique_user_favorite_track"),
    )


class ListeningHistory(Base):
    __tablename__ = "listening_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    track_id = Column(Integer, nullable=False)
    track_name = Column(String(255), nullable=False)
    artist_name = Column(String(255), nullable=False)
    collection_name = Column(String(255), nullable=True)
    artwork_url = Column(String(500), nullable=True)
    preview_url = Column(String(500), nullable=True)
    genre = Column(String(120), nullable=True)

    play_count = Column(Integer, default=1)
    last_played = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="history")

    __table_args__ = (
        UniqueConstraint("user_id", "track_id", name="unique_user_history_track"),
    )
