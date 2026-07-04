from collections import Counter
from datetime import datetime
import os

import httpx
from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import User, FavoriteSong, ListeningHistory, Playlist, PlaylistSong
from app.schemas import UserCreate, LoginRequest, TokenResponse, SongIn, PlaylistCreate, PlaylistUpdate
from app.auth import hash_password, verify_password, create_access_token, get_current_user

app = FastAPI(title="SoundMix API", version="1.0.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


def user_to_dict(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email}


def normalize_song(item: dict) -> dict:
    return {
        "trackId": item.get("trackId"),
        "trackName": item.get("trackName"),
        "artistName": item.get("artistName"),
        "collectionName": item.get("collectionName"),
        "artworkUrl100": item.get("artworkUrl100", "").replace("100x100bb", "600x600bb"),
        "previewUrl": item.get("previewUrl"),
        "primaryGenreName": item.get("primaryGenreName"),
        "releaseDate": item.get("releaseDate"),
    }


def favorite_to_dict(song: FavoriteSong) -> dict:
    return {
        "trackId": song.track_id,
        "trackName": song.track_name,
        "artistName": song.artist_name,
        "collectionName": song.collection_name,
        "artworkUrl100": song.artwork_url,
        "previewUrl": song.preview_url,
        "primaryGenreName": song.genre,
        "createdAt": song.created_at,
    }


def history_to_dict(song: ListeningHistory) -> dict:
    return {
        "trackId": song.track_id,
        "trackName": song.track_name,
        "artistName": song.artist_name,
        "collectionName": song.collection_name,
        "artworkUrl100": song.artwork_url,
        "previewUrl": song.preview_url,
        "primaryGenreName": song.genre,
        "playCount": song.play_count,
        "lastPlayed": song.last_played,
    }


def playlist_song_to_dict(song: PlaylistSong) -> dict:
    return {
        "trackId": song.track_id,
        "trackName": song.track_name,
        "artistName": song.artist_name,
        "collectionName": song.collection_name,
        "artworkUrl100": song.artwork_url,
        "previewUrl": song.preview_url,
        "primaryGenreName": song.genre,
        "addedAt": song.added_at,
    }


def playlist_to_dict(playlist: Playlist, include_songs: bool = False) -> dict:
    data = {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "songCount": len(playlist.songs),
        "createdAt": playlist.created_at,
    }

    if include_songs:
        data["songs"] = [playlist_song_to_dict(song) for song in playlist.songs]

    return data


async def fetch_itunes(term: str, limit: int = 30) -> list[dict]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            ITUNES_SEARCH_URL,
            params={
                "term": term,
                "media": "music",
                "entity": "song",
                "limit": limit,
            },
        )
        response.raise_for_status()
        data = response.json()

    return [
        normalize_song(item)
        for item in data.get("results", [])
        if item.get("previewUrl") and item.get("trackId")
    ]


@app.get("/health")
def health():
    return {"status": "ok", "service": "soundmix-api"}


@app.post("/api/auth/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name.strip(),
        email=email,
        hashed_password=hash_password(payload.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return user_to_dict(current_user)


@app.get("/api/music/search")
async def search_music(
    term: str = Query(default="weeknd", min_length=1),
    limit: int = Query(default=24, ge=1, le=50),
):
    songs = await fetch_itunes(term, limit)
    return {"term": term, "count": len(songs), "songs": songs}


@app.get("/api/music/discover")
async def discover_music():
    terms = ["pop hits", "hip hop", "lofi", "edm", "indie"]
    songs = []

    for term in terms:
        songs.extend(await fetch_itunes(term, 8))

    unique = {}
    for song in songs:
        unique[song["trackId"]] = song

    final_songs = list(unique.values())[:32]

    return {"count": len(final_songs), "songs": final_songs}


@app.get("/api/music/mood/{mood}")
async def mood_music(mood: str):
    mood_map = {
        "happy": "happy pop",
        "sad": "sad acoustic",
        "chill": "lofi chill",
        "focus": "piano focus",
        "workout": "workout edm",
        "love": "romantic songs",
    }

    term = mood_map.get(mood.lower(), mood)
    songs = await fetch_itunes(term, 30)

    return {"mood": mood, "term": term, "count": len(songs), "songs": songs}


@app.get("/api/library/likes")
def get_likes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    songs = (
        db.query(FavoriteSong)
        .filter(FavoriteSong.user_id == current_user.id)
        .order_by(FavoriteSong.created_at.desc())
        .all()
    )

    return {"count": len(songs), "songs": [favorite_to_dict(song) for song in songs]}


@app.post("/api/library/likes")
def like_song(
    song: SongIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(FavoriteSong)
        .filter(
            FavoriteSong.user_id == current_user.id,
            FavoriteSong.track_id == song.trackId,
        )
        .first()
    )

    if existing:
        return favorite_to_dict(existing)

    favorite = FavoriteSong(
        user_id=current_user.id,
        track_id=song.trackId,
        track_name=song.trackName,
        artist_name=song.artistName,
        collection_name=song.collectionName,
        artwork_url=song.artworkUrl100,
        preview_url=song.previewUrl,
        genre=song.primaryGenreName,
    )

    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    return favorite_to_dict(favorite)


@app.delete("/api/library/likes/{track_id}")
def unlike_song(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorite = (
        db.query(FavoriteSong)
        .filter(
            FavoriteSong.user_id == current_user.id,
            FavoriteSong.track_id == track_id,
        )
        .first()
    )

    if not favorite:
        raise HTTPException(status_code=404, detail="Song not found in likes")

    db.delete(favorite)
    db.commit()

    return {"message": "Song removed from likes"}


@app.post("/api/history/play")
def save_play_history(
    song: SongIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(ListeningHistory)
        .filter(
            ListeningHistory.user_id == current_user.id,
            ListeningHistory.track_id == song.trackId,
        )
        .first()
    )

    if existing:
        existing.play_count += 1
        existing.last_played = datetime.utcnow()
        existing.track_name = song.trackName
        existing.artist_name = song.artistName
        existing.collection_name = song.collectionName
        existing.artwork_url = song.artworkUrl100
        existing.preview_url = song.previewUrl
        existing.genre = song.primaryGenreName
        db.commit()
        db.refresh(existing)
        return history_to_dict(existing)

    history = ListeningHistory(
        user_id=current_user.id,
        track_id=song.trackId,
        track_name=song.trackName,
        artist_name=song.artistName,
        collection_name=song.collectionName,
        artwork_url=song.artworkUrl100,
        preview_url=song.previewUrl,
        genre=song.primaryGenreName,
    )

    db.add(history)
    db.commit()
    db.refresh(history)

    return history_to_dict(history)


@app.get("/api/history")
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    songs = (
        db.query(ListeningHistory)
        .filter(ListeningHistory.user_id == current_user.id)
        .order_by(ListeningHistory.last_played.desc())
        .limit(30)
        .all()
    )

    return {"count": len(songs), "songs": [history_to_dict(song) for song in songs]}


@app.get("/api/recommendations")
async def recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    history = (
        db.query(ListeningHistory)
        .filter(ListeningHistory.user_id == current_user.id)
        .order_by(ListeningHistory.last_played.desc())
        .limit(20)
        .all()
    )

    if not history:
        songs = await fetch_itunes("top hits", 30)
        return {
            "source": "default",
            "message": "No listening history yet. Showing popular discovery tracks.",
            "songs": songs,
        }

    genres = [item.genre for item in history if item.genre]
    artists = [item.artist_name for item in history if item.artist_name]

    top_genre = Counter(genres).most_common(1)[0][0] if genres else ""
    top_artist = Counter(artists).most_common(1)[0][0] if artists else ""

    search_term = f"{top_genre} {top_artist}".strip() or "top hits"
    songs = await fetch_itunes(search_term, 35)

    played_ids = {item.track_id for item in history}
    filtered = [song for song in songs if song["trackId"] not in played_ids]

    return {
        "source": "history",
        "term": search_term,
        "message": "Recommendations generated from your listening history.",
        "songs": filtered[:24],
    }


@app.get("/api/playlists")
def get_playlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlists = (
        db.query(Playlist)
        .filter(Playlist.user_id == current_user.id)
        .order_by(Playlist.created_at.desc())
        .all()
    )

    return {
        "count": len(playlists),
        "playlists": [playlist_to_dict(playlist) for playlist in playlists],
    }


@app.post("/api/playlists")
def create_playlist(
    payload: PlaylistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Playlist name is required")

    existing = (
        db.query(Playlist)
        .filter(Playlist.user_id == current_user.id, Playlist.name == name)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Playlist already exists")

    playlist = Playlist(
        user_id=current_user.id,
        name=name,
        description=payload.description,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return playlist_to_dict(playlist, include_songs=True)


@app.get("/api/playlists/{playlist_id}")
def get_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    return playlist_to_dict(playlist, include_songs=True)


@app.patch("/api/playlists/{playlist_id}")
def update_playlist(
    playlist_id: int,
    payload: PlaylistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Playlist name is required")
        playlist.name = name

    if payload.description is not None:
        playlist.description = payload.description

    db.commit()
    db.refresh(playlist)

    return playlist_to_dict(playlist, include_songs=True)


@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    db.delete(playlist)
    db.commit()

    return {"message": "Playlist deleted"}


@app.post("/api/playlists/{playlist_id}/songs")
def add_song_to_playlist(
    playlist_id: int,
    song: SongIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    existing = (
        db.query(PlaylistSong)
        .filter(
            PlaylistSong.playlist_id == playlist_id,
            PlaylistSong.track_id == song.trackId,
        )
        .first()
    )

    if existing:
        return playlist_song_to_dict(existing)

    playlist_song = PlaylistSong(
        playlist_id=playlist_id,
        track_id=song.trackId,
        track_name=song.trackName,
        artist_name=song.artistName,
        collection_name=song.collectionName,
        artwork_url=song.artworkUrl100,
        preview_url=song.previewUrl,
        genre=song.primaryGenreName,
    )

    db.add(playlist_song)
    db.commit()
    db.refresh(playlist_song)

    return playlist_song_to_dict(playlist_song)


@app.delete("/api/playlists/{playlist_id}/songs/{track_id}")
def remove_song_from_playlist(
    playlist_id: int,
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    playlist_song = (
        db.query(PlaylistSong)
        .filter(
            PlaylistSong.playlist_id == playlist_id,
            PlaylistSong.track_id == track_id,
        )
        .first()
    )

    if not playlist_song:
        raise HTTPException(status_code=404, detail="Song not found in playlist")

    db.delete(playlist_song)
    db.commit()

    return {"message": "Song removed from playlist"}
