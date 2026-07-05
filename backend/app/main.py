from collections import Counter
from datetime import datetime
import io
import os
import re

import cv2
import numpy as np
from PIL import Image

import feedparser
import httpx
from fastapi import FastAPI, Query, Depends, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import User, FavoriteSong, ListeningHistory, Playlist, PlaylistSong, FavoriteArtist, FavoritePodcast
from app.schemas import UserCreate, LoginRequest, TokenResponse, SongIn, PlaylistCreate, PlaylistUpdate, ArtistIn, PodcastIn, SmartMixRequest, SmartPlaylistRequest
from app.auth import hash_password, verify_password, create_access_token, get_current_user

app = FastAPI(title="SoundMix API", version="2.0.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIOUS_API_BASE = os.getenv("AUDIOUS_API_BASE", "https://api.audius.co")
AUDIOUS_APP_NAME = os.getenv("AUDIOUS_APP_NAME", "soundmix")
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


EMOTION_TO_SEARCH = {
    "happy": "happy upbeat dance",
    "sad": "sad acoustic piano",
    "angry": "intense rock workout",
    "neutral": "chill lofi",
    "surprise": "party upbeat electronic",
    "fear": "calm ambient relaxing",
}

POST_VIBE_TO_SEARCH = {
    "travel": "travel sunset chill",
    "beach": "beach summer tropical",
    "fitness": "workout hype electronic",
    "food": "fun lifestyle pop",
    "party": "party dance upbeat",
    "romantic": "romantic love acoustic",
    "study": "focus lofi instrumental",
    "aesthetic": "aesthetic chill electronic",
    "calm": "calm ambient lofi",
    "happy": "happy pop upbeat",
}


async def read_upload_as_cv_image(file: UploadFile) -> np.ndarray:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    content = await file.read()

    if len(content) > 6 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be smaller than 6MB")

    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
        image.thumbnail((900, 900))
        rgb = np.array(image)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image")


def analyze_expression_from_image(image: np.ndarray) -> dict:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    face_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    smile_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_smile.xml"
    )
    eye_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_eye.xml"
    )

    faces = []
    if not face_detector.empty():
        faces = face_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80),
        )

    face_detected = len(faces) > 0

    if face_detected:
        x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
        face_gray = gray[y:y + h, x:x + w]
        face_bgr = image[y:y + h, x:x + w]
    else:
        face_gray = gray
        face_bgr = image

    hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    brightness = float(np.mean(hsv[:, :, 2]))
    saturation = float(np.mean(hsv[:, :, 1]))
    contrast = float(np.std(face_gray))

    edges = cv2.Canny(face_gray, 80, 160)
    edge_density = float(np.count_nonzero(edges) / max(edges.size, 1))

    smile_count = 0
    eye_count = 0

    if face_detected and not smile_detector.empty():
        lower_face = face_gray[int(face_gray.shape[0] * 0.45):, :]
        smiles = smile_detector.detectMultiScale(
            lower_face,
            scaleFactor=1.7,
            minNeighbors=18,
            minSize=(25, 25),
        )
        smile_count = len(smiles)

    if face_detected and not eye_detector.empty():
        upper_face = face_gray[:int(face_gray.shape[0] * 0.55), :]
        eyes = eye_detector.detectMultiScale(
            upper_face,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(20, 20),
        )
        eye_count = len(eyes)

    if smile_count > 0:
        emotion = "happy"
        confidence = 0.82
    elif brightness < 85 and saturation < 80:
        emotion = "sad"
        confidence = 0.68
    elif contrast > 72 and edge_density > 0.13:
        emotion = "angry"
        confidence = 0.61
    elif eye_count >= 2 and contrast > 55 and brightness > 115:
        emotion = "surprise"
        confidence = 0.58
    elif brightness < 95 and contrast > 60:
        emotion = "fear"
        confidence = 0.55
    else:
        emotion = "neutral"
        confidence = 0.60 if face_detected else 0.45

    return {
        "emotion": emotion,
        "confidence": confidence,
        "faceDetected": face_detected,
        "signals": {
            "brightness": round(brightness, 2),
            "saturation": round(saturation, 2),
            "contrast": round(contrast, 2),
            "edgeDensity": round(edge_density, 4),
            "smileCount": smile_count,
            "eyeCount": eye_count,
        },
    }


def analyze_post_vibe(image: np.ndarray | None, caption: str) -> dict:
    clean_caption = caption.lower().strip()

    keyword_groups = {
        "travel": ["travel", "trip", "vacation", "mountain", "city", "road", "flight"],
        "beach": ["beach", "sea", "ocean", "sunset", "summer", "pool"],
        "fitness": ["gym", "fitness", "workout", "run", "running", "lift"],
        "food": ["food", "coffee", "restaurant", "dinner", "lunch", "brunch"],
        "party": ["party", "club", "dance", "nightout", "birthday"],
        "romantic": ["love", "couple", "date", "romantic", "heart"],
        "study": ["study", "work", "desk", "coding", "focus", "college"],
        "aesthetic": ["aesthetic", "vibe", "fashion", "fit", "outfit"],
    }

    for vibe, words in keyword_groups.items():
        if any(re.search(rf"\b{re.escape(word)}\b", clean_caption) for word in words):
            return {
                "vibe": vibe,
                "reason": "Detected vibe from caption keywords",
            }

    if image is None:
        return {
            "vibe": "aesthetic",
            "reason": "No image keywords found, using general aesthetic music",
        }

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    brightness = float(np.mean(hsv[:, :, 2]))
    saturation = float(np.mean(hsv[:, :, 1]))
    hue = float(np.mean(hsv[:, :, 0]))

    if brightness > 145 and saturation > 95:
        vibe = "happy"
    elif brightness < 90 and saturation < 85:
        vibe = "calm"
    elif 10 <= hue <= 35 and saturation > 80:
        vibe = "beach"
    elif saturation > 110:
        vibe = "party"
    else:
        vibe = "aesthetic"

    return {
        "vibe": vibe,
        "reason": "Detected vibe from image color and lighting",
        "signals": {
            "brightness": round(brightness, 2),
            "saturation": round(saturation, 2),
            "hue": round(hue, 2),
        },
    }


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


def user_to_dict(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email}


def get_artwork(track: dict) -> str:
    artwork = track.get("artwork") or {}
    return (
        artwork.get("1000x1000")
        or artwork.get("480x480")
        or artwork.get("150x150")
        or ""
    )


def get_artist_name(track: dict) -> str:
    user = track.get("user") or {}
    return user.get("name") or user.get("handle") or "Unknown Artist"


def stream_url(track_id: str) -> str:
    return f"{AUDIOUS_API_BASE}/v1/tracks/{track_id}/stream?app_name={AUDIOUS_APP_NAME}"


def normalize_audius_track(track: dict) -> dict:
    track_id = str(track.get("id"))

    return {
        "trackId": track_id,
        "trackName": track.get("title") or "Untitled Track",
        "artistName": get_artist_name(track),
        "collectionName": track.get("album") or track.get("playlist_name") or "Audius",
        "artworkUrl100": get_artwork(track),
        "previewUrl": stream_url(track_id),
        "primaryGenreName": track.get("genre") or track.get("mood") or "Music",
        "releaseDate": track.get("release_date"),
        "duration": track.get("duration"),
        "source": "Audius",
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





def artist_to_dict(artist: FavoriteArtist) -> dict:
    return {
        "artistName": artist.artist_name,
        "artworkUrl100": artist.artwork_url,
        "primaryGenreName": artist.genre,
        "source": artist.source,
        "createdAt": artist.created_at,
    }


def podcast_to_dict(podcast: FavoritePodcast) -> dict:
    return {
        "podcastId": podcast.podcast_id,
        "title": podcast.title,
        "publisher": podcast.publisher,
        "artworkUrl100": podcast.artwork_url,
        "feedUrl": podcast.feed_url,
        "genre": podcast.genre,
        "collectionViewUrl": podcast.collection_view_url,
        "trackCount": podcast.track_count,
        "createdAt": podcast.created_at,
    }


def normalize_podcast(item: dict) -> dict:
    genres = item.get("genres") or []

    return {
        "podcastId": str(item.get("collectionId") or item.get("trackId") or item.get("collectionName")),
        "title": item.get("collectionName") or item.get("trackName") or "Untitled Podcast",
        "publisher": item.get("artistName") or "Unknown Publisher",
        "artworkUrl100": item.get("artworkUrl600") or item.get("artworkUrl100") or "",
        "feedUrl": item.get("feedUrl"),
        "genre": ", ".join(genres) if genres else item.get("primaryGenreName") or "Podcast",
        "collectionViewUrl": item.get("collectionViewUrl"),
        "trackCount": item.get("trackCount"),
    }


async def fetch_podcasts(term: str, limit: int = 24) -> list[dict]:
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        response = await client.get(
            ITUNES_SEARCH_URL,
            params={
                "term": term,
                "media": "podcast",
                "entity": "podcast",
                "limit": limit,
            },
        )
        response.raise_for_status()
        data = response.json()

    return [normalize_podcast(item) for item in data.get("results", [])]


async def fetch_podcast_episodes_from_feed(feed_url: str, limit: int = 12) -> list[dict]:
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        response = await client.get(feed_url)
        response.raise_for_status()

    parsed = feedparser.parse(response.content)
    episodes = []

    for entry in parsed.entries[:limit]:
        audio_url = None

        for enclosure in entry.get("enclosures", []):
            href = enclosure.get("href")
            mime_type = enclosure.get("type", "")
            if href and ("audio" in mime_type or href.endswith((".mp3", ".m4a", ".wav", ".ogg"))):
                audio_url = href
                break

        if not audio_url:
            continue

        episodes.append({
            "episodeId": entry.get("id") or entry.get("guid") or entry.get("link") or entry.get("title"),
            "title": entry.get("title") or "Podcast Episode",
            "published": entry.get("published") or entry.get("updated"),
            "summary": entry.get("summary", "")[:280],
            "audioUrl": audio_url,
        })

    return episodes

async def fetch_audius_search(term: str, limit: int = 30) -> list[dict]:
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        response = await client.get(
            f"{AUDIOUS_API_BASE}/v1/tracks/search",
            params={
                "query": term,
                "limit": limit,
                "app_name": AUDIOUS_APP_NAME,
            },
        )
        response.raise_for_status()
        data = response.json()

    tracks = data.get("data", [])
    return [normalize_audius_track(track) for track in tracks if track.get("id")]


async def fetch_audius_trending(limit: int = 32) -> list[dict]:
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        response = await client.get(
            f"{AUDIOUS_API_BASE}/v1/tracks/trending",
            params={
                "limit": limit,
                "app_name": AUDIOUS_APP_NAME,
            },
        )
        response.raise_for_status()
        data = response.json()

    tracks = data.get("data", [])
    return [normalize_audius_track(track) for track in tracks if track.get("id")]





def build_smart_mix_plan(prompt: str) -> dict:
    text = prompt.lower().strip()

    mood_terms = {
        "workout": ["gym", "workout", "run", "running", "lift", "fitness", "training"],
        "focus": ["study", "coding", "work", "focus", "deep work", "productivity"],
        "chill": ["chill", "relax", "lofi", "calm", "sleep", "peace"],
        "party": ["party", "club", "dance", "hype", "turn up"],
        "sad": ["sad", "rain", "rainy", "heartbreak", "cry", "emotional"],
        "love": ["love", "romantic", "date", "couple"],
        "travel": ["travel", "road", "trip", "beach", "sunset", "drive"],
        "rap": ["rap", "hip hop", "trap"],
        "electronic": ["edm", "electronic", "house", "techno"],
        "rock": ["rock", "guitar", "metal"],
    }

    selected = []

    for label, keywords in mood_terms.items():
        if any(keyword in text for keyword in keywords):
            selected.append(label)

    if not selected:
        selected = ["discover"]

    search_map = {
        "workout": "workout electronic hype",
        "focus": "lofi focus instrumental",
        "chill": "chill lofi relaxing",
        "party": "party dance electronic",
        "sad": "sad acoustic emotional",
        "love": "romantic love acoustic",
        "travel": "travel sunset chill",
        "rap": "hip hop rap trap",
        "electronic": "electronic house dance",
        "rock": "rock alternative",
        "discover": prompt or "trending music",
    }

    search_terms = [search_map[item] for item in selected]
    search_term = " ".join(search_terms[:3])

    title_base = " ".join(word.capitalize() for word in selected[:2])
    title = f"{title_base} Mix" if title_base else "Smart Mix"

    return {
        "title": title,
        "searchTerm": search_term,
        "detectedSignals": selected,
        "description": f"Generated from prompt: {prompt}",
    }


def make_unique_playlist_name(db: Session, user_id: int, base_name: str) -> str:
    name = base_name.strip() or "Smart Mix"
    existing_names = {
        row.name
        for row in db.query(Playlist).filter(Playlist.user_id == user_id).all()
    }

    if name not in existing_names:
        return name

    counter = 2
    while f"{name} {counter}" in existing_names:
        counter += 1

    return f"{name} {counter}"


@app.get("/")
def root():
    return {
        "message": "SoundMix API is running",
        "health": "/health",
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "soundmix-api", "musicProvider": "Audius"}


@app.get("/api/music/stream/{track_id}")
def stream_track(track_id: str):
    return RedirectResponse(stream_url(track_id))


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
    term: str = Query(default="lofi", min_length=1),
    limit: int = Query(default=24, ge=1, le=50),
):
    songs = await fetch_audius_search(term, limit)
    return {"term": term, "count": len(songs), "songs": songs, "provider": "Audius"}


@app.get("/api/music/discover")
async def discover_music():
    try:
        songs = await fetch_audius_trending(32)
    except Exception:
        songs = await fetch_audius_search("trending music", 32)

    return {"count": len(songs), "songs": songs, "provider": "Audius"}


@app.get("/api/music/mood/{mood}")
async def mood_music(mood: str):
    mood_map = {
        "happy": "happy upbeat",
        "sad": "sad acoustic",
        "chill": "chill lofi",
        "focus": "focus instrumental",
        "workout": "workout electronic",
        "love": "romantic",
        "angry": "rock intense",
        "neutral": "chill",
        "surprise": "party upbeat",
        "fear": "calm ambient",
    }

    term = mood_map.get(mood.lower(), mood)
    songs = await fetch_audius_search(term, 30)

    return {"mood": mood, "term": term, "count": len(songs), "songs": songs, "provider": "Audius"}


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
    track_id: str,
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
        songs = await fetch_audius_trending(30)
        return {
            "source": "default",
            "message": "No listening history yet. Showing trending Audius tracks.",
            "songs": songs,
        }

    genres = [item.genre for item in history if item.genre]
    artists = [item.artist_name for item in history if item.artist_name]

    top_genre = Counter(genres).most_common(1)[0][0] if genres else ""
    top_artist = Counter(artists).most_common(1)[0][0] if artists else ""

    search_term = f"{top_genre} {top_artist}".strip() or "trending"
    songs = await fetch_audius_search(search_term, 35)

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
    track_id: str,
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



@app.post("/api/emotion/analyze")
async def analyze_emotion_music(file: UploadFile = File(...)):
    image = await read_upload_as_cv_image(file)
    emotion_result = analyze_expression_from_image(image)

    emotion = emotion_result["emotion"]
    term = EMOTION_TO_SEARCH.get(emotion, "chill lofi")
    songs = await fetch_audius_search(term, 24)

    return {
        "type": "facial-expression",
        "emotion": emotion,
        "confidence": emotion_result["confidence"],
        "faceDetected": emotion_result["faceDetected"],
        "term": term,
        "analysis": emotion_result,
        "count": len(songs),
        "songs": songs,
    }


@app.post("/api/instagram/suggest")
async def suggest_instagram_music(
    caption: str = Form(default=""),
    file: UploadFile | None = File(default=None),
):
    image = None

    if file is not None and file.filename:
        image = await read_upload_as_cv_image(file)

    vibe_result = analyze_post_vibe(image, caption)
    vibe = vibe_result["vibe"]
    term = POST_VIBE_TO_SEARCH.get(vibe, "aesthetic chill")
    songs = await fetch_audius_search(term, 18)

    return {
        "type": "instagram-post",
        "vibe": vibe,
        "term": term,
        "reason": vibe_result.get("reason"),
        "analysis": vibe_result,
        "suggestedClipSeconds": 30,
        "count": len(songs),
        "songs": songs,
    }



@app.get("/api/artists/favorites")
def get_favorite_artists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    artists = (
        db.query(FavoriteArtist)
        .filter(FavoriteArtist.user_id == current_user.id)
        .order_by(FavoriteArtist.created_at.desc())
        .all()
    )

    return {"count": len(artists), "artists": [artist_to_dict(artist) for artist in artists]}


@app.post("/api/artists/favorites")
def follow_artist(
    artist: ArtistIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = artist.artistName.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Artist name is required")

    existing = (
        db.query(FavoriteArtist)
        .filter(FavoriteArtist.user_id == current_user.id, FavoriteArtist.artist_name == name)
        .first()
    )

    if existing:
        return artist_to_dict(existing)

    favorite = FavoriteArtist(
        user_id=current_user.id,
        artist_name=name,
        artwork_url=artist.artworkUrl100,
        genre=artist.primaryGenreName,
    )

    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    return artist_to_dict(favorite)


@app.delete("/api/artists/favorites/{artist_name}")
def unfollow_artist(
    artist_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    artist = (
        db.query(FavoriteArtist)
        .filter(FavoriteArtist.user_id == current_user.id, FavoriteArtist.artist_name == artist_name)
        .first()
    )

    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    db.delete(artist)
    db.commit()

    return {"message": "Artist removed from favorites"}


@app.get("/api/artists/{artist_name}/songs")
async def artist_songs(
    artist_name: str,
    limit: int = Query(default=24, ge=1, le=50),
):
    songs = await fetch_audius_search(artist_name, limit)
    return {"artistName": artist_name, "count": len(songs), "songs": songs}


@app.get("/api/podcasts/search")
async def search_podcasts(
    term: str = Query(default="technology", min_length=1),
    limit: int = Query(default=24, ge=1, le=50),
):
    podcasts = await fetch_podcasts(term, limit)
    return {"term": term, "count": len(podcasts), "podcasts": podcasts}


@app.get("/api/podcasts/discover")
async def discover_podcasts():
    terms = ["technology", "music interviews", "startup", "fitness", "storytelling"]
    all_podcasts = []

    for term in terms:
        all_podcasts.extend(await fetch_podcasts(term, 6))

    unique = {}
    for podcast in all_podcasts:
        unique[podcast["podcastId"]] = podcast

    podcasts = list(unique.values())[:30]

    return {"count": len(podcasts), "podcasts": podcasts}


@app.get("/api/podcasts/episodes")
async def podcast_episodes(
    feed_url: str = Query(..., min_length=1),
    limit: int = Query(default=12, ge=1, le=30),
):
    episodes = await fetch_podcast_episodes_from_feed(feed_url, limit)
    return {"count": len(episodes), "episodes": episodes}


@app.get("/api/podcasts/favorites")
def get_favorite_podcasts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    podcasts = (
        db.query(FavoritePodcast)
        .filter(FavoritePodcast.user_id == current_user.id)
        .order_by(FavoritePodcast.created_at.desc())
        .all()
    )

    return {"count": len(podcasts), "podcasts": [podcast_to_dict(podcast) for podcast in podcasts]}


@app.post("/api/podcasts/favorites")
def save_favorite_podcast(
    podcast: PodcastIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(FavoritePodcast)
        .filter(FavoritePodcast.user_id == current_user.id, FavoritePodcast.podcast_id == podcast.podcastId)
        .first()
    )

    if existing:
        return podcast_to_dict(existing)

    favorite = FavoritePodcast(
        user_id=current_user.id,
        podcast_id=podcast.podcastId,
        title=podcast.title,
        publisher=podcast.publisher,
        artwork_url=podcast.artworkUrl100,
        feed_url=podcast.feedUrl,
        genre=podcast.genre,
        collection_view_url=podcast.collectionViewUrl,
        track_count=podcast.trackCount,
    )

    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    return podcast_to_dict(favorite)


@app.delete("/api/podcasts/favorites/{podcast_id}")
def remove_favorite_podcast(
    podcast_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    podcast = (
        db.query(FavoritePodcast)
        .filter(FavoritePodcast.user_id == current_user.id, FavoritePodcast.podcast_id == podcast_id)
        .first()
    )

    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    db.delete(podcast)
    db.commit()

    return {"message": "Podcast removed from favorites"}



@app.post("/api/ai-mix/generate")
async def generate_ai_mix(payload: SmartMixRequest):
    prompt = payload.prompt.strip()

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    plan = build_smart_mix_plan(prompt)
    songs = await fetch_audius_search(plan["searchTerm"], payload.limit or 24)

    return {
        "prompt": prompt,
        "title": plan["title"],
        "description": plan["description"],
        "searchTerm": plan["searchTerm"],
        "detectedSignals": plan["detectedSignals"],
        "count": len(songs),
        "songs": songs,
    }


@app.post("/api/ai-mix/create-playlist")
async def create_ai_mix_playlist(
    payload: SmartPlaylistRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompt = payload.prompt.strip()

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    plan = build_smart_mix_plan(prompt)
    songs = await fetch_audius_search(plan["searchTerm"], payload.limit or 20)

    playlist_name = make_unique_playlist_name(
        db,
        current_user.id,
        payload.name or plan["title"],
    )

    playlist = Playlist(
        user_id=current_user.id,
        name=playlist_name,
        description=payload.description or plan["description"],
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    for song in songs:
        playlist_song = PlaylistSong(
            playlist_id=playlist.id,
            track_id=str(song["trackId"]),
            track_name=song["trackName"],
            artist_name=song["artistName"],
            collection_name=song.get("collectionName"),
            artwork_url=song.get("artworkUrl100"),
            preview_url=song.get("previewUrl"),
            genre=song.get("primaryGenreName"),
        )
        db.add(playlist_song)

    db.commit()
    db.refresh(playlist)

    return {
        "message": "Smart playlist created",
        "prompt": prompt,
        "searchTerm": plan["searchTerm"],
        "detectedSignals": plan["detectedSignals"],
        "playlist": playlist_to_dict(playlist, include_songs=True),
    }


@app.get("/api/public/playlists/{playlist_id}")
def get_public_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    owner = db.query(User).filter(User.id == playlist.user_id).first()
    data = playlist_to_dict(playlist, include_songs=True)
    data["ownerId"] = playlist.user_id
    data["ownerName"] = owner.name if owner else "SoundMix User"

    return data


@app.get("/api/public/users/{user_id}/profile")
def get_public_profile(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")

    playlists = (
        db.query(Playlist)
        .filter(Playlist.user_id == user.id)
        .order_by(Playlist.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "id": user.id,
        "name": user.name,
        "joinedAt": user.created_at,
        "stats": {
            "likedSongs": db.query(FavoriteSong).filter(FavoriteSong.user_id == user.id).count(),
            "playedTracks": db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).count(),
            "playlists": db.query(Playlist).filter(Playlist.user_id == user.id).count(),
            "artists": db.query(FavoriteArtist).filter(FavoriteArtist.user_id == user.id).count(),
            "podcasts": db.query(FavoritePodcast).filter(FavoritePodcast.user_id == user.id).count(),
        },
        "playlists": [playlist_to_dict(playlist) for playlist in playlists],
    }


@app.get("/api/search/all")
async def universal_search(
    term: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    songs = await fetch_audius_search(term, 18)

    artist_map = {}
    for song in songs:
        artist_name = song.get("artistName")
        if artist_name and artist_name not in artist_map:
            artist_map[artist_name] = {
                "artistName": artist_name,
                "artworkUrl100": song.get("artworkUrl100"),
                "primaryGenreName": song.get("primaryGenreName"),
                "source": "Audius",
            }

    podcasts = await fetch_podcasts(term, 12)

    playlist_rows = (
        db.query(Playlist)
        .filter(Playlist.name.ilike(f"%{term}%"))
        .order_by(Playlist.created_at.desc())
        .limit(12)
        .all()
    )

    playlists = []
    for playlist in playlist_rows:
        owner = db.query(User).filter(User.id == playlist.user_id).first()
        item = playlist_to_dict(playlist)
        item["ownerId"] = playlist.user_id
        item["ownerName"] = owner.name if owner else "SoundMix User"
        playlists.append(item)

    return {
        "term": term,
        "songs": songs,
        "artists": list(artist_map.values())[:12],
        "podcasts": podcasts,
        "playlists": playlists,
        "counts": {
            "songs": len(songs),
            "artists": len(artist_map),
            "podcasts": len(podcasts),
            "playlists": len(playlists),
        },
    }
