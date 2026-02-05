import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, githubProvider } from "./lib/firebase";
import "./App.css";

const DEFAULT_TIME_SECONDS = 25 * 60;
const RING_RADIUS = 52;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const POPUP_INTERVAL_MINUTES = 30;
const PREMIUM_LINK =
  import.meta.env.DEV && import.meta.env.VITE_PREMIUM_LINK_TEST
    ? import.meta.env.VITE_PREMIUM_LINK_TEST
    : "https://buy.stripe.com/fZu9ATaXh88R0d23Ve57W01";

const radioLibrary = [
  { name: "🎧 VibeDesk Radio", url: "https://play.streamafrica.net/lofiradio" },
  { name: "☕ Coffee Shop", url: "https://stream.zeno.fm/0r0xa792kwzuv" },
  { name: "💻 Coding Radio", url: "https://stream.laut.fm/lofi" },
  { name: "🔇 No Music", url: "" }
];

const ambientLibrary = [
  { name: "❌ No Noise", url: "" },
  { name: "💨 White Noise", url: "/suoni/phon.mp3" },
  { name: "🌧️ Rain", url: "/suoni/rain.mp3" },
  { name: "🔥 Fire", url: "/suoni/fire.mp3" },
  { name: "🌊 Ocean", url: "/suoni/ocean.mp3" },
  { name: "🌲 Forest", url: "/suoni/HotNature.mp3" },
  { name: "🌌 Space", url: "/suoni/space.mp3" },
  { name: "⌨️ Keyboard", url: "/suoni/keyboard.mp3" }
];

const themeLibrary = [
  { name: "Christmas Girl", type: "video", url: "/Video/Natale.mp4", category: "Christmas Holiday" },
  { name: "Cozy Fireplace", type: "video", url: "/Video/Camino.mp4", category: "Christmas Holiday" },

  { name: "Study Focus", type: "video", url: "/Video/GirlStudyingLofi.mp4", category: "Lofi Vibes" },
  { name: "Lofi Cat", type: "video", url: "/Video/lofiCat.mp4", category: "Lofi Vibes" },
  { name: "Train Ride", type: "video", url: "/Video/TrainGirl.mp4", category: "Lofi Vibes" },
  { name: "Cozy Desk", type: "video", url: "/Video/Room.mp4", category: "Lofi Vibes" },
  { name: "Rainy Window", type: "video", url: "/Video/RainWindow.mp4", category: "Lofi Vibes" },
  { name: "Warm Desk Glow", type: "video", url: "/Video/Room.mp4", category: "Lofi Vibes" },
  { name: "Late Night Rain", type: "video", url: "/Video/RainWindow.mp4", category: "Lofi Vibes" },

  { name: "Coding Boy", type: "video", url: "/Video/boyCoding.mp4", category: "Coding" },
  { name: "Hacker", type: "video", url: "/Video/hacker.mp4", category: "Coding" },

  { name: "Autumn Pixel", type: "video", url: "/Video/autm.mp4", category: "Pixel" },
  { name: "Pokemon Night", type: "video", url: "/Video/pok.mp4", category: "Pixel" },
  { name: "Japan Street", type: "video", url: "/Video/japanStreet.mp4", category: "Pixel" },

  { name: "Galaxy Loop", type: "video", url: "/Video/Galaxy.mp4", category: "Space" },
  { name: "Deep Space", type: "image", url: "/Video/space.jpg", category: "Space" },

  { name: "Lofi Girl", type: "image", url: "/Video/girl.jpg", category: "Static" },
  { name: "Landscape", type: "image", url: "/Video/landscape.jpg", category: "Static" },
  { name: "Mount Fuji", type: "image", url: "/Video/monte.jpg", category: "Static" }
];

const popupMessages = [
  "Stay focused! 🔥",
  "You are doing great! 🚀",
  "Hydration check 💧",
  "Posture check 🧘",
  "Keep the flow 🎧"
];

function getLevelProgress(streak) {
  if (streak >= 30) {
    return {
      level: "Diamond",
      next: null,
      currentMin: 30,
      currentMax: 30,
      remaining: 0,
      progress: 100
    };
  }
  if (streak >= 14) {
    const remaining = 30 - streak;
    return {
      level: "Gold",
      next: "Diamond",
      currentMin: 14,
      currentMax: 29,
      remaining,
      progress: Math.round(((streak - 14 + 1) / (30 - 14)) * 100)
    };
  }
  if (streak >= 7) {
    const remaining = 14 - streak;
    return {
      level: "Silver",
      next: "Gold",
      currentMin: 7,
      currentMax: 13,
      remaining,
      progress: Math.round(((streak - 7 + 1) / (14 - 7)) * 100)
    };
  }
  if (streak >= 3) {
    const remaining = 7 - streak;
    return {
      level: "Bronze",
      next: "Silver",
      currentMin: 3,
      currentMax: 6,
      remaining,
      progress: Math.round(((streak - 3 + 1) / (7 - 3)) * 100)
    };
  }
  const remaining = 3 - streak;
  return {
    level: "Starter",
    next: "Bronze",
    currentMin: 0,
    currentMax: 2,
    remaining,
    progress: Math.round(((streak + 1) / 3) * 100)
  };
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimerDisplay(seconds) {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildLinePoints(data, maxValue, width = 320, height = 90, padding = 10) {
  if (!data.length) return "";
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  return data
    .map((item, index) => {
      const x = padding + (usableWidth * index) / Math.max(1, data.length - 1);
      const value = item.minutes || 0;
      const ratio = maxValue > 0 ? value / maxValue : 0;
      const y = padding + (1 - ratio) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function CustomSelect({
  id,
  valueIndex,
  options,
  onSelect,
  isOpen,
  onToggle
}) {
  return (
    <div className={`custom-select-wrapper ${isOpen ? "open" : ""}`} id={id}>
      <div className="custom-select__trigger" onClick={onToggle}>
        <span>{options[valueIndex]?.name ?? options[0].name}</span>
        <div className="arrow"></div>
      </div>
      <div className="custom-options">
        {options.map((item, idx) => {
          const prevCategory = idx > 0 ? options[idx - 1]?.category : null;
          const showCategory = item.category && item.category !== prevCategory;
          return (
            <div key={`${id}-${item.name}-${idx}`}>
              {showCategory ? (
                <div className="dropdown-category-header">{item.category}</div>
              ) : null}
              <div
                className={`custom-option ${idx === valueIndex ? "selected" : ""}`}
                onClick={() => onSelect(idx)}
              >
                {item.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_TIME_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(25);

  const [currentRadioIndex, setCurrentRadioIndex] = useState(0);
  const [currentAmbientIndex, setCurrentAmbientIndex] = useState(0);
  const [currentThemeIndex, setCurrentThemeIndex] = useState(2);

  const [radioVolume, setRadioVolume] = useState(50);
  const [ambientVolume, setAmbientVolume] = useState(30);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const [modalMessage, setModalMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);

  const [dailyMinutes, setDailyMinutes] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [weekDaysCount, setWeekDaysCount] = useState(0);
  const [monthDaysCount, setMonthDaysCount] = useState(0);
  const [statsVersion, setStatsVersion] = useState(0);

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    formatDateKey(new Date())
  );

  const [notepadText, setNotepadText] = useState("");
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [activeNotepadTab, setActiveNotepadTab] = useState("notes");

  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLevelsOpen, setIsLevelsOpen] = useState(false);
  const [levelConfetti, setLevelConfetti] = useState([]);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingRect, setOnboardingRect] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(600);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [statsRange, setStatsRange] = useState("7");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const timerIntervalRef = useRef(null);
  const popupIntervalRef = useRef(null);
  const statsCheckpointRef = useRef(null);
  const bellRef = useRef(null);
  const userRef = useRef(null);
  const notepadSyncRef = useRef(null);
  const lastLevelRef = useRef(null);

  const lofiRef = useRef(null);
  const ambientRef = useRef(null);
  const notepadRef = useRef(null);

  const sessionMinutesRef = useRef(sessionMinutes);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    sessionMinutesRef.current = sessionMinutes;
  }, [sessionMinutes]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const selectedTheme = themeLibrary[currentThemeIndex] || themeLibrary[0];

  const timerDisplay = useMemo(
    () => formatTimerDisplay(timeRemaining),
    [timeRemaining]
  );

  const progressOffset = useMemo(() => {
    const totalSeconds = Math.max(1, sessionMinutes * 60);
    const progress = Math.min(1, Math.max(0, 1 - timeRemaining / totalSeconds));
    return RING_CIRC * (1 - progress);
  }, [timeRemaining, sessionMinutes]);

  function loadTotals() {
    const saved = localStorage.getItem("vibeDailyTotals");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  }

  function saveTotals(totals) {
    localStorage.setItem("vibeDailyTotals", JSON.stringify(totals));
  }

  async function syncTotalsToCloud(totals) {
    if (!userRef.current) return;
    const streakCountLocal = parseInt(localStorage.getItem("vibeStreakCount") || 0, 10);
    const streakLastActive = localStorage.getItem("vibeStreakLastActive") || null;
    try {
      await setDoc(
        doc(db, "users", userRef.current.uid),
        {
          totals,
          streakCount: streakCountLocal,
          streakLastActive,
          email: userRef.current.email || null,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function syncTasksToCloud(nextTasks) {
    if (!userRef.current) return;
    try {
      await setDoc(
        doc(db, "users", userRef.current.uid),
        { tasks: nextTasks, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function syncPresetsToCloud(nextPresets) {
    if (!userRef.current) return;
    try {
      await setDoc(
        doc(db, "users", userRef.current.uid),
        { presets: nextPresets, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function syncGoalToCloud(nextGoal) {
    if (!userRef.current || !isPremium) return;
    try {
      await setDoc(
        doc(db, "users", userRef.current.uid),
        { weeklyGoalMinutes: nextGoal, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function syncNotepadToCloud(nextText) {
    if (!userRef.current) return;
    try {
      await setDoc(
        doc(db, "users", userRef.current.uid),
        { notepadContent: nextText, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function loadUserStats(uid) {
    try {
      const snapshot = await getDoc(doc(db, "users", uid));
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.totals) {
          saveTotals(data.totals);
          updateStatsDerived(data.totals);
        }
        if (typeof data.streakCount === "number") {
          localStorage.setItem("vibeStreakCount", `${data.streakCount}`);
          setStreakCount(data.streakCount);
        }
        if (data.streakLastActive) {
          localStorage.setItem("vibeStreakLastActive", data.streakLastActive);
        }
        if (typeof data.isPremium === "boolean") {
          setIsPremium(data.isPremium);
        }
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        }
        if (Array.isArray(data.presets)) {
          setPresets(data.presets);
        }
        if (typeof data.notepadContent === "string") {
          setNotepadText(data.notepadContent);
          localStorage.setItem("vibeNotepadContent", data.notepadContent);
        }
        if (typeof data.weeklyGoalMinutes === "number") {
          setWeeklyGoalMinutes(data.weeklyGoalMinutes);
        }
      } else {
        const totals = loadTotals();
        await setDoc(
          doc(db, "users", uid),
          {
            totals,
            streakCount: parseInt(localStorage.getItem("vibeStreakCount") || 0, 10),
            streakLastActive: localStorage.getItem("vibeStreakLastActive") || null,
            isPremium: false,
            tasks: [],
            presets: [],
            notepadContent: localStorage.getItem("vibeNotepadContent") || "",
            weeklyGoalMinutes: 600,
            email: userRef.current?.email || null,
            createdAt: serverTimestamp()
          },
          { merge: true }
        );
        updateStatsDerived(totals);
      }
    } catch (err) {
      console.log(err);
    }
  }

  function updateStreakOnFocusAdded() {
    const today = new Date().toDateString();
    const lastActive = localStorage.getItem("vibeStreakLastActive");
    if (lastActive === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    let streak = parseInt(localStorage.getItem("vibeStreakCount") || 0, 10);
    streak = lastActive === yesterdayStr ? streak + 1 : 1;

    localStorage.setItem("vibeStreakCount", `${streak}`);
    localStorage.setItem("vibeStreakLastActive", today);
    setStreakCount(streak);
  }

  function updateStatsDerived(totals) {
    const todayKey = formatDateKey(new Date());
    const todayMinutesValue = totals[todayKey] || 0;
    setDailyMinutes(todayMinutesValue);

    const streak = parseInt(localStorage.getItem("vibeStreakCount") || 0, 10);
    setStreakCount(Number.isNaN(streak) ? 0 : streak);

    const weekStart = getStartOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    let weekTotal = 0;
    let weekDays = 0;
    let monthDays = 0;
    const now = new Date();

    Object.entries(totals).forEach(([dateKey, minutes]) => {
      const [y, m, d] = dateKey.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (dateObj >= weekStart && dateObj < weekEnd) {
        weekTotal += minutes;
        if (minutes > 0) weekDays += 1;
      }
      if (dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth()) {
        if (minutes > 0) monthDays += 1;
      }
    });

    setWeekMinutes(weekTotal);
    setWeekDaysCount(weekDays);
    setMonthDaysCount(monthDays);
    setStatsVersion((prev) => prev + 1);
  }

  function addMinutesToStats(minutesAdded) {
    if (!minutesAdded || minutesAdded <= 0) return;
    const totals = loadTotals();
    const todayKey = formatDateKey(new Date());
    totals[todayKey] = (totals[todayKey] || 0) + minutesAdded;
    saveTotals(totals);
    localStorage.setItem("vibeDailyMinutes", `${totals[todayKey]}`);
    updateStreakOnFocusAdded();
    updateStatsDerived(totals);
    syncTotalsToCloud(totals);
    setSessionHistory((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: todayKey,
        minutes: Math.round(minutesAdded),
        at: Date.now()
      }
    ]);
  }

  function showModal(message) {
    setModalMessage(message);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function handleGoogleAuth() {
    setAuthError("");
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err?.message || "Authentication error");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGithubAuth() {
    setAuthError("");
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, githubProvider);
    } catch (err) {
      setAuthError(err?.message || "Authentication error");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setIsAuthOpen(false);
  }

  function startPopupInterval() {
    stopPopupInterval();
    popupIntervalRef.current = setInterval(() => {
      const msg = popupMessages[Math.floor(Math.random() * popupMessages.length)];
      showModal(msg);
    }, POPUP_INTERVAL_MINUTES * 60 * 1000);
  }

  function stopPopupInterval() {
    if (popupIntervalRef.current) {
      clearInterval(popupIntervalRef.current);
      popupIntervalRef.current = null;
    }
  }

  function handleSessionComplete() {
    setIsRunning(false);
    stopPopupInterval();

    const deltaSeconds = statsCheckpointRef.current ?? sessionMinutesRef.current * 60;
    if (deltaSeconds > 0) addMinutesToStats(deltaSeconds / 60);
    statsCheckpointRef.current = null;

    if (bellRef.current) {
      bellRef.current.currentTime = 0;
      bellRef.current.play().catch(() => {});
    }

    showModal("Session Complete! ☕");

    if (Notification.permission === "granted") {
      new Notification("VibeDesk Timer", {
        body: "Time's up! ☕ Time for a break."
      });
    }
  }

  function toggleTimer() {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().catch(() => {});
    }

    setIsRunning((prev) => {
      if (prev) {
        if (statsCheckpointRef.current !== null) {
          const deltaSeconds = statsCheckpointRef.current - timeRemaining;
          if (deltaSeconds > 0) addMinutesToStats(deltaSeconds / 60);
          statsCheckpointRef.current = timeRemaining;
        }
        return false;
      }
      statsCheckpointRef.current = timeRemaining;
      return true;
    });
  }

  function resetTimer() {
    setIsRunning(false);
    stopPopupInterval();
    setTimeRemaining(sessionMinutes * 60);
    statsCheckpointRef.current = null;
  }

  function setCustomTime(minutes) {
    if (Number.isNaN(minutes) || minutes <= 0) return;
    setSessionMinutes(minutes);
    setTimeRemaining(minutes * 60);
    setIsRunning(false);
    statsCheckpointRef.current = null;
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    el.requestFullscreen?.().then(() => {
      if (lofiRef.current && isRadioPlaying) lofiRef.current.play().catch(() => {});
      if (ambientRef.current && currentAmbientIndex > 0) ambientRef.current.play().catch(() => {});
    });
  }

  function updatePlayIcon(playing) {
    setIsRadioPlaying(playing);
  }

  function changeRadioTrack(index) {
    const selected = radioLibrary[index] || radioLibrary[0];
    if (!lofiRef.current) return;
    if (!selected.url) {
      lofiRef.current.pause();
      lofiRef.current.src = "";
      updatePlayIcon(false);
      return;
    }

    const wasPlaying = !lofiRef.current.paused;
    lofiRef.current.src = selected.url;
    if (wasPlaying || isRunningRef.current || isRadioPlaying) {
      lofiRef.current.play().catch(() => {});
      updatePlayIcon(true);
    }
  }

  function changeAmbientTrack(index) {
    const selected = ambientLibrary[index] || ambientLibrary[0];
    if (!ambientRef.current) return;
    if (!selected.url) {
      ambientRef.current.pause();
      ambientRef.current.src = "";
      return;
    }

    ambientRef.current.src = selected.url;
    ambientRef.current.loop = true;
    ambientRef.current.play().catch(() => {});
  }

  function toggleRadioPlay() {
    if (!lofiRef.current) return;
    if (lofiRef.current.paused && lofiRef.current.src) {
      lofiRef.current.play().catch(() => {});
      updatePlayIcon(true);
    } else {
      lofiRef.current.pause();
      updatePlayIcon(false);
    }
  }

  function changeTheme(index) {
    setCurrentThemeIndex(index);
  }

  function saveState() {
    const state = {
      time: timeRemaining,
      running: isRunning,
      sessionMins: sessionMinutes,
      radioIndex: currentRadioIndex,
      ambientIndex: currentAmbientIndex,
      themeIndex: currentThemeIndex,
      radioVolume,
      ambientVolume,
      isPlaying: isRadioPlaying,
      miniPlayerVisible: isMiniPlayerOpen,
      settingsOpen: isSettingsOpen
    };
    localStorage.setItem("vibeDeskState_v3", JSON.stringify(state));
  }

  function loadState() {
    const savedRaw =
      localStorage.getItem("vibeDeskState_v3") ||
      localStorage.getItem("vibeDeskState_v2");

    if (!savedRaw) return;
    try {
      const state = JSON.parse(savedRaw);
      if (state.sessionMins) setSessionMinutes(state.sessionMins);
      if (state.time) setTimeRemaining(state.time);
      setIsRunning(Boolean(state.running));

      setCurrentRadioIndex(
        state.radioIndex < radioLibrary.length ? state.radioIndex : 0
      );
      setCurrentAmbientIndex(
        state.ambientIndex < ambientLibrary.length ? state.ambientIndex : 0
      );
      setCurrentThemeIndex(
        state.themeIndex < themeLibrary.length ? state.themeIndex : 0
      );

      setRadioVolume(state.radioVolume ?? 50);
      setAmbientVolume(state.ambientVolume ?? 30);
      setIsRadioPlaying(Boolean(state.isPlaying));
      setIsMiniPlayerOpen(Boolean(state.miniPlayerVisible));
      setIsSettingsOpen(Boolean(state.settingsOpen));
    } catch (err) {
      console.log(err);
    }
  }

  function handleResetStats() {
    localStorage.setItem("vibeDailyMinutes", "0");
    const totals = loadTotals();
    const todayKey = formatDateKey(new Date());
    totals[todayKey] = 0;
    saveTotals(totals);
    updateStatsDerived(totals);
    setIsConfirmOpen(false);
  }

  function addTask() {
    const trimmed = taskInput.trim();
    if (!trimmed) return;
    const next = [
      ...tasks,
      { id: crypto.randomUUID(), text: trimmed, done: false, date: taskDate || null }
    ];
    setTasks(next);
    setTaskInput("");
    setTaskDate("");
  }

  function savePreset() {
    if (!user) {
      setIsAuthOpen(true);
      showModal("Please log in to save presets.");
      return;
    }
    const name = presetName.trim();
    if (!name) return;
    if (!isPremium && presets.length >= 2) {
      showModal("Free plan allows up to 2 presets. Upgrade to save more.");
      return;
    }
    const next = [
      ...presets,
      {
        id: crypto.randomUUID(),
        name,
        sessionMinutes,
        themeIndex: currentThemeIndex,
        radioIndex: currentRadioIndex,
        ambientIndex: currentAmbientIndex,
        radioVolume,
        ambientVolume
      }
    ];
    setPresets(next);
    setPresetName("");
  }

  function applyPreset(preset) {
    setSessionMinutes(preset.sessionMinutes);
    setTimeRemaining(preset.sessionMinutes * 60);
    setCurrentThemeIndex(preset.themeIndex);
    setCurrentRadioIndex(preset.radioIndex);
    setCurrentAmbientIndex(preset.ambientIndex);
    setRadioVolume(preset.radioVolume);
    setAmbientVolume(preset.ambientVolume);
    setIsRunning(false);
    statsCheckpointRef.current = null;
  }

  function deletePreset(id) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }


  function toggleTask(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let emptyDays = firstDay - 1;
    if (emptyDays === -1) emptyDays = 6;

    const totals = loadTotals();
    const todayKey = formatDateKey(new Date());
    const taskDates = new Set(
      tasks.filter((task) => task.date).map((task) => task.date)
    );

    const days = [];
    for (let i = 0; i < emptyDays; i += 1) {
      days.push({ type: "empty", key: `empty-${i}` });
    }

    for (let i = 1; i <= daysInMonth; i += 1) {
      const dateKey = formatDateKey(new Date(year, month, i));
      days.push({
        type: "day",
        key: dateKey,
        day: i,
        isToday: dateKey === todayKey,
        minutes: totals[dateKey] || 0,
        hasTask: taskDates.has(dateKey)
      });
    }

    return days;
  }, [calendarDate, statsVersion, tasks]);

  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.date === selectedCalendarDate),
    [tasks, selectedCalendarDate]
  );

  const selectedCalendarDateObj = useMemo(() => {
    if (!selectedCalendarDate) return new Date();
    const [year, month, day] = selectedCalendarDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedCalendarDate]);

  const weeklyHistory = useMemo(() => {
    const totals = loadTotals();
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        minutes: totals[key] || 0
      });
    }
    return days;
  }, [statsVersion]);

  const monthlyHistory = useMemo(() => {
    const totals = loadTotals();
    const days = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      days.push({
        label: d.getDate(),
        minutes: totals[key] || 0
      });
    }
    return days;
  }, [statsVersion]);

  const weeklyGoalProgress = Math.min(
    100,
    Math.round((weekMinutes / Math.max(1, weeklyGoalMinutes)) * 100)
  );

  const todayHistory = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return sessionHistory
      .filter((entry) => entry.date === todayKey)
      .slice(-12);
  }, [sessionHistory]);

  const weeklyMax = Math.max(1, ...weeklyHistory.map((d) => d.minutes));
  const monthlyMax = Math.max(1, ...monthlyHistory.map((d) => d.minutes));

  const badgeLevel = useMemo(() => {
    if (streakCount >= 30) return { label: "Diamond", color: "#7ef9ff" };
    if (streakCount >= 14) return { label: "Gold", color: "#f5c06b" };
    if (streakCount >= 7) return { label: "Silver", color: "#c0d8ff" };
    if (streakCount >= 3) return { label: "Bronze", color: "#d7a57c" };
    return { label: "Starter", color: "#9ca3af" };
  }, [streakCount]);

  const onboardingSteps = useMemo(
    () => [
      {
        title: "Welcome to VibeDesk",
        text: "Your focus space for deep work. Let's do a quick tour.",
        selector: "#timer-wrapper"
      },
      {
        title: "Timer Controls",
        text: "Start, pause or reset sessions from the dock under the timer.",
        selector: "#main-controls"
      },
      {
        title: "Notes & Tasks",
        text: "Capture ideas and to-dos in your Brain Dump.",
        selector: "#notepad-toggle"
      },
      {
        title: "Calendar",
        text: "See your activity and (Premium) tasks on specific days.",
        selector: "#calendar-toggle"
      },
      {
        title: "Stats & Settings",
        text: "Track progress and customize your focus space.",
        selector: "#stats-btn"
      }
    ],
    []
  );

  const levelProgress = useMemo(() => getLevelProgress(streakCount), [streakCount]);

  useEffect(() => {
    const levelOrder = ["Starter", "Bronze", "Silver", "Gold", "Diamond"];
    const storedLevel = lastLevelRef.current || localStorage.getItem("vibeLastLevel");
    if (!storedLevel) {
      lastLevelRef.current = badgeLevel.label;
      localStorage.setItem("vibeLastLevel", badgeLevel.label);
      return;
    }
    const currentIdx = levelOrder.indexOf(badgeLevel.label);
    const storedIdx = levelOrder.indexOf(storedLevel);
    if (currentIdx > storedIdx) {
      lastLevelRef.current = badgeLevel.label;
      localStorage.setItem("vibeLastLevel", badgeLevel.label);
      showModal(`Level up! You unlocked ${badgeLevel.label}. 🎉`);
      const confetti = Array.from({ length: 22 }, (_, idx) => ({
        id: `confetti-${Date.now()}-${idx}`,
        x: Math.random() * 100,
        delay: Math.random() * 0.4,
        size: 10 + Math.random() * 10
      }));
      setLevelConfetti(confetti);
      setTimeout(() => setLevelConfetti([]), 2200);
      return;
    }
    if (currentIdx < storedIdx) {
      lastLevelRef.current = badgeLevel.label;
      localStorage.setItem("vibeLastLevel", badgeLevel.label);
    }
  }, [badgeLevel.label]);

  useEffect(() => {
    bellRef.current = new Audio("/audio/bell.mp3");
    loadState();

    const storedNotepad = localStorage.getItem("vibeNotepadContent");
    setNotepadText(storedNotepad || "");

    const savedTasks = localStorage.getItem("vibeTasks_v1");
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch {
        setTasks([]);
      }
    }

    const savedPresets = localStorage.getItem("vibePresets_v1");
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch {
        setPresets([]);
      }
    }

    const savedGoal = localStorage.getItem("vibeWeeklyGoal");
    if (savedGoal) {
      const goalValue = parseInt(savedGoal, 10);
      if (!Number.isNaN(goalValue)) setWeeklyGoalMinutes(goalValue);
    }

    const savedHistory = localStorage.getItem("vibeSessionHistory");
    if (savedHistory) {
      try {
        setSessionHistory(JSON.parse(savedHistory));
      } catch {
        setSessionHistory([]);
      }
    }

    localStorage.removeItem("vibeSessionTag");

    const onboardingSeen = localStorage.getItem("vibeOnboardingSeen");
    if (!onboardingSeen) {
      setIsOnboardingOpen(true);
      setOnboardingStep(0);
    }

    const totals = loadTotals();
    updateStatsDerived(totals);
  }, []);

  useEffect(() => {
    if (!isOnboardingOpen) {
      setOnboardingRect(null);
      return;
    }
    const updateRect = () => {
      const selector = onboardingSteps[onboardingStep]?.selector;
      if (!selector) {
        setOnboardingRect(null);
        return;
      }
      const el = document.querySelector(selector);
      if (!el) {
        setOnboardingRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setOnboardingRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [isOnboardingOpen, onboardingStep, onboardingSteps]);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      userRef.current = nextUser;

      // Cleanup previous snapshot listener when user changes
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (nextUser) {
        // Initial load (creates doc if needed)
        await loadUserStats(nextUser.uid);

        // Real-time listener for premium status changes
        unsubscribeSnapshot = onSnapshot(doc(db, "users", nextUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (typeof data.isPremium === "boolean") {
              setIsPremium(data.isPremium);
            }
          }
        });
      } else {
        // User logged out - reset premium
        setIsPremium(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    startPopupInterval();

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          handleSessionComplete();
          return sessionMinutesRef.current * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, [isRunning]);

  useEffect(() => {
    if (!lofiRef.current) return;
    lofiRef.current.volume = radioVolume / 100;
  }, [radioVolume]);

  useEffect(() => {
    if (!ambientRef.current) return;
    ambientRef.current.volume = ambientVolume / 100;
  }, [ambientVolume]);

  useEffect(() => {
    if (!lofiRef.current) return;
    changeRadioTrack(currentRadioIndex);
  }, [currentRadioIndex]);

  useEffect(() => {
    if (!ambientRef.current) return;
    changeAmbientTrack(currentAmbientIndex);
  }, [currentAmbientIndex]);

  useEffect(() => {
    if (!lofiRef.current) return;
    if (isRadioPlaying && lofiRef.current.src) {
      lofiRef.current.play().catch(() => {});
    }
  }, [isRadioPlaying]);

  useEffect(() => {
    if (selectedTheme?.category === "Christmas Holiday") {
      document.body.classList.add("christmas-mode");
    } else {
      document.body.classList.remove("christmas-mode");
    }
  }, [selectedTheme]);

  useEffect(() => {
    localStorage.setItem("vibeNotepadContent", notepadText);
    if (notepadSyncRef.current) clearTimeout(notepadSyncRef.current);
    notepadSyncRef.current = setTimeout(() => {
      syncNotepadToCloud(notepadText);
    }, 600);
    return () => {
      if (notepadSyncRef.current) clearTimeout(notepadSyncRef.current);
    };
  }, [notepadText]);

  useEffect(() => {
    localStorage.setItem("vibeTasks_v1", JSON.stringify(tasks));
    syncTasksToCloud(tasks);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("vibePresets_v1", JSON.stringify(presets));
    syncPresetsToCloud(presets);
  }, [presets]);

  useEffect(() => {
    localStorage.setItem("vibeWeeklyGoal", `${weeklyGoalMinutes}`);
    syncGoalToCloud(weeklyGoalMinutes);
  }, [weeklyGoalMinutes]);

  useEffect(() => {
    localStorage.setItem("vibeSessionHistory", JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  useEffect(() => {
    const todayKey = formatDateKey(new Date());
    const lastShown = localStorage.getItem("vibeTaskReminderLastShown");
    if (lastShown === todayKey) return;
    const todayTasks = tasks.filter((task) => task.date === todayKey && !task.done);
    if (todayTasks.length === 0) return;
    localStorage.setItem("vibeTaskReminderLastShown", todayKey);
    const preview = todayTasks
      .slice(0, 3)
      .map((task) => task.text)
      .join(" • ");
    const suffix = todayTasks.length > 3 ? "…" : "";
    const message = preview
      ? `You have ${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} scheduled for today: ${preview}${suffix}`
      : `You have ${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} scheduled for today.`;
    showModal(message);
  }, [tasks]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__vibeDebug = {
      snapshot: () => ({
        user: user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null,
        isPremium,
        tasksCount: tasks.length,
        notesLength: notepadText.length,
        presetsCount: presets.length,
        weeklyGoalMinutes,
        streakCount,
        sessionHistoryCount: sessionHistory.length,
        statsVersion,
        todayMinutes: Math.round(dailyMinutes)
      })
    };
    return () => {
      delete window.__vibeDebug;
    };
  }, [
    user,
    isPremium,
    tasks.length,
    notepadText.length,
    presets.length,
    weeklyGoalMinutes,
    streakCount,
    sessionHistory.length,
    statsVersion,
    dailyMinutes
  ]);

  useEffect(() => {
    saveState();
  }, [
    timeRemaining,
    isRunning,
    sessionMinutes,
    currentRadioIndex,
    currentAmbientIndex,
    currentThemeIndex,
    radioVolume,
    ambientVolume,
    isRadioPlaying,
    isMiniPlayerOpen,
    isSettingsOpen
  ]);

  useEffect(() => {
    document.title = `${timerDisplay} | VibeDesk`;
  }, [timerDisplay]);

  useEffect(() => {
    function handleKeydown(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        toggleTimer();
      }
      if (e.code === "KeyR") resetTimer();
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyT") setIsNotepadOpen((prev) => !prev);
      if (e.code === "KeyM") setIsMiniPlayerOpen((prev) => !prev);
      if (e.code === "KeyC") setIsCalendarOpen((prev) => !prev);
      if (e.code === "KeyS") setIsStatsOpen((prev) => !prev);

      if (e.code === "Escape") {
        if (isModalOpen) closeModal();
        else if (isConfirmOpen) setIsConfirmOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isMiniPlayerOpen) setIsMiniPlayerOpen(false);
        else if (isNotepadOpen) setIsNotepadOpen(false);
        else if (isCalendarOpen) setIsCalendarOpen(false);
        else if (isStatsOpen) setIsStatsOpen(false);
        else if (isAuthOpen) setIsAuthOpen(false);
      }
    }

    function handleClickOutside(e) {
      if (!e.target.closest(".custom-select-wrapper")) {
        setOpenDropdownId(null);
      }

      if (notepadRef.current && !notepadRef.current.classList.contains("hidden")) {
        const toggleBtn = document.getElementById("notepad-toggle");
        if (
          !notepadRef.current.contains(e.target) &&
          !(toggleBtn && toggleBtn.contains(e.target))
        ) {
          setIsNotepadOpen(false);
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isModalOpen,
    isConfirmOpen,
    isSettingsOpen,
    isMiniPlayerOpen,
    isNotepadOpen,
    isCalendarOpen,
    isAuthOpen
  ]);

  useEffect(() => {
    if (!notepadRef.current) return;
    const elmnt = notepadRef.current;
    let pos1 = 0;
    let pos2 = 0;
    let pos3 = 0;
    let pos4 = 0;

    const header = elmnt.querySelector(".notepad-header");
    const handle = header || elmnt;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;

      const rect = elmnt.getBoundingClientRect();
      elmnt.style.bottom = "auto";
      elmnt.style.right = "auto";
      elmnt.style.transform = "none";
      elmnt.style.top = `${rect.top}px`;
      elmnt.style.left = `${rect.left}px`;

      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elmnt.style.top = `${elmnt.offsetTop - pos2}px`;
      elmnt.style.left = `${elmnt.offsetLeft - pos1}px`;
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }

    handle.onmousedown = dragMouseDown;

    return () => {
      handle.onmousedown = null;
    };
  }, []);

  useEffect(() => {
    if (isRunning && statsCheckpointRef.current === null) {
      statsCheckpointRef.current = timeRemaining;
    }
  }, [isRunning, timeRemaining]);

  const authPanelContent = user ? (
    <div className="auth-user">
      <div className="auth-profile">
        <div className="auth-avatar">
          {user.photoURL ? (
            <img src={user.photoURL} alt="User avatar" />
          ) : (
            <i className="fas fa-user"></i>
          )}
        </div>
        <div className="auth-user-info">
          <span>Signed in as</span>
          <strong>{user.displayName || user.email || "User"}</strong>
        </div>
      </div>
      <div className="auth-user-badges">
        <span className="auth-badge" style={{ borderColor: badgeLevel.color }}>
          {badgeLevel.label}
        </span>
        {isPremium ? <span className="auth-badge premium">Premium</span> : null}
        <button
          className="auth-levels-info"
          type="button"
          onClick={() => setIsLevelsOpen(true)}
          title="Levels info"
        >
          <i className="fas fa-info-circle"></i>
        </button>
      </div>
      <div className="auth-level-progress">
        <div className="auth-level-row">
          <span>{badgeLevel.label}</span>
          <span>
            {levelProgress.next
              ? `${levelProgress.remaining} day${levelProgress.remaining === 1 ? "" : "s"} to ${levelProgress.next}`
              : "Max level"}
          </span>
        </div>
        <div className="auth-level-bar">
          <div style={{ width: `${Math.min(100, levelProgress.progress)}%` }}></div>
        </div>
      </div>
      <button className="auth-signout" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  ) : (
    <div className="auth-form">
      <div className="auth-header">
        <h4>Welcome back</h4>
        <p>Log in to sync your progress and unlock Premium.</p>
      </div>
      {authError ? <div className="auth-error">{authError}</div> : null}
      <button
        className="auth-google"
        type="button"
        onClick={handleGoogleAuth}
        disabled={authLoading}
      >
        <i className="fa-brands fa-google"></i>
        Continue with Google
      </button>
      <button
        className="auth-github"
        type="button"
        onClick={handleGithubAuth}
        disabled={authLoading}
      >
        <i className="fa-brands fa-github"></i>
        Continue with GitHub
      </button>
    </div>
  );

  return (
    <div>
      <div className="auth-entry desktop-only">
        <button
          className="auth-entry-button"
          onClick={() => setIsAuthOpen((prev) => !prev)}
          title={user ? "Account" : "Login"}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User avatar" />
          ) : (
            <i className="fas fa-user"></i>
          )}
        </button>
        <div className={`auth-entry-panel ${isAuthOpen ? "visible" : ""}`}>
          {authPanelContent}
        </div>
      </div>

      <div
        id="mobile-auth-overlay"
        className={isAuthOpen ? "visible" : ""}
        onClick={() => setIsAuthOpen(false)}
      >
        <div
          id="mobile-auth-panel"
          className={isAuthOpen ? "visible" : ""}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            id="mobile-auth-close"
            type="button"
            onClick={() => setIsAuthOpen(false)}
            aria-label="Close login"
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
          {authPanelContent}
        </div>
      </div>

      <div id="background-media">
        {selectedTheme.type === "video" ? (
          <video
            key={selectedTheme.url}
            autoPlay
            loop
            muted
            playsInline
            id="bg-video-element"
            src={selectedTheme.url}
          />
        ) : (
          <img key={selectedTheme.url} src={selectedTheme.url} alt="Background" />
        )}
      </div>

      <div id="app-container">
        <div id="timer-wrapper">
          <div id="timer-display" className={timerDisplay.length > 6 ? "long-text" : ""}>
            {timerDisplay}
          </div>
          <div id="progress-ring" aria-hidden="true">
            <svg viewBox="0 0 120 120" role="presentation">
              <circle className="ring-bg" cx="60" cy="60" r="52"></circle>
              <circle
                className="ring-progress"
                cx="60"
                cy="60"
                r="52"
                style={{
                  strokeDasharray: `${RING_CIRC} ${RING_CIRC}`,
                  strokeDashoffset: `${progressOffset}`
                }}
              ></circle>
            </svg>
          </div>
        </div>

        <div id="main-controls">
          <button id="start-btn" onClick={toggleTimer}>
            {isRunning ? "Pause" : timeRemaining !== sessionMinutes * 60 ? "Resume" : "Start"}
          </button>
          <button id="reset-btn" onClick={resetTimer}>Reset</button>
        <button
          id="stats-btn"
          onClick={() => setIsStatsOpen((prev) => !prev)}
          title="Stats"
        >
          <i className="fas fa-chart-bar"></i>
        </button>
        <button
          id="settings-btn"
          title="Impostazioni"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
        >
          <i className="fas fa-cog"></i>
        </button>
      </div>

        <div id="settings-panel" className={isSettingsOpen ? "visible" : ""}>
          <button
            id="close-settings-btn"
            title="Chiudi"
            onClick={() => setIsSettingsOpen(false)}
          >
            <i className="fas fa-times"></i>
          </button>
          <h3>Settings</h3>

          <div className="settings-layout">
            <div className="settings-column">
              <div id="config-timer">
                <div className="settings-row">
                  <label htmlFor="minutes-input">Custom:</label>
                  <input
                    type="number"
                    id="minutes-input"
                    value={sessionMinutes}
                    min="1"
                    max="600"
                    onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  />
                  <button id="set-time-btn" onClick={() => setCustomTime(sessionMinutes)}>
                    Set
                  </button>
                </div>

                <div>
                  <label className="settings-label">Pomodoro Presets:</label>
                  <div className="pomodoro-controls">
                    <button
                      className="pomo-btn focus"
                      id="pomo-25"
                      title="Focus 25min"
                      onClick={() => setCustomTime(25)}
                    >
                      <i className="fas fa-brain"></i>
                      <span>Focus</span> 25
                    </button>
                    <button
                      className="pomo-btn break"
                      id="pomo-5"
                      title="Short Break 5min"
                      onClick={() => setCustomTime(5)}
                    >
                      <i className="fas fa-coffee"></i>
                      <span>Short Break</span> 5
                    </button>
                    <button
                      className="pomo-btn long-break"
                      id="pomo-15"
                      title="Long Break 15min"
                      onClick={() => setCustomTime(15)}
                    >
                      <i className="fas fa-couch"></i>
                      <span>Long Break</span> 15
                    </button>
                  </div>
                </div>
              </div>

              <div id="theme-controls">
                <label>Lofi Background:</label>
                <CustomSelect
                  id="theme-custom-select"
                  valueIndex={currentThemeIndex}
                  options={themeLibrary}
                  isOpen={openDropdownId === "theme-custom-select"}
                  onToggle={() =>
                    setOpenDropdownId((prev) =>
                      prev === "theme-custom-select" ? null : "theme-custom-select"
                    )
                  }
                  onSelect={(idx) => {
                    changeTheme(idx);
                    setOpenDropdownId(null);
                  }}
                />
              </div>
            </div>

            <div className="settings-column">
              <div className="preset-panel">
                <div className="preset-header">
                  <label>Presets</label>
                  {!isPremium ? <span className="preset-lock">Free · 2 max</span> : null}
                </div>
                <>
                  <div className="preset-create">
                    <input
                      type="text"
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                    />
                    <button onClick={savePreset}>Save</button>
                  </div>
                  <div className="preset-list">
                    {presets.length === 0 ? (
                      <div className="preset-empty">No presets yet.</div>
                    ) : (
                      presets.map((preset) => (
                      <div
                        className={`preset-item ${
                          preset.sessionMinutes === sessionMinutes &&
                          preset.themeIndex === currentThemeIndex &&
                          preset.radioIndex === currentRadioIndex &&
                          preset.ambientIndex === currentAmbientIndex &&
                          preset.radioVolume === radioVolume &&
                          preset.ambientVolume === ambientVolume
                            ? "active"
                            : ""
                        }`}
                        key={preset.id}
                      >
                          <div className="preset-info">
                            <strong>{preset.name}</strong>
                            <span>{preset.sessionMinutes}m · {themeLibrary[preset.themeIndex]?.name}</span>
                          </div>
                          <div className="preset-actions">
                            <button onClick={() => applyPreset(preset)}>Apply</button>
                            <button className="preset-delete" onClick={() => deletePreset(preset.id)}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {!isPremium ? (
                    <div className="preset-locked">
                      <span>
                        {!user
                          ? "Log in to save presets. Free plan: up to 2."
                          : "Free plan: up to 2 presets. Upgrade to save more."}
                      </span>
                      <button
                        className="preset-cta"
                        onClick={() => {
                          if (!user) {
                            setIsLoginPromptOpen(true);
                            return;
                          }
                          const url = new URL(PREMIUM_LINK);
                          if (user.email) url.searchParams.set("prefilled_email", user.email);
                          url.searchParams.set("client_reference_id", user.uid);
                          window.open(url.toString(), "_blank", "noopener,noreferrer");
                        }}
                      >
                        Buy it
                      </button>
                    </div>
                  ) : null}
                </>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="credits-footer">
        <span>
          Created by <strong>Kappaemme</strong>
        </span>
        <div className="social-separator"></div>
        <a href="https://x.com/Kappaemme1926" target="_blank" rel="noreferrer">
          <i className="fa-brands fa-x-twitter"></i>
        </a>
        <a href="https://github.com/Kappaemme-git" target="_blank" rel="noreferrer">
          <i className="fa-brands fa-github"></i>
        </a>
      </div>

      {/* Mobile Menu Hamburger */}
      <div id="mobile-menu-container">
        <button
          id="mobile-menu-toggle"
          className="fixed-control-btn"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          <i className={isMobileMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
        </button>

        <div id="mobile-menu-panel" className={isMobileMenuOpen ? "visible" : ""}>
          <button
            className="mobile-menu-item"
            onClick={() => { setIsAuthOpen(true); setIsMobileMenuOpen(false); }}
          >
            <i className={user ? "fas fa-user" : "fas fa-sign-in-alt"}></i>
            <span>{user ? "Account" : "Login"}</span>
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { setIsMiniPlayerOpen(true); setIsMobileMenuOpen(false); }}
          >
            <i className="fas fa-music"></i>
            <span>Music</span>
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { setIsNotepadOpen(true); setIsMobileMenuOpen(false); }}
          >
            <i className="fas fa-pen"></i>
            <span>Notes</span>
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { setIsCalendarOpen(true); setIsMobileMenuOpen(false); }}
          >
            <i className="fas fa-calendar-alt"></i>
            <span>Calendar</span>
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { toggleFullscreen(); setIsMobileMenuOpen(false); }}
          >
            <i className="fas fa-expand-arrows-alt"></i>
            <span>Fullscreen</span>
          </button>
        </div>
      </div>

      <button
        id="fullscreen-button"
        className="fixed-control-btn desktop-only"
        onClick={toggleFullscreen}
      >
        <i className="fas fa-expand-arrows-alt"></i>
      </button>

      <div id="audio-controls-fixed" className="desktop-only">
        <button
          id="audio-menu-toggle"
          className="fixed-control-btn"
          onClick={() => setIsMiniPlayerOpen((prev) => !prev)}
        >
          <i className="fas fa-music"></i>
        </button>

        <div id="mini-player-details" className={isMiniPlayerOpen ? "" : "hidden"}>
          <div className="mini-player-header">
            <span className="mini-player-title">🎵 Audio Mixer</span>
            <button className="mini-player-close" onClick={() => setIsMiniPlayerOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="audio-group">
            <div className="group-header">
              <label>
                <i className="fas fa-music"></i> Music Station
              </label>
              <div className="radio-actions">
                <button
                  className="radio-skip"
                  onClick={() =>
                    setCurrentRadioIndex((prev) =>
                      prev <= 0 ? radioLibrary.length - 1 : prev - 1
                    )
                  }
                  title="Previous"
                >
                  <i className="fas fa-backward"></i>
                </button>
                <button
                  id="mini-player-play-btn"
                  className="play-btn-circle"
                  onClick={toggleRadioPlay}
                >
                  <i className={isRadioPlaying ? "fas fa-pause" : "fas fa-play"}></i>
                </button>
                <button
                  className="radio-skip"
                  onClick={() =>
                    setCurrentRadioIndex((prev) =>
                      prev >= radioLibrary.length - 1 ? 0 : prev + 1
                    )
                  }
                  title="Next"
                >
                  <i className="fas fa-forward"></i>
                </button>
              </div>
            </div>
            <CustomSelect
              id="audio-custom-select"
              valueIndex={currentRadioIndex}
              options={radioLibrary}
              isOpen={openDropdownId === "audio-custom-select"}
              onToggle={() =>
                setOpenDropdownId((prev) =>
                  prev === "audio-custom-select" ? null : "audio-custom-select"
                )
              }
              onSelect={(idx) => {
                setCurrentRadioIndex(idx);
                setOpenDropdownId(null);
              }}
            />
            <div className="volume-container">
              <i className="fas fa-volume-down small-icon"></i>
              <input
                type="range"
                id="volume-slider"
                min="0"
                max="100"
                value={radioVolume}
                onChange={(e) => setRadioVolume(Number(e.target.value))}
              />
              <i className="fas fa-volume-up small-icon"></i>
            </div>
          </div>

          <div className="separator-line"></div>

          <div className="audio-group">
            <div className="group-header">
              <label>
                <i className="fas fa-cloud-moon"></i> Background Noise
              </label>
            </div>
            <CustomSelect
              id="ambient-custom-select"
              valueIndex={currentAmbientIndex}
              options={ambientLibrary}
              isOpen={openDropdownId === "ambient-custom-select"}
              onToggle={() =>
                setOpenDropdownId((prev) =>
                  prev === "ambient-custom-select" ? null : "ambient-custom-select"
                )
              }
              onSelect={(idx) => {
                setCurrentAmbientIndex(idx);
                setOpenDropdownId(null);
              }}
            />
            <div className="volume-container">
              <i className="fas fa-wind small-icon"></i>
              <input
                type="range"
                id="ambient-volume-slider"
                min="0"
                max="100"
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(Number(e.target.value))}
              />
              <i className="fas fa-cloud-showers-heavy small-icon"></i>
            </div>
          </div>

          <audio id="lofi-player" ref={lofiRef} loop />
          <audio id="ambient-player" ref={ambientRef} loop />
        </div>
      </div>

      <button
        id="notepad-toggle"
        className="fixed-control-btn desktop-only"
        title="Note Veloci"
        onClick={() => setIsNotepadOpen((prev) => !prev)}
      >
        <i className="fas fa-pen"></i>
      </button>

      <div
        id="floating-notepad"
        ref={notepadRef}
        className={isNotepadOpen ? "" : "hidden"}
      >
        <div className="notepad-header">
          <span className="notepad-title">📝 Brain Dump</span>
          <div className="notepad-controls">
            <button id="close-notepad-btn" onClick={() => setIsNotepadOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div className="notepad-tabs">
          <button
            className={activeNotepadTab === "notes" ? "active" : ""}
            onClick={() => setActiveNotepadTab("notes")}
          >
            Notes
          </button>
          <button
            className={activeNotepadTab === "tasks" ? "active" : ""}
            onClick={() => setActiveNotepadTab("tasks")}
          >
            Tasks
          </button>
        </div>
        {activeNotepadTab === "notes" ? (
          <textarea
            id="notepad-content"
            placeholder="Write your tasks or ideas for later here..."
            value={notepadText}
            onChange={(e) => setNotepadText(e.target.value)}
          ></textarea>
        ) : (
          <div className="tasks-panel">
            <div className="tasks-input">
              <div className="tasks-input-main">
                <input
                  type="text"
                  placeholder="Add a task and press Enter"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTask();
                  }}
                />
                <button
                  className="tasks-add-btn"
                  onClick={addTask}
                  aria-label="Add task"
                  title="Add task"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
              <input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                title="Assign date"
              />
            </div>
            <div className="tasks-list">
              {tasks.length === 0 ? (
                <div className="tasks-empty">No tasks yet. Add your first one ✨</div>
              ) : (
                tasks.map((task) => (
                  <div className={`task-item ${task.done ? "done" : ""}`} key={task.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                      />
                      <span>{task.text}</span>
                    </label>
                    {task.date ? <span className="task-date">{task.date}</span> : null}
                    <button className="task-delete" onClick={() => deleteTask(task.id)}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="tasks-footer">
              {tasks.filter((t) => !t.done).length} active · {tasks.length} total
            </div>
          </div>
        )}
      </div>

      <button
        id="calendar-toggle"
        className="fixed-control-btn desktop-only"
        title="Calendario"
        onClick={() => setIsCalendarOpen((prev) => !prev)}
      >
        <i className="fas fa-calendar-alt"></i>
      </button>

      <div id="floating-calendar" className={isCalendarOpen ? "" : "hidden"}>
        <div className="calendar-header">
          <div className="calendar-nav">
            <button onClick={() => {
              const next = new Date(calendarDate);
              next.setMonth(next.getMonth() - 1);
              setCalendarDate(next);
              setSelectedCalendarDate(formatDateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
            }}>
              <i className="fas fa-chevron-left"></i>
            </button>
          </div>
          <span id="calendar-month-year">
            {calendarDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric"
            })}
          </span>
          <div className="calendar-actions">
            <button onClick={() => {
              const next = new Date(calendarDate);
              next.setMonth(next.getMonth() + 1);
              setCalendarDate(next);
              setSelectedCalendarDate(formatDateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
            }}>
              <i className="fas fa-chevron-right"></i>
            </button>
            <button className="calendar-close" onClick={() => setIsCalendarOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="calendar-body">
          <div className="calendar-left">
            <div className="calendar-weekdays">
              <div>Lu</div>
              <div>Ma</div>
              <div>Me</div>
              <div>Gi</div>
              <div>Ve</div>
              <div>Sa</div>
              <div>Do</div>
            </div>

            <div className="calendar-grid">
              {calendarDays.map((item) => {
                if (item.type === "empty") {
                  return <div key={item.key} className="calendar-empty"></div>;
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`calendar-day${item.isToday ? " today" : ""}${
                      item.key === selectedCalendarDate ? " selected" : ""
                    }`}
                    onClick={() => setSelectedCalendarDate(item.key)}
                  >
                    <span className="calendar-day-number">{item.day}</span>
                    {item.minutes > 0 ? <span className="calendar-day-dot"></span> : null}
                    {isPremium && item.hasTask ? (
                      <span className="calendar-day-dot task"></span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="calendar-task-panel">
            <div className="calendar-task-header">
              <div className="calendar-task-date">
                {selectedCalendarDateObj.toLocaleDateString("it-IT", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short"
                })}
              </div>
              <div className="calendar-task-count">
                {isPremium
                  ? `${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}`
                  : "Premium"}
              </div>
            </div>
            {!user ? (
              <div className="calendar-task-lock">
                <div className="calendar-task-lock-icon">🔒</div>
                <h4>Login required</h4>
                <p>Sign in to use calendar tasks.</p>
                <button
                  className="stats-upgrade"
                  onClick={() => setIsLoginPromptOpen(true)}
                >
                  Login
                </button>
              </div>
            ) : !isPremium ? (
              <div className="calendar-task-lock">
                <div className="calendar-task-lock-icon">🔒</div>
                <h4>Premium only</h4>
                <p>Calendar tasks are a premium feature.</p>
                <button
                  className="stats-upgrade"
                  onClick={() => {
                    const url = new URL(PREMIUM_LINK);
                    if (user.email) url.searchParams.set("prefilled_email", user.email);
                    url.searchParams.set("client_reference_id", user.uid);
                    window.open(url.toString(), "_blank", "noopener,noreferrer");
                  }}
                >
                  Unlock Premium
                </button>
              </div>
            ) : selectedTasks.length === 0 ? (
              <div className="calendar-task-empty">No tasks for this day.</div>
            ) : (
              <div className="calendar-task-list">
                {selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`calendar-task-item${task.done ? " done" : ""}`}
                  >
                    <span className="calendar-task-text">{task.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="stats-panel" className={isStatsOpen ? "visible" : ""}>
        <div className="stats-panel-header">
          <h3>Stats</h3>
          <button className="stats-close" onClick={() => setIsStatsOpen(false)}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="stats-content">
          {!isPremium ? (
            <div className="stats-lock">
              <div className="stats-lock-icon">🔒</div>
              <h4>Premium only</h4>
              <p>Unlock detailed stats, badges, and charts.</p>
              <button
                className="stats-upgrade"
                onClick={() => {
                  if (!user) {
                    setIsLoginPromptOpen(true);
                    return;
                  }
                  const url = new URL(PREMIUM_LINK);
                  if (user.email) url.searchParams.set("prefilled_email", user.email);
                  url.searchParams.set("client_reference_id", user.uid);
                  window.open(url.toString(), "_blank", "noopener,noreferrer");
                }}
              >
                Unlock Premium
              </button>
            </div>
          ) : null}
          <div className={`stats-summary compact ${!isPremium ? "blurred" : ""}`}>
            <div>
              <span>Today</span>
              <strong>{Math.round(dailyMinutes)}m</strong>
            </div>
            <div>
              <span>Week</span>
              <strong>{weekDaysCount}d</strong>
            </div>
            <div>
              <span>Month</span>
              <strong>{monthDaysCount}d</strong>
            </div>
            <div>
              <span>Streak</span>
              <strong>{streakCount}d</strong>
            </div>
          </div>

          <div className="stats-grid">
            <div className={`goal-panel compact ${!isPremium ? "blurred" : ""}`}>
              <div className="goal-header">
                <div>
                  <span>Weekly Goal</span>
                  <strong>{Math.round(weekMinutes / 60)}h</strong>
                </div>
                <div className="goal-right">
                  <span>Target</span>
                  <strong>{Math.round(weeklyGoalMinutes / 60)}h</strong>
                </div>
              </div>
              <div className="goal-progress">
                <div style={{ width: `${weeklyGoalProgress}%` }}></div>
              </div>
              <input
                type="range"
                min="60"
                max="2400"
                step="30"
                value={weeklyGoalMinutes}
                onChange={(e) => setWeeklyGoalMinutes(Number(e.target.value))}
              />
            </div>

            <div className={`timeline-panel ${!isPremium ? "blurred" : ""}`}>
              <div className="timeline-title">Today's Sessions</div>
              <div className="timeline-bars">
                {todayHistory.length === 0 ? (
                  <div className="timeline-empty">No sessions yet.</div>
                ) : (
                  todayHistory.map((entry) => (
                    <div key={entry.id} className="timeline-bar">
                      <div className="timeline-fill" style={{ width: `${Math.min(100, entry.minutes)}%` }}></div>
                      <span>{entry.minutes}m</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className={`stats-chart line ${!isPremium ? "blurred" : ""}`}>
            <div className="chart-header">
              <div className="chart-title">Focus Trend</div>
              <div className="chart-tabs">
                <button
                  className={statsRange === "7" ? "active" : ""}
                  onClick={() => setStatsRange("7")}
                >
                  7 days
                </button>
                <button
                  className={statsRange === "30" ? "active" : ""}
                  onClick={() => setStatsRange("30")}
                >
                  30 days
                </button>
              </div>
            </div>
            {statsRange === "7" ? (
              <div className="line-chart">
                <svg viewBox="0 0 320 90" role="presentation">
                  <polyline
                    points={buildLinePoints(weeklyHistory, weeklyMax)}
                    className="line-path"
                  />
                </svg>
                <div className="line-labels">
                  {weeklyHistory.map((item) => (
                    <span key={`week-${item.label}`}>{item.label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="line-chart">
                <svg viewBox="0 0 320 90" role="presentation">
                  <polyline
                    points={buildLinePoints(monthlyHistory, monthlyMax)}
                    className="line-path"
                  />
                </svg>
                <div className="line-labels muted">
                  {monthlyHistory.map((item, idx) => (
                    <span key={`month-${item.label}-${idx}`}>{item.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {levelConfetti.length > 0 ? (
        <div className="level-confetti">
          {levelConfetti.map((item) => (
            <span
              key={item.id}
              style={{
                left: `${item.x}%`,
                width: `${item.size}px`,
                height: `${item.size}px`,
                animationDelay: `${item.delay}s`
              }}
            />
          ))}
        </div>
      ) : null}

      {isOnboardingOpen ? (
        <div id="onboarding-overlay">
          {onboardingRect ? (
            <div
              className="onboarding-highlight"
              style={{
                top: onboardingRect.top - 8,
                left: onboardingRect.left - 8,
                width: onboardingRect.width + 16,
                height: onboardingRect.height + 16
              }}
            ></div>
          ) : null}
          <div
            id="onboarding-card"
            style={{
              top: onboardingRect
                ? Math.min(
                    window.innerHeight - 220,
                    onboardingRect.top + onboardingRect.height + 16
                  )
                : "50%",
              left: onboardingRect
                ? Math.min(
                    window.innerWidth - 440,
                    Math.max(20, onboardingRect.left)
                  )
                : "50%",
              transform: onboardingRect ? "none" : "translate(-50%, -50%)",
              position: "absolute"
            }}
          >
            <div className="onboarding-step">
              <div className="onboarding-kicker">
                Step {onboardingStep + 1} / {onboardingSteps.length}
              </div>
              <h3>{onboardingSteps[onboardingStep].title}</h3>
              <p>{onboardingSteps[onboardingStep].text}</p>
            </div>
            <div className="onboarding-dots">
              {onboardingSteps.map((_, idx) => (
                <span
                  key={`onboard-dot-${idx}`}
                  className={idx === onboardingStep ? "active" : ""}
                />
              ))}
            </div>
            <div className="onboarding-actions">
              <button
                className="onboarding-ghost"
                onClick={() => {
                  localStorage.setItem("vibeOnboardingSeen", "1");
                  setIsOnboardingOpen(false);
                }}
              >
                Skip
              </button>
              <div className="onboarding-nav">
                <button
                  className="onboarding-ghost"
                  disabled={onboardingStep === 0}
                  onClick={() => setOnboardingStep((prev) => Math.max(0, prev - 1))}
                >
                  Back
                </button>
                <button
                  className="onboarding-primary"
                  onClick={() => {
                    if (onboardingStep === onboardingSteps.length - 1) {
                      localStorage.setItem("vibeOnboardingSeen", "1");
                      setIsOnboardingOpen(false);
                      return;
                    }
                    setOnboardingStep((prev) => Math.min(onboardingSteps.length - 1, prev + 1));
                  }}
                >
                  {onboardingStep === onboardingSteps.length - 1 ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        id="custom-modal-overlay"
        className={`${isModalOpen ? "active" : ""} ${isModalOpen ? "" : "hidden"}`}
      >
        <div id="custom-modal">
          <div className="modal-icon">🔥</div>
          <h3 id="modal-title">VibeDesk Focus</h3>
          <p id="modal-message">{modalMessage}</p>
          <button id="modal-close-btn" onClick={closeModal}>
            Got it
          </button>
        </div>
      </div>

      <div
        id="confirm-modal-overlay"
        className={`${isConfirmOpen ? "active" : ""} ${isConfirmOpen ? "" : "hidden"}`}
      >
        <div id="custom-modal" className="confirm-modal">
          <div className="modal-icon">🗑️</div>
          <h3 id="modal-title">Reset Stats?</h3>
          <p id="modal-message">Are you sure you want to clear your daily progress?</p>
          <div className="confirm-actions">
            <button id="confirm-yes-btn" onClick={handleResetStats}>
              Yes, Reset
            </button>
            <button id="confirm-no-btn" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        id="levels-modal-overlay"
        className={`${isLevelsOpen ? "active" : ""} ${isLevelsOpen ? "" : "hidden"}`}
      >
        <div id="levels-modal">
          <div className="levels-header">
            <div>
              <h3>Levels & Rewards</h3>
              <p>Keep a daily streak to level up your badge.</p>
            </div>
            <button
              className="levels-close"
              type="button"
              onClick={() => setIsLevelsOpen(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="levels-grid">
            <div className={`level-card ${badgeLevel.label === "Starter" ? "active" : ""}`}>
              <div className="level-icon">⭐</div>
              <div className="level-name">Starter</div>
              <div className="level-meta">0–2 days</div>
            </div>
            <div className={`level-card bronze ${badgeLevel.label === "Bronze" ? "active" : ""}`}>
              <div className="level-icon">🥉</div>
              <div className="level-name">Bronze</div>
              <div className="level-meta">3+ days</div>
            </div>
            <div className={`level-card silver ${badgeLevel.label === "Silver" ? "active" : ""}`}>
              <div className="level-icon">🥈</div>
              <div className="level-name">Silver</div>
              <div className="level-meta">7+ days</div>
            </div>
            <div className={`level-card gold ${badgeLevel.label === "Gold" ? "active" : ""}`}>
              <div className="level-icon">🥇</div>
              <div className="level-name">Gold</div>
              <div className="level-meta">14+ days</div>
            </div>
            <div className={`level-card diamond ${badgeLevel.label === "Diamond" ? "active" : ""}`}>
              <div className="level-icon">💎</div>
              <div className="level-name">Diamond</div>
              <div className="level-meta">30+ days</div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="login-modal-overlay"
        className={`${isLoginPromptOpen ? "active" : ""} ${isLoginPromptOpen ? "" : "hidden"}`}
      >
        <div id="login-modal">
          <div className="modal-icon">🔐</div>
          <h3>Login required</h3>
          <p>Please sign in to purchase Premium.</p>
          <div className="login-modal-actions">
            <button
              onClick={() => {
                setIsLoginPromptOpen(false);
                setIsAuthOpen(true);
              }}
            >
              Go to login
            </button>
            <button className="ghost" onClick={() => setIsLoginPromptOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
