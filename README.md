# SoundMix

SoundMix is a full-stack music discovery and recommendation platform built with a modern Spotify-style experience.

Users can search and play full tracks, create playlists, follow favorite artists, explore podcasts, generate smart mixes, and get music recommendations based on mood, facial expression, and Instagram-style post images.

Live Demo: https://soundmix-hazel.vercel.app/

---

## Overview

SoundMix started from the core idea of a music recommendation app: user login, song search, music playback, listening history, and emotion-based recommendations. The updated version keeps those main features and expands them into a modern full-stack product with Docker, authentication, PostgreSQL, external APIs, public sharing, and a dynamic music player.

---

## Key Features

### Music Discovery
- Search full tracks
- Discover trending songs
- Play music directly in the browser
- View recently played songs
- Like and save songs
- Generate personalized recommendations

### Spotify-Style Player
- Fixed bottom music player
- Queue system
- Add to queue
- Play next
- Previous / next controls
- Shuffle
- Repeat all / repeat one
- Up Next panel
- Continuous listening flow

### Smart Mix Generator
Users can type a natural language prompt and SoundMix creates a playable music mix.

Example prompts:

```text
create a gym playlist for evening workouts
make a beach sunset travel mix
sad acoustic rainy night songs
focus music for coding and studying
party dance music for friends
```

Smart Mix can:
- Generate tracks from a prompt
- Start playing the first song automatically
- Save the generated mix as a playlist

### Mood-Based Recommendations
SoundMix supports mood-based music discovery.

Available moods:
- Happy
- Sad
- Chill
- Focus
- Workout
- Love

### Facial Expression Music
Users can upload a face image, and SoundMix recommends songs based on the detected expression.

Supported expression flow:
- Upload image
- Backend analyzes image using OpenCV and Pillow
- Emotion is detected
- Emotion is mapped to a music mood
- Matching songs are fetched and played

Example emotion mapping:

```text
happy    -> upbeat / dance music
sad      -> acoustic / emotional music
angry    -> intense / rock / workout music
neutral  -> chill / lofi music
surprise -> party / upbeat music
fear     -> calm / ambient music
```

### Instagram Post Music Suggestions
Users can upload an Instagram-style image and optionally add a caption or hashtags.

SoundMix detects the post vibe and suggests music suitable for short social clips.

Example:

```text
beach sunset with friends #travel
```

Possible vibes:
- Travel
- Beach
- Fitness
- Food
- Party
- Romantic
- Study
- Aesthetic
- Calm
- Happy

### Playlists
- Create custom playlists
- Add songs to playlists
- Remove songs from playlists
- Open playlist details
- Delete playlists
- Generate smart playlists
- Share public playlist links

### Favorite Artists
- Follow artists from song cards
- View favorite artists
- Discover more songs from an artist
- Start artist radio
- View top artists from listening history

### Podcasts
- Search podcasts
- Discover podcasts
- Save favorite podcasts
- Load podcast episodes from RSS feeds
- Play available podcast audio episodes

### Unified Search
Search once and view results across:
- Songs
- Artists
- Podcasts
- Public playlists

### Public Sharing
- Share public playlist links
- Share public user profile
- Open public playlists without logging in
- View public profile stats
- View public user playlists

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Axios
- Lucide React Icons

### Backend
- FastAPI
- Python
- SQLAlchemy
- JWT Authentication
- PostgreSQL
- OpenCV
- Pillow
- Feedparser
- Python Multipart

### Database
- PostgreSQL
- Neon PostgreSQL for production

### APIs and External Services
- Audius API for full-track music search and streaming
- iTunes Search API for podcast discovery
- Podcast RSS feeds for playable podcast episodes

### DevOps and Deployment
- Docker
- Docker Compose
- Render for backend deployment
- Vercel for frontend deployment
- Neon for database hosting

---

## Architecture

SoundMix uses a full-stack architecture with a React frontend, FastAPI backend, PostgreSQL database, and external APIs for music and podcast discovery.

```mermaid
flowchart TD
    A[User Browser] --> B[React + TypeScript Frontend]
    B --> C[FastAPI Backend]

    C --> D[Neon PostgreSQL Database]
    C --> E[Audius Music API]
    C --> F[iTunes Podcast Search API]
    C --> G[Podcast RSS Feeds]

    B --> H[Browser Music Player]
    B --> I[Face Mix Upload]
    B --> J[Instagram Post Music Upload]

    I --> C
    J --> C

    C --> K[OpenCV + Pillow Image Analysis]
    K --> L[Emotion / Vibe Detection]
    L --> E

    D --> M[Users]
    D --> N[Liked Songs]
    D --> O[Listening History]
    D --> P[Playlists]
    D --> Q[Favorite Artists]
    D --> R[Favorite Podcasts]

    E --> S[Full Track Streaming]
    F --> T[Podcast Metadata]
    G --> U[Podcast Episode Audio]
```

---

## Deployment Architecture

```mermaid
flowchart LR
    A[User] --> B[Vercel Frontend]

    B --> C[Render Backend]

    C --> D[Neon PostgreSQL]
    C --> E[Audius API]
    C --> F[iTunes Podcast API]
    C --> G[Podcast RSS Feeds]

    B --> H[Browser Audio Player]
```

---

## Main Application Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    participant Audius

    User->>Frontend: Login / Register
    Frontend->>Backend: Auth request
    Backend->>Database: Store or validate user
    Backend-->>Frontend: JWT token

    User->>Frontend: Search or discover music
    Frontend->>Backend: Music API request
    Backend->>Audius: Fetch songs
    Audius-->>Backend: Song data and stream URLs
    Backend-->>Frontend: Songs returned

    User->>Frontend: Play song
    Frontend->>Backend: Save listening history
    Backend->>Database: Store play activity

    User->>Frontend: Like song / create playlist
    Frontend->>Backend: Save library action
    Backend->>Database: Persist user music data
```

---

## Emotion Recommendation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant ImageEngine
    participant Audius

    User->>Frontend: Upload face image
    Frontend->>Backend: Send image file
    Backend->>ImageEngine: Analyze expression
    ImageEngine-->>Backend: Detected emotion
    Backend->>Audius: Search songs by emotion mood
    Audius-->>Backend: Matching tracks
    Backend-->>Frontend: Recommended songs
    Frontend-->>User: Plays matching music
```

---

## Instagram Post Music Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant ImageEngine
    participant Audius

    User->>Frontend: Upload post image and caption
    Frontend->>Backend: Send image and caption
    Backend->>ImageEngine: Analyze image colors and caption keywords
    ImageEngine-->>Backend: Detected post vibe
    Backend->>Audius: Search songs by post vibe
    Audius-->>Backend: Matching tracks
    Backend-->>Frontend: Post-ready song suggestions
```

---

## Database Design

```mermaid
erDiagram
    USERS ||--o{ FAVORITE_SONGS : saves
    USERS ||--o{ LISTENING_HISTORY : plays
    USERS ||--o{ PLAYLISTS : creates
    USERS ||--o{ FAVORITE_ARTISTS : follows
    USERS ||--o{ FAVORITE_PODCASTS : saves

    PLAYLISTS ||--o{ PLAYLIST_SONGS : contains

    USERS {
        int id
        string name
        string email
        string hashed_password
        datetime created_at
    }

    FAVORITE_SONGS {
        int id
        int user_id
        string track_id
        string track_name
        string artist_name
        string artwork_url
        string preview_url
        string genre
        datetime created_at
    }

    LISTENING_HISTORY {
        int id
        int user_id
        string track_id
        string track_name
        string artist_name
        string artwork_url
        string preview_url
        string genre
        int play_count
        datetime last_played
    }

    PLAYLISTS {
        int id
        int user_id
        string name
        string description
        datetime created_at
    }

    PLAYLIST_SONGS {
        int id
        int playlist_id
        string track_id
        string track_name
        string artist_name
        string artwork_url
        string preview_url
        string genre
        datetime added_at
    }

    FAVORITE_ARTISTS {
        int id
        int user_id
        string artist_name
        string artwork_url
        string genre
        string source
        datetime created_at
    }

    FAVORITE_PODCASTS {
        int id
        int user_id
        string podcast_id
        string title
        string publisher
        string artwork_url
        string feed_url
        string genre
        int track_count
        datetime created_at
    }
```

---

## Folder Structure

```text
soundmix/
  backend/
    app/
      main.py
      models.py
      schemas.py
      database.py
      auth.py
    Dockerfile
    requirements.txt
    .env.example

  frontend/
    src/
      App.tsx
      main.tsx
      index.css
      vite-env.d.ts
    Dockerfile
    package.json
    vite.config.ts
    tsconfig.json
    vercel.json
    .env.example

  docker-compose.yml
  README.md
```

---

## Run Locally with Docker

Clone the repository:

```bash
git clone https://github.com/Anveshvarmad/soundmix.git
cd soundmix
```

Start the full-stack app:

```bash
docker compose up --build
```

Open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
API Docs: http://localhost:8000/docs
Health:   http://localhost:8000/health
```

Stop containers:

```bash
docker compose down
```

Reset local database:

```bash
docker compose down -v
docker compose up --build
```

---

## Run Without Docker

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on:

```text
http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

## Environment Variables

### Backend

Create `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/soundmix?sslmode=require
CORS_ORIGINS=http://localhost:5173
SECRET_KEY=replace-with-a-long-random-secret
AUDIOUS_API_BASE=https://api.audius.co
AUDIOUS_APP_NAME=soundmix
```

For local Docker, the database URL is handled inside `docker-compose.yml`.

For production, use the Neon PostgreSQL connection string.

### Frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

For production:

```env
VITE_API_URL=https://soundmix-backend.onrender.com
```

---

## API Endpoints

### Root

```text
GET /
GET /health
GET /docs
```

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Music

```text
GET /api/music/search
GET /api/music/discover
GET /api/music/mood/{mood}
GET /api/music/stream/{track_id}
GET /api/recommendations
```

### Library

```text
GET    /api/library/likes
POST   /api/library/likes
DELETE /api/library/likes/{track_id}
```

### Listening History

```text
POST /api/history/play
GET  /api/history
```

### Playlists

```text
GET    /api/playlists
POST   /api/playlists
GET    /api/playlists/{playlist_id}
PATCH  /api/playlists/{playlist_id}
DELETE /api/playlists/{playlist_id}
POST   /api/playlists/{playlist_id}/songs
DELETE /api/playlists/{playlist_id}/songs/{track_id}
```

### Smart Mix

```text
POST /api/ai-mix/generate
POST /api/ai-mix/create-playlist
```

### Emotion and Post Music

```text
POST /api/emotion/analyze
POST /api/instagram/suggest
```

### Artists

```text
GET    /api/artists/favorites
POST   /api/artists/favorites
DELETE /api/artists/favorites/{artist_name}
GET    /api/artists/{artist_name}/songs
```

### Podcasts

```text
GET    /api/podcasts/search
GET    /api/podcasts/discover
GET    /api/podcasts/episodes
GET    /api/podcasts/favorites
POST   /api/podcasts/favorites
DELETE /api/podcasts/favorites/{podcast_id}
```

### Public Sharing

```text
GET /api/public/playlists/{playlist_id}
GET /api/public/users/{user_id}/profile
```

### Unified Search

```text
GET /api/search/all
```

---

## Deployment

### Frontend

Frontend is deployed on Vercel:

```text
https://soundmix-hazel.vercel.app/
```

Vercel settings:

```text
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Production frontend environment variable:

```env
VITE_API_URL=https://soundmix-backend.onrender.com
```

### Backend

Backend is deployed on Render:

```text
https://soundmix-backend.onrender.com
```

Render settings:

```text
Runtime: Docker
Root Directory: backend
Plan: Free
```

Production backend environment variables:

```env
DATABASE_URL=your_neon_connection_string
CORS_ORIGINS=http://localhost:5173,https://soundmix-hazel.vercel.app
SECRET_KEY=your_secret_key
AUDIOUS_API_BASE=https://api.audius.co
AUDIOUS_APP_NAME=soundmix
```

### Database

Production database is hosted on Neon PostgreSQL.

Use the pooled Neon connection string for `DATABASE_URL`.





## Author

Built by Anvesh Varma Dantuluri.

---
