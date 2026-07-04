import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Clock,
  Heart,
  LogOut,
  Music,
  Play,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { motion } from "framer-motion";

type Song = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  playCount?: number;
};

type UserType = {
  id: number;
  name: string;
  email: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const moods = ["happy", "sad", "chill", "focus", "workout", "love"];

export default function App() {
  const [query, setQuery] = useState("weeknd");
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<"discover" | "library" | "history">("discover");

  const [token, setToken] = useState(localStorage.getItem("soundmix_token") || "");
  const [user, setUser] = useState<UserType | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const favoriteIds = useMemo(() => {
    return new Set(favorites.map((song) => song.trackId));
  }, [favorites]);

  async function fetchDiscover() {
    setActiveView("discover");
    setLoading(true);
    const res = await axios.get(`${API_URL}/api/music/discover`);
    setSongs(res.data.songs);
    setLoading(false);
  }

  async function searchSongs() {
    if (!query.trim()) return;

    setActiveView("discover");
    setLoading(true);

    const res = await axios.get(`${API_URL}/api/music/search`, {
      params: { term: query, limit: 30 },
    });

    setSongs(res.data.songs);
    setLoading(false);
  }

  async function moodSearch(mood: string) {
    setActiveView("discover");
    setLoading(true);

    const res = await axios.get(`${API_URL}/api/music/mood/${mood}`);

    setSongs(res.data.songs);
    setLoading(false);
  }

  async function loadMe(savedToken: string) {
    try {
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });

      setUser(res.data);
    } catch {
      localStorage.removeItem("soundmix_token");
      setToken("");
      setUser(null);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    try {
      const url =
        authMode === "login"
          ? `${API_URL}/api/auth/login`
          : `${API_URL}/api/auth/register`;

      const payload =
        authMode === "login"
          ? { email: authEmail, password: authPassword }
          : { name: authName, email: authEmail, password: authPassword };

      const res = await axios.post(url, payload);

      localStorage.setItem("soundmix_token", res.data.access_token);
      setToken(res.data.access_token);
      setUser(res.data.user);
      setAuthPassword("");
      setAuthEmail("");
      setAuthName("");
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail || "Authentication failed");
    }
  }

  function logout() {
    localStorage.removeItem("soundmix_token");
    setToken("");
    setUser(null);
    setFavorites([]);
    setHistory([]);
  }

  async function loadFavorites() {
    if (!token) return;

    const res = await axios.get(`${API_URL}/api/library/likes`, {
      headers: authHeaders,
    });

    setFavorites(res.data.songs);
  }

  async function loadHistory() {
    if (!token) return;

    const res = await axios.get(`${API_URL}/api/history`, {
      headers: authHeaders,
    });

    setHistory(res.data.songs);
  }

  async function getRecommendations() {
    if (!token) {
      alert("Please login to get personalized recommendations.");
      return;
    }

    setActiveView("discover");
    setLoading(true);

    const res = await axios.get(`${API_URL}/api/recommendations`, {
      headers: authHeaders,
    });

    setSongs(res.data.songs);
    setLoading(false);
  }

  async function playSong(song: Song) {
    setCurrentSong(song);

    if (token) {
      await axios.post(`${API_URL}/api/history/play`, song, {
        headers: authHeaders,
      });

      loadHistory();
    }
  }

  async function toggleLike(song: Song) {
    if (!token) {
      alert("Please login to like songs.");
      return;
    }

    if (favoriteIds.has(song.trackId)) {
      await axios.delete(`${API_URL}/api/library/likes/${song.trackId}`, {
        headers: authHeaders,
      });
    } else {
      await axios.post(`${API_URL}/api/library/likes`, song, {
        headers: authHeaders,
      });
    }

    loadFavorites();
  }

  function openLibrary() {
    setActiveView("library");
    loadFavorites();
  }

  function openHistory() {
    setActiveView("history");
    loadHistory();
  }

  useEffect(() => {
    fetchDiscover();

    if (token) {
      loadMe(token);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadFavorites();
      loadHistory();
    }
  }, [token]);

  const visibleSongs =
    activeView === "library" ? favorites : activeView === "history" ? history : songs;

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={fetchDiscover} className="flex items-center gap-3 text-left">
            <div className="rounded-2xl bg-purple-500 p-3 glow">
              <Music size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">SoundMix</h1>
              <p className="text-xs text-white/50">Search, play, like, and personalize music</p>
            </div>
          </button>

          <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <button onClick={fetchDiscover} className="hover:text-white">
              Discover
            </button>
            <button onClick={getRecommendations} className="hover:text-white">
              Recommendations
            </button>
            <button onClick={openLibrary} className="hover:text-white">
              Library
            </button>
            <button onClick={openHistory} className="hover:text-white">
              History
            </button>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm md:flex">
                  <User size={16} />
                  {user.name}
                </div>
                <button
                  onClick={logout}
                  className="rounded-full border border-white/10 bg-white/10 p-3 hover:bg-white/20"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <span className="rounded-full border border-purple-400/40 bg-purple-500/20 px-4 py-2 text-sm text-purple-100">
                Guest Mode
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-700/40 via-fuchsia-600/20 to-cyan-500/20 p-8"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
              <Sparkles size={16} />
              Personalized music discovery
            </div>

            <h2 className="max-w-3xl text-5xl font-black leading-tight md:text-6xl">
              Mix your mood with the perfect sound.
            </h2>

            <p className="mt-5 max-w-2xl text-lg text-white/70">
              Search tracks, play previews, like songs, save listening history, and generate recommendations.
            </p>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl bg-black/30 p-3 md:flex-row">
              <div className="flex flex-1 items-center gap-3 rounded-xl bg-white/10 px-4">
                <Search size={20} className="text-white/60" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchSongs()}
                  className="w-full bg-transparent py-4 outline-none placeholder:text-white/40"
                  placeholder="Search songs, artists, albums..."
                />
              </div>
              <button
                onClick={searchSongs}
                className="rounded-xl bg-white px-6 py-4 font-bold text-black transition hover:scale-[1.02]"
              >
                Search
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6"
          >
            {user ? (
              <>
                <h3 className="mb-1 text-xl font-bold">Your SoundMix</h3>
                <p className="mb-5 text-sm text-white/50">
                  {favorites.length} liked songs · {history.length} recently played
                </p>

                <div className="grid gap-3">
                  <button
                    onClick={getRecommendations}
                    className="rounded-2xl bg-purple-500 px-5 py-4 text-left font-bold transition hover:bg-purple-400"
                  >
                    Generate Recommendations
                    <p className="mt-1 text-xs font-normal text-white/70">
                      Based on your listening history
                    </p>
                  </button>

                  <button
                    onClick={openLibrary}
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-left font-bold transition hover:bg-white/20"
                  >
                    Open Library
                    <p className="mt-1 text-xs font-normal text-white/50">
                      View liked songs
                    </p>
                  </button>

                  <button
                    onClick={openHistory}
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-left font-bold transition hover:bg-white/20"
                  >
                    Listening History
                    <p className="mt-1 text-xs font-normal text-white/50">
                      View recently played songs
                    </p>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleAuthSubmit}>
                <h3 className="mb-1 text-xl font-bold">
                  {authMode === "login" ? "Login" : "Create Account"}
                </h3>
                <p className="mb-5 text-sm text-white/50">
                  Login to save likes, history, and recommendations.
                </p>

                {authMode === "register" && (
                  <input
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
                    placeholder="Name"
                    required
                  />
                )}

                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
                  placeholder="Email"
                  type="email"
                  required
                />

                <input
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
                  placeholder="Password"
                  type="password"
                  required
                />

                {authError && <p className="mb-3 text-sm text-red-300">{authError}</p>}

                <button className="w-full rounded-xl bg-purple-500 px-5 py-3 font-bold hover:bg-purple-400">
                  {authMode === "login" ? "Login" : "Register"}
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                  className="mt-4 w-full text-sm text-white/60 hover:text-white"
                >
                  {authMode === "login"
                    ? "Need an account? Register"
                    : "Already have an account? Login"}
                </button>
              </form>
            )}
          </motion.div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h3 className="mb-4 text-lg font-bold">Mood Mix</h3>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {moods.map((mood) => (
              <button
                key={mood}
                onClick={() => moodSearch(mood)}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-left font-bold capitalize transition hover:bg-purple-500/40"
              >
                {mood}
                <p className="mt-1 text-xs font-normal text-white/50">Mood tracks</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">
              {activeView === "library"
                ? "Liked Songs"
                : activeView === "history"
                  ? "Listening History"
                  : "Recommended Tracks"}
            </h2>

            <button onClick={fetchDiscover} className="text-sm text-purple-300">
              Refresh discover
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
              Loading music...
            </div>
          ) : visibleSongs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
              No songs found here yet.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visibleSongs.map((song) => (
                <motion.div
                  key={`${song.trackId}-${song.trackName}`}
                  whileHover={{ y: -6 }}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <img
                      src={song.artworkUrl100}
                      alt={song.trackName}
                      className="h-56 w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                    <button
                      onClick={() => playSong(song)}
                      className="absolute bottom-3 right-3 rounded-full bg-purple-500 p-4 shadow-xl transition hover:scale-110"
                    >
                      <Play size={20} fill="white" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <h3 className="truncate font-bold">{song.trackName}</h3>
                    <p className="truncate text-sm text-white/60">{song.artistName}</p>
                    <p className="mt-2 text-xs text-white/40">
                      {song.primaryGenreName || "Music"}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => toggleLike(song)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                        favoriteIds.has(song.trackId)
                          ? "border-pink-400/40 bg-pink-500/20 text-pink-200"
                          : "border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <Heart size={16} fill={favoriteIds.has(song.trackId) ? "currentColor" : "none"} />
                      {favoriteIds.has(song.trackId) ? "Liked" : "Like"}
                    </button>

                    {song.playCount && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Clock size={14} />
                        {song.playCount}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-black/80 px-6 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 md:flex-row">
            <img
              src={currentSong.artworkUrl100}
              alt={currentSong.trackName}
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-bold">{currentSong.trackName}</h3>
              <p className="text-sm text-white/60">{currentSong.artistName}</p>
            </div>
            <audio controls autoPlay src={currentSong.previewUrl} className="w-full md:w-[420px]" />
          </div>
        </div>
      )}
    </div>
  );
}
