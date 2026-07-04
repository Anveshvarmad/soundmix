import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Clock,
  Compass,
  Headphones,
  Heart,
  History,
  Home,
  Library,
  LogOut,
  Music,
  Play,
  Radio,
  Search,
  Sparkles,
  User,
  Waves,
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

type View = "discover" | "mood" | "library" | "history" | "profile";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const moods = [
  { id: "happy", title: "Happy", text: "Bright pop songs", emoji: "😊" },
  { id: "sad", title: "Sad", text: "Soft emotional tracks", emoji: "🌧️" },
  { id: "chill", title: "Chill", text: "Relaxed late night mix", emoji: "🌙" },
  { id: "focus", title: "Focus", text: "Instrumental work flow", emoji: "🎧" },
  { id: "workout", title: "Workout", text: "High energy music", emoji: "⚡" },
  { id: "love", title: "Love", text: "Romantic favorites", emoji: "💜" },
];

const navItems: { id: View; label: string; icon: any }[] = [
  { id: "discover", label: "Discover", icon: Home },
  { id: "mood", label: "Mood Mix", icon: Radio },
  { id: "library", label: "Library", icon: Library },
  { id: "history", label: "History", icon: History },
  { id: "profile", label: "Profile", icon: User },
];

export default function App() {
  const [query, setQuery] = useState("weeknd");
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<View>("discover");

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

  const visibleSongs =
    activeView === "library" ? favorites : activeView === "history" ? history : songs;

  async function fetchDiscover() {
    setActiveView("discover");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/music/discover`);
      setSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
  }

  async function searchSongs() {
    if (!query.trim()) return;

    setActiveView("discover");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/music/search`, {
        params: { term: query, limit: 30 },
      });

      setSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
  }

  async function moodSearch(mood: string) {
    setActiveView("discover");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/music/mood/${mood}`);
      setSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
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
      setActiveView("profile");
      return;
    }

    setActiveView("discover");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/recommendations`, {
        headers: authHeaders,
      });

      setSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
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
      setActiveView("profile");
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

  function changeView(view: View) {
    if (view === "library") {
      openLibrary();
      return;
    }

    if (view === "history") {
      openHistory();
      return;
    }

    setActiveView(view);
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

  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-white/10 bg-black/50 p-5 backdrop-blur-xl lg:block">
        <button onClick={fetchDiscover} className="mb-10 flex items-center gap-3">
          <div className="rounded-2xl bg-purple-500 p-3 glow">
            <Music size={25} />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black">SoundMix</h1>
            <p className="text-xs text-white/45">Music intelligence app</p>
          </div>
        </button>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => changeView(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  active
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span className="font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-5 right-5 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <Headphones size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">{user ? user.name : "Guest User"}</p>
              <p className="text-xs text-white/45">
                {user ? "Personalized mode" : "Login to save music"}
              </p>
            </div>
          </div>

          {user ? (
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"
            >
              <LogOut size={16} />
              Logout
            </button>
          ) : (
            <button
              onClick={() => setActiveView("profile")}
              className="w-full rounded-xl bg-purple-500 px-4 py-3 text-sm font-bold hover:bg-purple-400"
            >
              Login / Register
            </button>
          )}
        </div>
      </aside>

      <main className="w-full lg:ml-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/35 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm text-purple-200">
                <Waves size={16} />
                Full-stack music recommendation system
              </p>
              <h2 className="text-2xl font-black md:text-3xl">
                {activeView === "discover" && "Discover Music"}
                {activeView === "mood" && "Mood Mix"}
                {activeView === "library" && "Your Library"}
                {activeView === "history" && "Listening History"}
                {activeView === "profile" && "Profile"}
              </h2>
            </div>

            <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4">
              <Search size={20} className="text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchSongs()}
                placeholder="Search songs, artists, albums..."
                className="w-full bg-transparent py-4 outline-none placeholder:text-white/35"
              />
              <button
                onClick={searchSongs}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-purple-100"
              >
                Search
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-8 pb-36">
          {activeView === "discover" && (
            <>
              <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-700/50 via-fuchsia-600/25 to-cyan-500/20 p-8"
                >
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    <Sparkles size={16} />
                    Smart discovery powered by your taste
                  </div>

                  <h1 className="max-w-3xl text-5xl font-black leading-tight md:text-7xl">
                    Mix your mood with the perfect sound.
                  </h1>

                  <p className="mt-5 max-w-2xl text-lg text-white/70">
                    Search tracks, play previews, like songs, track listening history, and generate personalized recommendations.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      onClick={getRecommendations}
                      className="rounded-2xl bg-white px-6 py-4 font-black text-black transition hover:scale-[1.02]"
                    >
                      Generate Recommendations
                    </button>
                    <button
                      onClick={() => setActiveView("mood")}
                      className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 font-black text-white transition hover:bg-white/20"
                    >
                      Explore Mood Mix
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="card-glass rounded-[2rem] p-6"
                >
                  <h3 className="mb-5 text-xl font-black">Your Stats</h3>

                  <div className="space-y-4">
                    <StatCard label="Liked Songs" value={favorites.length} icon={<Heart size={20} />} />
                    <StatCard label="Played Tracks" value={history.length} icon={<Clock size={20} />} />
                    <StatCard label="Mode" value={user ? "Personal" : "Guest"} icon={<User size={20} />} />
                  </div>
                </motion.div>
              </section>

              <SongsSection
                title="Recommended Tracks"
                loading={loading}
                songs={visibleSongs}
                favoriteIds={favoriteIds}
                onPlay={playSong}
                onLike={toggleLike}
              />
            </>
          )}

          {activeView === "mood" && (
            <section>
              <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                <p className="mb-2 flex items-center gap-2 text-sm text-purple-200">
                  <Compass size={16} />
                  Choose a feeling
                </p>
                <h1 className="text-4xl font-black md:text-6xl">Emotion-based discovery</h1>
                <p className="mt-4 max-w-2xl text-white/60">
                  Select a mood and SoundMix will fetch music that matches that emotional vibe.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {moods.map((mood) => (
                  <motion.button
                    key={mood.id}
                    whileHover={{ y: -6 }}
                    onClick={() => moodSearch(mood.id)}
                    className="rounded-[2rem] border border-white/10 bg-white/5 p-7 text-left transition hover:bg-purple-500/30"
                  >
                    <div className="mb-5 text-5xl">{mood.emoji}</div>
                    <h3 className="text-2xl font-black">{mood.title}</h3>
                    <p className="mt-2 text-white/55">{mood.text}</p>
                  </motion.button>
                ))}
              </div>
            </section>
          )}

          {activeView === "library" && (
            <SongsSection
              title="Liked Songs"
              emptyText="You have not liked any songs yet."
              loading={loading}
              songs={visibleSongs}
              favoriteIds={favoriteIds}
              onPlay={playSong}
              onLike={toggleLike}
            />
          )}

          {activeView === "history" && (
            <SongsSection
              title="Recently Played"
              emptyText="Play a song to build your listening history."
              loading={loading}
              songs={visibleSongs}
              favoriteIds={favoriteIds}
              onPlay={playSong}
              onLike={toggleLike}
            />
          )}

          {activeView === "profile" && (
            <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="card-glass rounded-[2rem] p-7">
                {user ? (
                  <>
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-500 text-3xl font-black">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-3xl font-black">{user.name}</h2>
                    <p className="mt-1 text-white/55">{user.email}</p>

                    <div className="mt-8 grid gap-4">
                      <StatCard label="Liked Songs" value={favorites.length} icon={<Heart size={20} />} />
                      <StatCard label="Listening History" value={history.length} icon={<History size={20} />} />
                    </div>

                    <button
                      onClick={logout}
                      className="mt-8 w-full rounded-2xl bg-white px-5 py-4 font-black text-black"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <AuthForm
                    authMode={authMode}
                    authName={authName}
                    authEmail={authEmail}
                    authPassword={authPassword}
                    authError={authError}
                    setAuthMode={setAuthMode}
                    setAuthName={setAuthName}
                    setAuthEmail={setAuthEmail}
                    setAuthPassword={setAuthPassword}
                    handleAuthSubmit={handleAuthSubmit}
                  />
                )}
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-700/30 to-cyan-500/10 p-8">
                <h2 className="text-4xl font-black">Why login?</h2>
                <div className="mt-6 grid gap-4">
                  <Feature text="Save liked songs to your personal library." />
                  <Feature text="Store listening history in PostgreSQL." />
                  <Feature text="Generate recommendations from your music activity." />
                  <Feature text="Keep the same project flow as the original SoundMix idea with modern architecture." />
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/85 px-5 py-4 backdrop-blur-xl lg:left-72">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 md:flex-row">
            <img
              src={currentSong.artworkUrl100 || ""}
              alt={currentSong.trackName}
              className="h-16 w-16 rounded-2xl object-cover"
            />

            <div className="min-w-0 flex-1 text-center md:text-left">
              <h3 className="truncate font-black">{currentSong.trackName}</h3>
              <p className="truncate text-sm text-white/55">{currentSong.artistName}</p>
            </div>

            <audio controls autoPlay src={currentSong.previewUrl} className="w-full md:w-[460px]" />
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-white/10 bg-black/90 py-2 backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => changeView(item.id)}
              className={`flex flex-col items-center gap-1 text-xs ${
                active ? "text-purple-300" : "text-white/45"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-sm text-white/45">{label}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
      <div className="rounded-2xl bg-white/10 p-3 text-purple-200">{icon}</div>
    </div>
  );
}

function SongsSection({
  title,
  emptyText = "No songs found.",
  loading,
  songs,
  favoriteIds,
  onPlay,
  onLike,
}: {
  title: string;
  emptyText?: string;
  loading: boolean;
  songs: Song[];
  favoriteIds: Set<number>;
  onPlay: (song: Song) => void;
  onLike: (song: Song) => void;
}) {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-3xl font-black">{title}</h2>
        <p className="text-sm text-white/40">{songs.length} tracks</p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-12 text-center text-white/60">
          Loading music...
        </div>
      ) : songs.length === 0 ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-12 text-center text-white/60">
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {songs.map((song) => (
            <motion.div
              key={`${song.trackId}-${song.trackName}`}
              whileHover={{ y: -6 }}
              className="group rounded-[1.8rem] border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
            >
              <div className="relative overflow-hidden rounded-[1.4rem] bg-white/5">
                <img
                  src={song.artworkUrl100 || ""}
                  alt={song.trackName}
                  className="h-56 w-full object-cover transition duration-500 group-hover:scale-110"
                />

                <button
                  onClick={() => onPlay(song)}
                  className="absolute bottom-3 right-3 rounded-full bg-purple-500 p-4 shadow-xl transition hover:scale-110"
                >
                  <Play size={20} fill="white" />
                </button>
              </div>

              <div className="mt-4">
                <h3 className="truncate font-black">{song.trackName}</h3>
                <p className="truncate text-sm text-white/60">{song.artistName}</p>
                <p className="mt-2 truncate text-xs text-white/35">
                  {song.primaryGenreName || song.collectionName || "Music"}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => onLike(song)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                    favoriteIds.has(song.trackId)
                      ? "border-pink-400/40 bg-pink-500/20 text-pink-200"
                      : "border-white/10 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <Heart
                    size={16}
                    fill={favoriteIds.has(song.trackId) ? "currentColor" : "none"}
                  />
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
  );
}

function AuthForm({
  authMode,
  authName,
  authEmail,
  authPassword,
  authError,
  setAuthMode,
  setAuthName,
  setAuthEmail,
  setAuthPassword,
  handleAuthSubmit,
}: {
  authMode: "login" | "register";
  authName: string;
  authEmail: string;
  authPassword: string;
  authError: string;
  setAuthMode: (mode: "login" | "register") => void;
  setAuthName: (value: string) => void;
  setAuthEmail: (value: string) => void;
  setAuthPassword: (value: string) => void;
  handleAuthSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={handleAuthSubmit}>
      <h2 className="text-3xl font-black">
        {authMode === "login" ? "Welcome Back" : "Create Account"}
      </h2>
      <p className="mt-2 text-white/50">
        Login to save likes, history, and recommendations.
      </p>

      <div className="mt-7 space-y-3">
        {authMode === "register" && (
          <input
            value={authName}
            onChange={(e) => setAuthName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
            placeholder="Name"
            required
          />
        )}

        <input
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
          placeholder="Email"
          type="email"
          required
        />

        <input
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
          placeholder="Password"
          type="password"
          required
        />
      </div>

      {authError && <p className="mt-4 text-sm text-red-300">{authError}</p>}

      <button className="mt-5 w-full rounded-2xl bg-purple-500 px-5 py-4 font-black hover:bg-purple-400">
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
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
      <p className="text-white/75">{text}</p>
    </div>
  );
}
