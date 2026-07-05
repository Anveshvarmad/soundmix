import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Camera,
  Clock,
  Compass,
  Headphones,
  Heart,
  History,
  Home,
  ImagePlus,
  Library,
  ListMusic,
  ListPlus,
  LogOut,
  Mic2,
  Music,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Plus,
  Radio,
  Rss,
  Search,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  User,
  UserRoundPlus,
  Waves,
} from "lucide-react";
import { motion } from "framer-motion";

type Song = {
  trackId: string;
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

type Playlist = {
  id: number;
  name: string;
  description?: string;
  songCount: number;
  createdAt?: string;
  songs?: Song[];
};

type Artist = {
  artistName: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  source?: string;
};

type Podcast = {
  podcastId: string;
  title: string;
  publisher?: string;
  artworkUrl100?: string;
  feedUrl?: string;
  genre?: string;
  collectionViewUrl?: string;
  trackCount?: number;
};

type PodcastEpisode = {
  episodeId: string;
  title: string;
  published?: string;
  summary?: string;
  audioUrl: string;
};

type View =
  | "discover"
  | "mood"
  | "expression"
  | "instagram"
  | "artists"
  | "podcasts"
  | "library"
  | "history"
  | "playlists"
  | "profile";

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
  { id: "mood", label: "Mood", icon: Radio },
  { id: "expression", label: "Face", icon: Camera },
  { id: "instagram", label: "Post", icon: ImagePlus },
  { id: "artists", label: "Artists", icon: Mic2 },
  { id: "podcasts", label: "Podcasts", icon: Rss },
  { id: "library", label: "Library", icon: Library },
  { id: "history", label: "History", icon: History },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "profile", label: "Profile", icon: User },
];

export default function App() {
  const [query, setQuery] = useState("lofi");
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const [favoriteArtists, setFavoriteArtists] = useState<Artist[]>([]);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [selectedArtist, setSelectedArtist] = useState("");

  const [podcastQuery, setPodcastQuery] = useState("technology");
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [favoritePodcasts, setFavoritePodcasts] = useState<Podcast[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [podcastEpisodes, setPodcastEpisodes] = useState<PodcastEpisode[]>([]);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [showQueue, setShowQueue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<View>("discover");

  const [token, setToken] = useState(localStorage.getItem("soundmix_token") || "");
  const [user, setUser] = useState<UserType | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [playlistMessage, setPlaylistMessage] = useState("");

  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState("");
  const [faceResult, setFaceResult] = useState<any>(null);
  const [faceSongs, setFaceSongs] = useState<Song[]>([]);

  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postResult, setPostResult] = useState<any>(null);
  const [postSongs, setPostSongs] = useState<Song[]>([]);

  const [smartPrompt, setSmartPrompt] = useState("create a late night coding playlist with chill focus music");
  const [smartResult, setSmartResult] = useState<any>(null);
  const [smartMessage, setSmartMessage] = useState("");

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const favoriteIds = useMemo(() => new Set(favorites.map((song) => song.trackId)), [favorites]);
  const favoriteArtistNames = useMemo(
    () => new Set(favoriteArtists.map((artist) => artist.artistName)),
    [favoriteArtists]
  );
  const favoritePodcastIds = useMemo(
    () => new Set(favoritePodcasts.map((podcast) => podcast.podcastId)),
    [favoritePodcasts]
  );

  const topArtistsFromHistory = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach((song) => counts.set(song.artistName, (counts.get(song.artistName) || 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([artistName, count]) => ({ artistName, count }));
  }, [history]);

  const visibleSongs =
    activeView === "library" ? favorites : activeView === "history" ? history : songs;

  async function generateSmartMix(e?: FormEvent) {
    if (e) {
      e.preventDefault();
    }

    if (!smartPrompt.trim()) {
      alert("Enter a playlist idea first.");
      return;
    }

    setActiveView("discover");
    setLoading(true);
    setSmartMessage("");

    try {
      const res = await axios.post(`${API_URL}/api/ai-mix/generate`, {
        prompt: smartPrompt,
        limit: 28,
      });

      setSmartResult(res.data);
      setSongs(res.data.songs || []);

      if (res.data.songs?.length) {
        setQueue(res.data.songs);
        setCurrentQueueIndex(0);
        await playSong(res.data.songs[0], res.data.songs, 0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createSmartPlaylist() {
    if (!token) {
      setActiveView("profile");
      return;
    }

    if (!smartPrompt.trim()) {
      alert("Enter a playlist idea first.");
      return;
    }

    setSmartMessage("Creating playlist...");

    try {
      const res = await axios.post(
        `${API_URL}/api/ai-mix/create-playlist`,
        {
          prompt: smartPrompt,
          name: smartResult?.title || "Smart Mix",
          description: smartResult?.description || `Generated from: ${smartPrompt}`,
          limit: 20,
        },
        { headers: authHeaders }
      );

      setSmartMessage(`Created playlist: ${res.data.playlist.name}`);
      await loadPlaylists();
      setSelectedPlaylist(res.data.playlist);
    } catch (err: any) {
      setSmartMessage(err?.response?.data?.detail || "Could not create playlist.");
    }
  }

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

  async function playDailyMix(term: string) {
    setActiveView("discover");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/music/search`, {
        params: { term, limit: 30 },
      });

      const mixSongs = res.data.songs || [];
      setSongs(mixSongs);
      setQueue(mixSongs);
      setCurrentQueueIndex(0);

      if (mixSongs.length > 0) {
        await playSong(mixSongs[0], mixSongs, 0);
      }
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

  async function handleAuthSubmit(e: FormEvent) {
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
    setPlaylists([]);
    setFavoriteArtists([]);
    setFavoritePodcasts([]);
    setSelectedPlaylist(null);
  }

  async function loadFavorites() {
    if (!token) return;
    const res = await axios.get(`${API_URL}/api/library/likes`, { headers: authHeaders });
    setFavorites(res.data.songs);
  }

  async function loadHistory() {
    if (!token) return;
    const res = await axios.get(`${API_URL}/api/history`, { headers: authHeaders });
    setHistory(res.data.songs);
  }

  async function loadPlaylists() {
    if (!token) return;
    const res = await axios.get(`${API_URL}/api/playlists`, { headers: authHeaders });
    setPlaylists(res.data.playlists);
  }

  async function loadFavoriteArtists() {
    if (!token) return;
    const res = await axios.get(`${API_URL}/api/artists/favorites`, { headers: authHeaders });
    setFavoriteArtists(res.data.artists);
  }

  async function toggleArtist(song: Song) {
    if (!token) {
      setActiveView("profile");
      return;
    }

    if (favoriteArtistNames.has(song.artistName)) {
      await axios.delete(`${API_URL}/api/artists/favorites/${encodeURIComponent(song.artistName)}`, {
        headers: authHeaders,
      });
    } else {
      await axios.post(
        `${API_URL}/api/artists/favorites`,
        {
          artistName: song.artistName,
          artworkUrl100: song.artworkUrl100,
          primaryGenreName: song.primaryGenreName,
        },
        { headers: authHeaders }
      );
    }

    loadFavoriteArtists();
  }

  async function openArtist(artistName: string) {
    setSelectedArtist(artistName);
    setActiveView("artists");
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/artists/${encodeURIComponent(artistName)}/songs`);
      setArtistSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
  }

  async function loadPodcasts() {
    setActiveView("podcasts");
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/podcasts/discover`);
      setPodcasts(res.data.podcasts);
    } finally {
      setLoading(false);
    }
  }

  async function searchPodcasts() {
    if (!podcastQuery.trim()) return;
    setActiveView("podcasts");
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/podcasts/search`, {
        params: { term: podcastQuery, limit: 30 },
      });
      setPodcasts(res.data.podcasts);
    } finally {
      setLoading(false);
    }
  }

  async function loadFavoritePodcasts() {
    if (!token) return;
    const res = await axios.get(`${API_URL}/api/podcasts/favorites`, { headers: authHeaders });
    setFavoritePodcasts(res.data.podcasts);
  }

  async function togglePodcast(podcast: Podcast) {
    if (!token) {
      setActiveView("profile");
      return;
    }

    if (favoritePodcastIds.has(podcast.podcastId)) {
      await axios.delete(`${API_URL}/api/podcasts/favorites/${podcast.podcastId}`, {
        headers: authHeaders,
      });
    } else {
      await axios.post(`${API_URL}/api/podcasts/favorites`, podcast, { headers: authHeaders });
    }

    loadFavoritePodcasts();
  }

  async function openPodcast(podcast: Podcast) {
    setSelectedPodcast(podcast);
    setPodcastEpisodes([]);

    if (!podcast.feedUrl) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/podcasts/episodes`, {
        params: { feed_url: podcast.feedUrl, limit: 12 },
      });
      setPodcastEpisodes(res.data.episodes);
    } finally {
      setLoading(false);
    }
  }

  async function openPlaylist(playlistId: number) {
    const res = await axios.get(`${API_URL}/api/playlists/${playlistId}`, { headers: authHeaders });
    setSelectedPlaylist(res.data);
  }

  async function createPlaylist(e: FormEvent) {
    e.preventDefault();

    if (!token) {
      setActiveView("profile");
      return;
    }

    setPlaylistMessage("");

    try {
      const res = await axios.post(
        `${API_URL}/api/playlists`,
        { name: playlistName, description: playlistDescription },
        { headers: authHeaders }
      );

      setPlaylistName("");
      setPlaylistDescription("");
      setPlaylistMessage("Playlist created successfully.");
      await loadPlaylists();
      setSelectedPlaylist(res.data);
    } catch (err: any) {
      setPlaylistMessage(err?.response?.data?.detail || "Could not create playlist.");
    }
  }

  async function deletePlaylist(playlistId: number) {
    await axios.delete(`${API_URL}/api/playlists/${playlistId}`, { headers: authHeaders });
    setSelectedPlaylist(null);
    await loadPlaylists();
  }

  async function addToPlaylist(song: Song, playlistId: number) {
    if (!token) {
      setActiveView("profile");
      return;
    }

    await axios.post(`${API_URL}/api/playlists/${playlistId}/songs`, song, {
      headers: authHeaders,
    });

    await loadPlaylists();

    if (selectedPlaylist?.id === playlistId) {
      await openPlaylist(playlistId);
    }
  }

  async function removeFromPlaylist(playlistId: number, trackId: string) {
    await axios.delete(`${API_URL}/api/playlists/${playlistId}/songs/${trackId}`, {
      headers: authHeaders,
    });

    await loadPlaylists();
    await openPlaylist(playlistId);
  }

  async function getRecommendations() {
    if (!token) {
      setActiveView("profile");
      return;
    }

    setActiveView("discover");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/recommendations`, { headers: authHeaders });
      setSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
  }

  function getActiveSongContext() {
    if (activeView === "library") return favorites;
    if (activeView === "history") return history;
    if (activeView === "artists") return artistSongs;
    if (activeView === "expression") return faceSongs;
    if (activeView === "instagram") return postSongs;
    return songs;
  }

  async function recordPlay(song: Song) {
    if (token && !song.trackId.startsWith("podcast-")) {
      await axios.post(`${API_URL}/api/history/play`, song, { headers: authHeaders });
      loadHistory();
    }
  }

  async function playSong(song: Song, context?: Song[], forcedIndex?: number) {
    setCurrentSong(song);

    if (song.trackId.startsWith("podcast-")) {
      setQueue([song]);
      setCurrentQueueIndex(0);
      return;
    }

    const activeContext = context && context.length > 0 ? context : getActiveSongContext();
    const nextQueue = activeContext && activeContext.length > 0 ? activeContext : [song];

    const detectedIndex =
      typeof forcedIndex === "number"
        ? forcedIndex
        : nextQueue.findIndex((item) => item.trackId === song.trackId);

    setQueue(nextQueue);
    setCurrentQueueIndex(detectedIndex >= 0 ? detectedIndex : 0);

    await recordPlay(song);
  }

  function addToQueue(song: Song) {
    setQueue((prev) => {
      const alreadyQueued = prev.some((item) => item.trackId === song.trackId);

      if (alreadyQueued) {
        return prev;
      }

      if (prev.length === 0 && currentSong) {
        return [currentSong, song];
      }

      return [...prev, song];
    });

    setShowQueue(true);
  }

  function playNextSong(song: Song) {
    setQueue((prev) => {
      const baseQueue = prev.length > 0 ? prev : currentSong ? [currentSong] : [];
      const currentIndex = baseQueue.findIndex((item) => item.trackId === currentSong?.trackId);
      const insertIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

      const withoutDuplicate = baseQueue.filter((item) => item.trackId !== song.trackId);
      return [
        ...withoutDuplicate.slice(0, insertIndex),
        song,
        ...withoutDuplicate.slice(insertIndex),
      ];
    });

    setShowQueue(true);
  }

  async function playNext() {
    if (queue.length === 0) return;

    if (shuffleEnabled && queue.length > 1) {
      let randomIndex = Math.floor(Math.random() * queue.length);

      if (randomIndex === currentQueueIndex) {
        randomIndex = (randomIndex + 1) % queue.length;
      }

      await playSong(queue[randomIndex], queue, randomIndex);
      return;
    }

    let nextIndex = currentQueueIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeatMode === "all") {
        nextIndex = 0;
      } else {
        return;
      }
    }

    await playSong(queue[nextIndex], queue, nextIndex);
  }

  async function playPrevious() {
    if (queue.length === 0) return;

    let previousIndex = currentQueueIndex - 1;

    if (previousIndex < 0) {
      previousIndex = repeatMode === "all" ? queue.length - 1 : 0;
    }

    await playSong(queue[previousIndex], queue, previousIndex);
  }

  function toggleRepeatMode() {
    setRepeatMode((current) => {
      if (current === "off") return "all";
      if (current === "all") return "one";
      return "off";
    });
  }

  async function startArtistRadio(artistName: string) {
    setSelectedArtist(artistName);
    setActiveView("artists");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/artists/${encodeURIComponent(artistName)}/songs`);
      const radioSongs = res.data.songs || [];

      setArtistSongs(radioSongs);
      setQueue(radioSongs);
      setCurrentQueueIndex(0);

      if (radioSongs.length > 0) {
        await playSong(radioSongs[0], radioSongs, 0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike(song: Song) {
    if (!token) {
      setActiveView("profile");
      return;
    }

    if (favoriteIds.has(song.trackId)) {
      await axios.delete(`${API_URL}/api/library/likes/${song.trackId}`, { headers: authHeaders });
    } else {
      await axios.post(`${API_URL}/api/library/likes`, song, { headers: authHeaders });
    }

    loadFavorites();
  }

  function playPodcastEpisode(episode: PodcastEpisode) {
    playSong({
      trackId: `podcast-${episode.episodeId}`,
      trackName: episode.title,
      artistName: selectedPodcast?.publisher || selectedPodcast?.title || "Podcast",
      collectionName: selectedPodcast?.title,
      artworkUrl100: selectedPodcast?.artworkUrl100,
      previewUrl: episode.audioUrl,
      primaryGenreName: "Podcast",
    });
  }

  function handleFaceFile(file: File | null) {
    setFaceFile(file);
    setFaceResult(null);
    setFaceSongs([]);
    setFacePreview(file ? URL.createObjectURL(file) : "");
  }

  function handlePostFile(file: File | null) {
    setPostFile(file);
    setPostResult(null);
    setPostSongs([]);
    setPostPreview(file ? URL.createObjectURL(file) : "");
  }

  async function analyzeExpression(e: FormEvent) {
    e.preventDefault();

    if (!faceFile) {
      alert("Please upload a face image first.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", faceFile);

      const res = await axios.post(`${API_URL}/api/emotion/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFaceResult(res.data);
      setFaceSongs(res.data.songs);

      if (res.data.songs?.length) {
        playSong(res.data.songs[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function suggestInstagramMusic(e: FormEvent) {
    e.preventDefault();

    if (!postFile && !postCaption.trim()) {
      alert("Upload a post image or enter a caption.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      if (postFile) {
        formData.append("file", postFile);
      }

      formData.append("caption", postCaption);

      const res = await axios.post(`${API_URL}/api/instagram/suggest`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostResult(res.data);
      setPostSongs(res.data.songs);
    } finally {
      setLoading(false);
    }
  }

  function changeView(view: View) {
    if (view === "library") {
      setActiveView("library");
      loadFavorites();
      return;
    }

    if (view === "history") {
      setActiveView("history");
      loadHistory();
      return;
    }

    if (view === "playlists") {
      setActiveView("playlists");
      loadPlaylists();
      return;
    }

    if (view === "artists") {
      setActiveView("artists");
      loadFavoriteArtists();
      return;
    }

    if (view === "podcasts") {
      loadPodcasts();
      loadFavoritePodcasts();
      return;
    }

    setActiveView(view);
  }

  useEffect(() => {
    fetchDiscover();
    if (token) loadMe(token);
  }, []);

  useEffect(() => {
    if (token) {
      loadFavorites();
      loadHistory();
      loadPlaylists();
      loadFavoriteArtists();
      loadFavoritePodcasts();
    }
  }, [token]);

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed left-[20%] top-[-10%] h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[10%] right-[-5%] h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-white/10 bg-black/50 p-5 backdrop-blur-xl lg:block">
        <button onClick={fetchDiscover} className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl bg-purple-500 p-3 glow">
            <Music size={25} />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black">SoundMix</h1>
            <p className="text-xs text-white/45">Music + emotion engine</p>
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

      <main className="relative z-10 w-full lg:ml-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/35 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm text-purple-200">
                <Waves size={16} />
                Full-stack SoundMix experience
              </p>
              <h2 className="text-2xl font-black md:text-3xl">
                {titleForView(activeView)}
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
              <Hero
                favorites={favorites.length}
                history={history.length}
                artists={favoriteArtists.length}
                podcasts={favoritePodcasts.length}
                playlists={playlists.length}
                user={user}
                onRecommendations={getRecommendations}
                onMood={() => setActiveView("mood")}
              />

              <DailyMixes onPick={playDailyMix} />

              <SmartMixBuilder
                prompt={smartPrompt}
                result={smartResult}
                message={smartMessage}
                loading={loading}
                onPrompt={setSmartPrompt}
                onGenerate={generateSmartMix}
                onCreatePlaylist={createSmartPlaylist}
              />

              <LiveFlow />

              <SongsSection
                title="Recommended Tracks"
                loading={loading}
                songs={visibleSongs}
                playlists={playlists}
                favoriteIds={favoriteIds}
                favoriteArtistNames={favoriteArtistNames}
                onPlay={playSong}
                onLike={toggleLike}
                onAddToPlaylist={addToPlaylist}
                onToggleArtist={toggleArtist}
                onOpenArtist={openArtist}
                onAddToQueue={addToQueue}
                onPlayNext={playNextSong}
                onStartRadio={startArtistRadio}
              />
            </>
          )}

          {activeView === "mood" && (
            <MoodPage moods={moods} moodSearch={moodSearch} />
          )}

          {activeView === "expression" && (
            <ImageMusicPage
              mode="face"
              loading={loading}
              preview={facePreview}
              result={faceResult}
              songs={faceSongs}
              playlists={playlists}
              favoriteIds={favoriteIds}
              favoriteArtistNames={favoriteArtistNames}
              onFile={handleFaceFile}
              onSubmit={analyzeExpression}
              onPlay={playSong}
              onLike={toggleLike}
              onAddToPlaylist={addToPlaylist}
              onToggleArtist={toggleArtist}
              onOpenArtist={openArtist}
              onAddToQueue={addToQueue}
              onPlayNext={playNextSong}
              onStartRadio={startArtistRadio}
            />
          )}

          {activeView === "instagram" && (
            <InstagramMusicPage
              loading={loading}
              preview={postPreview}
              caption={postCaption}
              result={postResult}
              songs={postSongs}
              playlists={playlists}
              favoriteIds={favoriteIds}
              favoriteArtistNames={favoriteArtistNames}
              onFile={handlePostFile}
              onCaption={setPostCaption}
              onSubmit={suggestInstagramMusic}
              onPlay={playSong}
              onLike={toggleLike}
              onAddToPlaylist={addToPlaylist}
              onToggleArtist={toggleArtist}
              onOpenArtist={openArtist}
              onAddToQueue={addToQueue}
              onPlayNext={playNextSong}
              onStartRadio={startArtistRadio}
            />
          )}

          {activeView === "artists" && (
            <ArtistsPage
              favoriteArtists={favoriteArtists}
              selectedArtist={selectedArtist}
              artistSongs={artistSongs}
              topArtistsFromHistory={topArtistsFromHistory}
              loading={loading}
              playlists={playlists}
              favoriteIds={favoriteIds}
              favoriteArtistNames={favoriteArtistNames}
              onOpenArtist={openArtist}
              onPlay={playSong}
              onLike={toggleLike}
              onAddToPlaylist={addToPlaylist}
              onToggleArtist={toggleArtist}
            />
          )}

          {activeView === "podcasts" && (
            <PodcastsPage
              loading={loading}
              podcastQuery={podcastQuery}
              podcasts={podcasts}
              favoritePodcasts={favoritePodcasts}
              favoritePodcastIds={favoritePodcastIds}
              selectedPodcast={selectedPodcast}
              episodes={podcastEpisodes}
              onQuery={setPodcastQuery}
              onSearch={searchPodcasts}
              onOpenPodcast={openPodcast}
              onTogglePodcast={togglePodcast}
              onPlayEpisode={playPodcastEpisode}
            />
          )}

          {activeView === "library" && (
            <SongsSection
              title="Liked Songs"
              emptyText="You have not liked any songs yet."
              loading={loading}
              songs={visibleSongs}
              playlists={playlists}
              favoriteIds={favoriteIds}
              favoriteArtistNames={favoriteArtistNames}
              onPlay={playSong}
              onLike={toggleLike}
              onAddToPlaylist={addToPlaylist}
              onToggleArtist={toggleArtist}
              onOpenArtist={openArtist}
              onAddToQueue={addToQueue}
              onPlayNext={playNextSong}
              onStartRadio={startArtistRadio}
            />
          )}

          {activeView === "history" && (
            <SongsSection
              title="Recently Played"
              emptyText="Play a song to build your listening history."
              loading={loading}
              songs={visibleSongs}
              playlists={playlists}
              favoriteIds={favoriteIds}
              favoriteArtistNames={favoriteArtistNames}
              onPlay={playSong}
              onLike={toggleLike}
              onAddToPlaylist={addToPlaylist}
              onToggleArtist={toggleArtist}
              onOpenArtist={openArtist}
              onAddToQueue={addToQueue}
              onPlayNext={playNextSong}
              onStartRadio={startArtistRadio}
            />
          )}

          {activeView === "playlists" && (
            <PlaylistsPage
              user={user}
              playlists={playlists}
              selectedPlaylist={selectedPlaylist}
              playlistName={playlistName}
              playlistDescription={playlistDescription}
              playlistMessage={playlistMessage}
              onName={setPlaylistName}
              onDescription={setPlaylistDescription}
              onCreate={createPlaylist}
              onOpenPlaylist={openPlaylist}
              onDeletePlaylist={deletePlaylist}
              onRemoveSong={removeFromPlaylist}
              onPlay={playSong}
              onProfile={() => setActiveView("profile")}
            />
          )}

          {activeView === "profile" && (
            <ProfilePage
              user={user}
              favorites={favorites.length}
              history={history.length}
              artists={favoriteArtists.length}
              podcasts={favoritePodcasts.length}
              playlists={playlists.length}
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
              logout={logout}
            />
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

            <div className="flex w-full flex-col gap-3 md:w-[540px]">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShuffleEnabled((value) => !value)}
                  className={`rounded-xl border px-3 py-2 ${
                    shuffleEnabled
                      ? "border-purple-400 bg-purple-500/20 text-purple-100"
                      : "border-white/10 bg-white/10 text-white/60"
                  }`}
                  title="Shuffle"
                >
                  <Shuffle size={17} />
                </button>

                <button
                  onClick={playPrevious}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
                  title="Previous"
                >
                  <SkipBack size={17} />
                </button>

                <button
                  onClick={playNext}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
                  title="Next"
                >
                  <SkipForward size={17} />
                </button>

                <button
                  onClick={toggleRepeatMode}
                  className={`rounded-xl border px-3 py-2 ${
                    repeatMode !== "off"
                      ? "border-purple-400 bg-purple-500/20 text-purple-100"
                      : "border-white/10 bg-white/10 text-white/60"
                  }`}
                  title="Repeat"
                >
                  <Repeat size={17} />
                  {repeatMode === "one" && <span className="ml-1 text-[10px] font-black">1</span>}
                </button>

                <button
                  onClick={() => setShowQueue((value) => !value)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
                  title="Queue"
                >
                  <ListMusic size={17} />
                </button>
              </div>

              <audio
                controls
                autoPlay
                loop={repeatMode === "one"}
                src={currentSong.previewUrl}
                onEnded={() => {
                  if (repeatMode !== "one") {
                    playNext();
                  }
                }}
                className="w-full"
              />

              {showQueue && (
                <div className="max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-black">Up Next</p>
                    <p className="text-xs text-white/40">{queue.length} tracks</p>
                  </div>

                  {queue.length === 0 ? (
                    <p className="text-sm text-white/45">Queue is empty.</p>
                  ) : (
                    <div className="space-y-2">
                      {queue.map((song, index) => (
                        <button
                          key={`${song.trackId}-${index}`}
                          onClick={() => playSong(song, queue, index)}
                          className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/10 ${
                            index === currentQueueIndex ? "bg-purple-500/20" : "bg-white/5"
                          }`}
                        >
                          <img
                            src={song.artworkUrl100 || ""}
                            alt={song.trackName}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{song.trackName}</p>
                            <p className="truncate text-xs text-white/45">{song.artistName}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-10 border-t border-white/10 bg-black/90 py-2 backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => changeView(item.id)}
              className={`flex flex-col items-center gap-1 text-[9px] ${
                active ? "text-purple-300" : "text-white/45"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function titleForView(view: View) {
  const titles: Record<View, string> = {
    discover: "Discover Music",
    mood: "Mood Mix",
    expression: "Face Expression Mix",
    instagram: "Instagram Post Music",
    artists: "Favorite Artists",
    podcasts: "Podcasts",
    library: "Your Library",
    history: "Listening History",
    playlists: "Playlists",
    profile: "Profile",
  };

  return titles[view];
}

function Hero({
  favorites,
  history,
  artists,
  podcasts,
  playlists,
  user,
  onRecommendations,
  onMood,
}: {
  favorites: number;
  history: number;
  artists: number;
  podcasts: number;
  playlists: number;
  user: UserType | null;
  onRecommendations: () => void;
  onMood: () => void;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-700/55 via-fuchsia-600/25 to-cyan-500/20 p-8"
      >
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
          <Sparkles size={16} />
          Live music flow powered by your taste
        </div>

        <h1 className="max-w-3xl text-5xl font-black leading-tight md:text-7xl">
          Your sound, your mood, your mix.
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-white/70">
          Search full tracks, follow artists, play podcasts, create playlists, and get music from your face expression or Instagram post vibe.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={onRecommendations}
            className="rounded-2xl bg-white px-6 py-4 font-black text-black transition hover:scale-[1.02]"
          >
            Generate Recommendations
          </button>
          <button
            onClick={onMood}
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
        <h3 className="mb-5 text-xl font-black">Your Pulse</h3>
        <div className="space-y-4">
          <StatCard label="Liked Songs" value={favorites} icon={<Heart size={20} />} />
          <StatCard label="Played Tracks" value={history} icon={<Clock size={20} />} />
          <StatCard label="Favorite Artists" value={artists} icon={<Mic2 size={20} />} />
          <StatCard label="Podcasts" value={podcasts} icon={<Rss size={20} />} />
          <StatCard label="Playlists" value={playlists} icon={<ListMusic size={20} />} />
          <StatCard label="Mode" value={user ? "Personal" : "Guest"} icon={<User size={20} />} />
        </div>
      </motion.div>
    </section>
  );
}

function LiveFlow() {
  const steps = [
    { title: "Search", text: "Find full Audius tracks.", icon: <Search size={20} /> },
    { title: "React", text: "Like songs and follow artists.", icon: <Heart size={20} /> },
    { title: "Analyze", text: "Use face and post images.", icon: <Camera size={20} /> },
    { title: "Mix", text: "Create playlists and play podcasts.", icon: <Waves size={20} /> },
  ];

  return (
    <section className="mt-8 grid gap-4 md:grid-cols-4">
      {steps.map((step, index) => (
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5"
        >
          <div className="mb-4 inline-flex rounded-2xl bg-purple-500/20 p-3 text-purple-200">
            {step.icon}
          </div>
          <h3 className="font-black">{step.title}</h3>
          <p className="mt-1 text-sm text-white/50">{step.text}</p>
        </motion.div>
      ))}
    </section>
  );
}



function SmartMixBuilder({
  prompt,
  result,
  message,
  loading,
  onPrompt,
  onGenerate,
  onCreatePlaylist,
}: {
  prompt: string;
  result: any;
  message: string;
  loading: boolean;
  onPrompt: (value: string) => void;
  onGenerate: (e?: FormEvent) => void;
  onCreatePlaylist: () => void;
}) {
  const examples = [
    "create a gym playlist for evening workouts",
    "make a beach sunset travel mix",
    "sad acoustic rainy night songs",
    "party dance music for friends",
    "focus music for coding and studying",
  ];

  return (
    <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-purple-500/10 to-cyan-400/10 p-7">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-purple-100">
            <Sparkles size={16} />
            Smart Playlist Generator
          </div>

          <h2 className="text-4xl font-black">Tell SoundMix what you want to hear.</h2>

          <p className="mt-3 text-white/55">
            Type a vibe, moment, activity, or emotion. SoundMix creates a playable mix and can save it as a playlist.
          </p>

          <form onSubmit={onGenerate} className="mt-6">
            <textarea
              value={prompt}
              onChange={(e) => onPrompt(e.target.value)}
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 outline-none placeholder:text-white/35"
              placeholder="Example: create a late night coding playlist with chill focus music"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                disabled={loading}
                className="rounded-2xl bg-white px-6 py-4 font-black text-black transition hover:scale-[1.02] disabled:opacity-60"
              >
                {loading ? "Generating..." : "Generate Mix"}
              </button>

              <button
                type="button"
                onClick={onCreatePlaylist}
                className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 font-black text-white transition hover:bg-white/20"
              >
                Save as Playlist
              </button>
            </div>
          </form>

          {message && (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-purple-100">
              {message}
            </p>
          )}
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-black/25 p-5">
          <h3 className="text-xl font-black">Prompt ideas</h3>

          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => onPrompt(example)}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-purple-500/30 hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>

          {result ? (
            <div className="mt-6 rounded-2xl border border-purple-400/20 bg-purple-500/10 p-5">
              <p className="text-sm text-white/45">Generated Mix</p>
              <h3 className="mt-1 text-3xl font-black">{result.title}</h3>
              <p className="mt-2 text-sm text-white/55">
                Search term: <span className="text-purple-200">{result.searchTerm}</span>
              </p>
              <p className="mt-2 text-sm text-white/55">
                Detected signals: {result.detectedSignals?.join(", ")}
              </p>
              <p className="mt-2 text-sm text-white/55">
                {result.count} tracks found
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-white/45">
              Your generated mix summary will appear here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DailyMixes({ onPick }: { onPick: (term: string) => void }) {
  const mixes = [
    {
      title: "Daily Mix 01",
      subtitle: "Lofi, chill, focus",
      term: "lofi chill focus",
      gradient: "from-purple-600/40 to-cyan-500/20",
    },
    {
      title: "Daily Mix 02",
      subtitle: "Workout energy",
      term: "workout electronic hype",
      gradient: "from-orange-600/40 to-pink-500/20",
    },
    {
      title: "Daily Mix 03",
      subtitle: "Late night drive",
      term: "night drive synthwave",
      gradient: "from-blue-600/40 to-purple-500/20",
    },
    {
      title: "Artist Radio",
      subtitle: "Fresh discovery",
      term: "trending indie electronic",
      gradient: "from-emerald-600/40 to-cyan-500/20",
    },
  ];

  return (
    <section className="mt-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black">Made For You</h2>
          <p className="text-sm text-white/45">Daily mixes, radio, and continuous listening</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {mixes.map((mix, index) => (
          <motion.button
            key={mix.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            onClick={() => onPick(mix.term)}
            className={`rounded-[1.6rem] border border-white/10 bg-gradient-to-br ${mix.gradient} p-5 text-left transition hover:-translate-y-1 hover:bg-white/10`}
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <Waves size={24} />
            </div>
            <h3 className="text-xl font-black">{mix.title}</h3>
            <p className="mt-1 text-sm text-white/55">{mix.subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-black">
              <Play size={14} fill="black" />
              Play Mix
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function MoodPage({ moods, moodSearch }: { moods: any[]; moodSearch: (mood: string) => void }) {
  return (
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
  );
}

function ImageMusicPage(props: any) {
  return (
    <section>
      <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-700/35 to-cyan-500/10 p-8">
        <p className="mb-2 flex items-center gap-2 text-sm text-purple-200">
          <Camera size={16} />
          Upload a selfie or face image
        </p>
        <h1 className="text-4xl font-black md:text-6xl">Facial Expression Music</h1>
        <p className="mt-4 max-w-2xl text-white/60">
          SoundMix detects the visible expression and instantly starts a matching track.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={props.onSubmit} className="card-glass rounded-[2rem] p-7">
          <h2 className="text-3xl font-black">Analyze Emotion</h2>
          <p className="mt-2 text-white/50">Upload a clear face image.</p>

          <UploadBox preview={props.preview} onFile={props.onFile} label="Click to upload face image" />

          <button className="mt-5 w-full rounded-2xl bg-purple-500 px-5 py-4 font-black hover:bg-purple-400">
            Detect Expression & Play Music
          </button>

          {props.result && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-white/45">Detected Emotion</p>
              <h3 className="mt-1 text-3xl font-black capitalize">{props.result.emotion}</h3>
              <p className="mt-2 text-sm text-white/55">
                Confidence: {Math.round((props.result.confidence || 0) * 100)}%
              </p>
            </div>
          )}
        </form>

        <SongsSection
          title="Expression Recommendations"
          emptyText="Upload an image to generate expression-based songs."
          {...props}
        />
      </div>
    </section>
  );
}

function InstagramMusicPage(props: any) {
  return (
    <section>
      <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-pink-700/35 to-purple-500/10 p-8">
        <p className="mb-2 flex items-center gap-2 text-sm text-pink-200">
          <ImagePlus size={16} />
          Upload post image + caption
        </p>
        <h1 className="text-4xl font-black md:text-6xl">Instagram Post Music</h1>
        <p className="mt-4 max-w-2xl text-white/60">
          Detect the post vibe and suggest songs that work for short social clips.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={props.onSubmit} className="card-glass rounded-[2rem] p-7">
          <h2 className="text-3xl font-black">Suggest Post Music</h2>
          <p className="mt-2 text-white/50">Great for travel, gym, food, aesthetic, sunset, or party posts.</p>

          <UploadBox preview={props.preview} onFile={props.onFile} label="Click to upload post image" />

          <textarea
            value={props.caption}
            onChange={(e) => props.onCaption(e.target.value)}
            className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
            placeholder="Caption / hashtags example: beach sunset with friends #travel"
          />

          <button className="mt-5 w-full rounded-2xl bg-pink-500 px-5 py-4 font-black hover:bg-pink-400">
            Suggest Instagram Music
          </button>

          {props.result && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-white/45">Detected Post Vibe</p>
              <h3 className="mt-1 text-3xl font-black capitalize">{props.result.vibe}</h3>
              <p className="mt-2 text-sm text-white/55">{props.result.reason}</p>
              <p className="mt-1 text-sm text-pink-200">Suggested clip: first 30 seconds</p>
            </div>
          )}
        </form>

        <SongsSection
          title="Post-Ready Music"
          emptyText="Upload a post image or caption to get music suggestions."
          {...props}
        />
      </div>
    </section>
  );
}

function UploadBox({ preview, onFile, label }: { preview: string; onFile: (file: File | null) => void; label: string }) {
  return (
    <label className="mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/20 bg-white/5 p-6 text-center hover:bg-white/10">
      {preview ? (
        <img src={preview} alt="Preview" className="max-h-72 rounded-3xl object-cover" />
      ) : (
        <>
          <UploadCloud size={42} className="mb-4 text-purple-200" />
          <p className="font-bold">{label}</p>
          <p className="mt-1 text-sm text-white/40">PNG, JPG, JPEG under 6MB</p>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}

function ArtistsPage(props: any) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="space-y-6">
        <div className="card-glass rounded-[2rem] p-7">
          <h2 className="text-3xl font-black">Favorite Artists</h2>
          <p className="mt-2 text-white/50">Follow artists from any song card and discover more from them.</p>

          <div className="mt-6 space-y-3">
            {props.favoriteArtists.length === 0 ? (
              <p className="text-white/45">No favorite artists yet.</p>
            ) : (
              props.favoriteArtists.map((artist: Artist) => (
                <button
                  key={artist.artistName}
                  onClick={() => props.onOpenArtist(artist.artistName)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
                >
                  <img src={artist.artworkUrl100 || ""} className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-black">{artist.artistName}</h3>
                    <p className="truncate text-sm text-white/45">{artist.primaryGenreName || "Artist"}</p>
                  </div>
                  <Star size={18} className="text-purple-200" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card-glass rounded-[2rem] p-7">
          <h2 className="text-2xl font-black">Top From History</h2>
          <div className="mt-5 space-y-3">
            {props.topArtistsFromHistory.length === 0 ? (
              <p className="text-white/45">Play songs to build top artists.</p>
            ) : (
              props.topArtistsFromHistory.map((artist: any) => (
                <button
                  key={artist.artistName}
                  onClick={() => props.onOpenArtist(artist.artistName)}
                  className="flex w-full items-center justify-between rounded-2xl bg-white/5 p-4 hover:bg-white/10"
                >
                  <span className="font-bold">{artist.artistName}</span>
                  <span className="text-sm text-white/45">{artist.count} plays</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <SongsSection
        title={props.selectedArtist ? `${props.selectedArtist} Tracks` : "Artist Tracks"}
        emptyText="Select a favorite artist or play songs to discover artist-based tracks."
        {...props}
        songs={props.artistSongs}
      />
    </section>
  );
}

function PodcastsPage({
  loading,
  podcastQuery,
  podcasts,
  favoritePodcasts,
  favoritePodcastIds,
  selectedPodcast,
  episodes,
  onQuery,
  onSearch,
  onOpenPodcast,
  onTogglePodcast,
  onPlayEpisode,
}: any) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div>
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/10 p-7">
          <h1 className="text-4xl font-black">Podcast Discovery</h1>
          <p className="mt-2 text-white/55">Search podcasts, save favorites, and play available RSS audio episodes.</p>

          <div className="mt-6 flex gap-3 rounded-2xl bg-black/30 p-3">
            <input
              value={podcastQuery}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="w-full bg-transparent px-3 outline-none"
              placeholder="Search podcasts..."
            />
            <button onClick={onSearch} className="rounded-xl bg-white px-5 py-3 font-black text-black">
              Search
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/50">Loading podcasts...</div>
          ) : (
            podcasts.map((podcast: Podcast) => (
              <motion.div
                key={podcast.podcastId}
                whileHover={{ y: -5 }}
                className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4"
              >
                <img src={podcast.artworkUrl100 || ""} className="h-44 w-full rounded-2xl object-cover" />
                <h3 className="mt-4 line-clamp-2 font-black">{podcast.title}</h3>
                <p className="mt-1 truncate text-sm text-white/50">{podcast.publisher}</p>
                <p className="mt-2 truncate text-xs text-purple-200">{podcast.genre}</p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => onOpenPodcast(podcast)}
                    className="flex-1 rounded-xl bg-purple-500 px-4 py-3 text-sm font-black"
                  >
                    Episodes
                  </button>
                  <button
                    onClick={() => onTogglePodcast(podcast)}
                    className={`rounded-xl border px-4 py-3 text-sm font-black ${
                      favoritePodcastIds.has(podcast.podcastId)
                        ? "border-pink-400/40 bg-pink-500/20 text-pink-200"
                        : "border-white/10 bg-white/10"
                    }`}
                  >
                    <Heart size={16} fill={favoritePodcastIds.has(podcast.podcastId) ? "currentColor" : "none"} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card-glass rounded-[2rem] p-7">
          <h2 className="text-2xl font-black">Favorite Podcasts</h2>
          <div className="mt-5 space-y-3">
            {favoritePodcasts.length === 0 ? (
              <p className="text-white/45">No favorite podcasts yet.</p>
            ) : (
              favoritePodcasts.map((podcast: Podcast) => (
                <button
                  key={podcast.podcastId}
                  onClick={() => onOpenPodcast(podcast)}
                  className="flex w-full items-center gap-4 rounded-2xl bg-white/5 p-4 text-left hover:bg-white/10"
                >
                  <img src={podcast.artworkUrl100 || ""} className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <h3 className="truncate font-black">{podcast.title}</h3>
                    <p className="truncate text-sm text-white/45">{podcast.publisher}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card-glass rounded-[2rem] p-7">
          <h2 className="text-2xl font-black">
            {selectedPodcast ? selectedPodcast.title : "Podcast Episodes"}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {selectedPodcast ? selectedPodcast.publisher : "Select a podcast to load episodes."}
          </p>

          <div className="mt-5 space-y-3">
            {episodes.length === 0 ? (
              <p className="rounded-2xl bg-white/5 p-6 text-white/45">
                No playable audio episodes loaded yet.
              </p>
            ) : (
              episodes.map((episode: PodcastEpisode) => (
                <div key={episode.episodeId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="font-black">{episode.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-white/45">{episode.summary}</p>
                  <button
                    onClick={() => onPlayEpisode(episode)}
                    className="mt-3 rounded-xl bg-purple-500 px-4 py-2 text-sm font-black"
                  >
                    Play Episode
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlaylistsPage(props: any) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-6">
        <div className="card-glass rounded-[2rem] p-7">
          <h2 className="text-3xl font-black">Create Playlist</h2>
          <p className="mt-2 text-white/50">Build your own mixes.</p>

          {!props.user ? (
            <button onClick={props.onProfile} className="mt-6 w-full rounded-2xl bg-purple-500 px-5 py-4 font-black">
              Login to create playlists
            </button>
          ) : (
            <form onSubmit={props.onCreate} className="mt-6 space-y-3">
              <input
                value={props.playlistName}
                onChange={(e) => props.onName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
                placeholder="Playlist name"
                required
              />
              <textarea
                value={props.playlistDescription}
                onChange={(e) => props.onDescription(e.target.value)}
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
                placeholder="Description optional"
              />
              {props.playlistMessage && <p className="text-sm text-purple-200">{props.playlistMessage}</p>}
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500 px-5 py-4 font-black hover:bg-purple-400">
                <Plus size={18} />
                Create Playlist
              </button>
            </form>
          )}
        </div>

        <div className="card-glass rounded-[2rem] p-7">
          <h2 className="mb-5 text-2xl font-black">Your Playlists</h2>
          <div className="space-y-3">
            {props.playlists.length === 0 ? (
              <p className="text-white/50">No playlists created yet.</p>
            ) : (
              props.playlists.map((playlist: Playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => props.onOpenPlaylist(playlist.id)}
                  className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                    props.selectedPlaylist?.id === playlist.id
                      ? "border-purple-400 bg-purple-500/20"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <h3 className="font-black">{playlist.name}</h3>
                  <p className="text-sm text-white/45">{playlist.songCount} songs</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card-glass rounded-[2rem] p-7">
        {props.selectedPlaylist ? (
          <>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-4xl font-black">{props.selectedPlaylist.name}</h2>
                <p className="mt-2 text-white/50">{props.selectedPlaylist.description || "No description"}</p>
              </div>
              <button
                onClick={() => props.onDeletePlaylist(props.selectedPlaylist.id)}
                className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>

            {!props.selectedPlaylist.songs || props.selectedPlaylist.songs.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/50">
                This playlist is empty.
              </div>
            ) : (
              <div className="space-y-3">
                {props.selectedPlaylist.songs.map((song: Song) => (
                  <div key={song.trackId} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <img src={song.artworkUrl100 || ""} className="h-16 w-16 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-black">{song.trackName}</h3>
                      <p className="truncate text-sm text-white/50">{song.artistName}</p>
                    </div>
                    <button onClick={() => props.onPlay(song)} className="rounded-xl bg-purple-500 p-3">
                      <Play size={18} fill="white" />
                    </button>
                    <button
                      onClick={() => props.onRemoveSong(props.selectedPlaylist.id, song.trackId)}
                      className="rounded-xl border border-white/10 bg-white/10 p-3 hover:bg-red-500/20"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <ListMusic size={42} />
            <h2 className="mt-5 text-3xl font-black">Select a playlist</h2>
          </div>
        )}
      </div>
    </section>
  );
}

function ProfilePage(props: any) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="card-glass rounded-[2rem] p-7">
        {props.user ? (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-500 text-3xl font-black">
              {props.user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-3xl font-black">{props.user.name}</h2>
            <p className="mt-1 text-white/55">{props.user.email}</p>

            <div className="mt-8 grid gap-4">
              <StatCard label="Liked Songs" value={props.favorites} icon={<Heart size={20} />} />
              <StatCard label="Listening History" value={props.history} icon={<History size={20} />} />
              <StatCard label="Artists" value={props.artists} icon={<Mic2 size={20} />} />
              <StatCard label="Podcasts" value={props.podcasts} icon={<Rss size={20} />} />
              <StatCard label="Playlists" value={props.playlists} icon={<ListMusic size={20} />} />
            </div>

            <button onClick={props.logout} className="mt-8 w-full rounded-2xl bg-white px-5 py-4 font-black text-black">
              Logout
            </button>
          </>
        ) : (
          <AuthForm {...props} />
        )}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-700/30 to-cyan-500/10 p-8">
        <h2 className="text-4xl font-black">SoundMix now feels alive</h2>
        <div className="mt-6 grid gap-4">
          <Feature text="Follow artists and discover more tracks from them." />
          <Feature text="Search and save podcasts." />
          <Feature text="Play full Audius music and playable podcast RSS episodes." />
          <Feature text="Use facial expression and Instagram post vibe for recommendations." />
        </div>
      </div>
    </section>
  );
}

function SongsSection({
  title,
  emptyText = "No songs found.",
  loading,
  songs,
  playlists,
  favoriteIds,
  favoriteArtistNames,
  onPlay,
  onLike,
  onAddToPlaylist,
  onToggleArtist,
  onOpenArtist,
  onAddToQueue,
  onPlayNext,
  onStartRadio,
}: {
  title: string;
  emptyText?: string;
  loading: boolean;
  songs: Song[];
  playlists: Playlist[];
  favoriteIds: Set<string>;
  favoriteArtistNames: Set<string>;
  onPlay: (song: Song) => void;
  onLike: (song: Song) => void;
  onAddToPlaylist: (song: Song, playlistId: number) => void;
  onToggleArtist: (song: Song) => void;
  onOpenArtist: (artistName: string) => void;
  onAddToQueue: (song: Song) => void;
  onPlayNext: (song: Song) => void;
  onStartRadio: (artistName: string) => void;
}) {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-3xl font-black">{title}</h2>
        <p className="text-sm text-white/40">{songs.length} tracks</p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-12 text-center text-white/60">
          Loading...
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
                <img src={song.artworkUrl100 || ""} className="h-56 w-full object-cover transition duration-500 group-hover:scale-110" />
                <button onClick={() => onPlay(song)} className="absolute bottom-3 right-3 rounded-full bg-purple-500 p-4 shadow-xl transition hover:scale-110">
                  <Play size={20} fill="white" />
                </button>
              </div>

              <div className="mt-4">
                <h3 className="truncate font-black">{song.trackName}</h3>
                <button onClick={() => onOpenArtist(song.artistName)} className="truncate text-sm text-purple-200 hover:text-white">
                  {song.artistName}
                </button>
                <p className="mt-2 truncate text-xs text-white/35">{song.primaryGenreName || song.collectionName || "Music"}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onLike(song)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    favoriteIds.has(song.trackId)
                      ? "border-pink-400/40 bg-pink-500/20 text-pink-200"
                      : "border-white/10 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <Heart size={15} fill={favoriteIds.has(song.trackId) ? "currentColor" : "none"} />
                  {favoriteIds.has(song.trackId) ? "Liked" : "Like"}
                </button>

                <button
                  onClick={() => onToggleArtist(song)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    favoriteArtistNames.has(song.artistName)
                      ? "border-purple-400/40 bg-purple-500/20 text-purple-100"
                      : "border-white/10 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <UserRoundPlus size={15} />
                  {favoriteArtistNames.has(song.artistName) ? "Following" : "Artist"}
                </button>

                <button
                  onClick={() => onAddToQueue(song)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                >
                  <ListPlus size={15} />
                  Queue
                </button>

                <button
                  onClick={() => onPlayNext(song)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                >
                  <SkipForward size={15} />
                  Next
                </button>

                <button
                  onClick={() => onStartRadio(song.artistName)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                >
                  <Radio size={15} />
                  Radio
                </button>
              </div>

              <select
                defaultValue=""
                onChange={(e) => {
                  const playlistId = Number(e.target.value);
                  if (playlistId) {
                    onAddToPlaylist(song, playlistId);
                    e.target.value = "";
                  }
                }}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Add to playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                ))}
              </select>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
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

function AuthForm(props: any) {
  return (
    <form onSubmit={props.handleAuthSubmit}>
      <h2 className="text-3xl font-black">{props.authMode === "login" ? "Welcome Back" : "Create Account"}</h2>
      <p className="mt-2 text-white/50">Login to save likes, artists, podcasts, playlists, and recommendations.</p>

      <div className="mt-7 space-y-3">
        {props.authMode === "register" && (
          <input
            value={props.authName}
            onChange={(e) => props.setAuthName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
            placeholder="Name"
            required
          />
        )}

        <input
          value={props.authEmail}
          onChange={(e) => props.setAuthEmail(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
          placeholder="Email"
          type="email"
          required
        />

        <input
          value={props.authPassword}
          onChange={(e) => props.setAuthPassword(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 outline-none"
          placeholder="Password"
          type="password"
          required
        />
      </div>

      {props.authError && <p className="mt-4 text-sm text-red-300">{props.authError}</p>}

      <button className="mt-5 w-full rounded-2xl bg-purple-500 px-5 py-4 font-black hover:bg-purple-400">
        {props.authMode === "login" ? "Login" : "Register"}
      </button>

      <button
        type="button"
        onClick={() => props.setAuthMode(props.authMode === "login" ? "register" : "login")}
        className="mt-4 w-full text-sm text-white/60 hover:text-white"
      >
        {props.authMode === "login" ? "Need an account? Register" : "Already have an account? Login"}
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
