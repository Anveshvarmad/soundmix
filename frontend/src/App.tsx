import { useEffect, useState } from "react";
import axios from "axios";
import { Music, Search, Heart, Play, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type Song = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const moods = ["happy", "sad", "chill", "focus", "workout", "love"];

export default function App() {
  const [query, setQuery] = useState("weeknd");
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchDiscover() {
    setLoading(true);
    const res = await axios.get(`${API_URL}/api/music/discover`);
    setSongs(res.data.songs);
    setLoading(false);
  }

  async function searchSongs() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await axios.get(`${API_URL}/api/music/search`, {
      params: { term: query, limit: 30 }
    });
    setSongs(res.data.songs);
    setLoading(false);
  }

  async function moodSearch(mood: string) {
    setLoading(true);
    const res = await axios.get(`${API_URL}/api/music/mood/${mood}`);
    setSongs(res.data.songs);
    setLoading(false);
  }

  useEffect(() => {
    fetchDiscover();
  }, []);

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500 p-3 glow">
              <Music size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">SoundMix</h1>
              <p className="text-xs text-white/50">Discover music by search, mood, and taste</p>
            </div>
          </div>

          <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <span>Discover</span>
            <span>Mood Mix</span>
            <span>Library</span>
            <span>History</span>
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
              AI-style music discovery
            </div>

            <h2 className="max-w-3xl text-5xl font-black leading-tight md:text-6xl">
              Mix your mood with the perfect sound.
            </h2>

            <p className="mt-5 max-w-2xl text-lg text-white/70">
              Search tracks, play previews, explore moods, and build a smarter music recommendation system.
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
            <h3 className="mb-4 text-xl font-bold">Mood Mix</h3>
            <div className="grid grid-cols-2 gap-3">
              {moods.map((mood) => (
                <button
                  key={mood}
                  onClick={() => moodSearch(mood)}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-5 text-left font-bold capitalize transition hover:bg-purple-500/40"
                >
                  {mood}
                  <p className="mt-1 text-xs font-normal text-white/50">Generate {mood} tracks</p>
                </button>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">Recommended Tracks</h2>
            <button onClick={fetchDiscover} className="text-sm text-purple-300">
              Refresh discover
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
              Loading music...
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {songs.map((song) => (
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
                      onClick={() => setCurrentSong(song)}
                      className="absolute bottom-3 right-3 rounded-full bg-purple-500 p-4 shadow-xl transition hover:scale-110"
                    >
                      <Play size={20} fill="white" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <h3 className="line-clamp-1 font-bold">{song.trackName}</h3>
                    <p className="line-clamp-1 text-sm text-white/60">{song.artistName}</p>
                    <p className="mt-2 text-xs text-white/40">{song.primaryGenreName}</p>
                  </div>

                  <button className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10">
                    <Heart size={16} />
                    Like
                  </button>
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
