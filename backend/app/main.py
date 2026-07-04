from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

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


@app.get("/health")
def health():
    return {"status": "ok", "service": "soundmix-api"}


@app.get("/api/music/search")
async def search_music(
    term: str = Query(default="weeknd", min_length=1),
    limit: int = Query(default=24, ge=1, le=50),
):
    params = {
        "term": term,
        "media": "music",
        "entity": "song",
        "limit": limit,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(ITUNES_SEARCH_URL, params=params)
        response.raise_for_status()
        data = response.json()

    songs = [normalize_song(item) for item in data.get("results", []) if item.get("previewUrl")]
    return {"term": term, "count": len(songs), "songs": songs}


@app.get("/api/music/discover")
async def discover_music():
    terms = ["pop hits", "hip hop", "lofi", "edm", "indie"]
    songs = []

    async with httpx.AsyncClient(timeout=20) as client:
        for term in terms:
            response = await client.get(
                ITUNES_SEARCH_URL,
                params={"term": term, "media": "music", "entity": "song", "limit": 8},
            )
            response.raise_for_status()
            data = response.json()
            songs.extend(
                normalize_song(item)
                for item in data.get("results", [])
                if item.get("previewUrl")
            )

    return {"count": len(songs), "songs": songs[:32]}


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

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            ITUNES_SEARCH_URL,
            params={"term": term, "media": "music", "entity": "song", "limit": 30},
        )
        response.raise_for_status()
        data = response.json()

    songs = [normalize_song(item) for item in data.get("results", []) if item.get("previewUrl")]
    return {"mood": mood, "term": term, "count": len(songs), "songs": songs}
