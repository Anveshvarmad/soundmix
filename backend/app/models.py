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
    playlists = relationship("Playlist", back_populates="user", cascade="all, delete-orphan")
    artists = relationship("FavoriteArtist", back_populates="user", cascade="all, delete-orphan")
    podcasts = relationship("FavoritePodcast", back_populates="user", cascade="all, delete-orphan")


class FavoriteSong(Base):
    __tablename__ = "favorite_songs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    track_id = Column(String(80), nullable=False)
    track_name = Column(String(255), nullable=False)
    artist_name = Column(String(255), nullable=False)
    collection_name = Column(String(255), nullable=True)
    artwork_url = Column(String(500), nullable=True)
    preview_url = Column(String(700), nullable=True)
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

    track_id = Column(String(80), nullable=False)
    track_name = Column(String(255), nullable=False)
    artist_name = Column(String(255), nullable=False)
    collection_name = Column(String(255), nullable=True)
    artwork_url = Column(String(500), nullable=True)
    preview_url = Column(String(700), nullable=True)
    genre = Column(String(120), nullable=True)

    play_count = Column(Integer, default=1)
    last_played = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="history")

    __table_args__ = (
        UniqueConstraint("user_id", "track_id", name="unique_user_history_track"),
    )


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(160), nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="playlists")
    songs = relationship("PlaylistSong", back_populates="playlist", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="unique_user_playlist_name"),
    )


class PlaylistSong(Base):
    __tablename__ = "playlist_songs"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False)

    track_id = Column(String(80), nullable=False)
    track_name = Column(String(255), nullable=False)
    artist_name = Column(String(255), nullable=False)
    collection_name = Column(String(255), nullable=True)
    artwork_url = Column(String(500), nullable=True)
    preview_url = Column(String(700), nullable=True)
    genre = Column(String(120), nullable=True)

    added_at = Column(DateTime, default=datetime.utcnow)

    playlist = relationship("Playlist", back_populates="songs")

    __table_args__ = (
        UniqueConstraint("playlist_id", "track_id", name="unique_playlist_track"),
    )



class FavoriteArtist(Base):
    __tablename__ = "favorite_artists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    artist_name = Column(String(255), nullable=False)
    artwork_url = Column(String(500), nullable=True)
    genre = Column(String(120), nullable=True)
    source = Column(String(80), default="Audius")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="artists")

    __table_args__ = (
        UniqueConstraint("user_id", "artist_name", name="unique_user_artist"),
    )


class FavoritePodcast(Base):
    __tablename__ = "favorite_podcasts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    podcast_id = Column(String(120), nullable=False)
    title = Column(String(255), nullable=False)
    publisher = Column(String(255), nullable=True)
    artwork_url = Column(String(500), nullable=True)
    feed_url = Column(String(800), nullable=True)
    genre = Column(String(255), nullable=True)
    collection_view_url = Column(String(800), nullable=True)
    track_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="podcasts")

    __table_args__ = (
        UniqueConstraint("user_id", "podcast_id", name="unique_user_podcast"),
    )
