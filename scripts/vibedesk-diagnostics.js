(() => {
  if (!window.__vibeDebug) {
    console.warn("VibeDesk debug not available. Make sure you're running in dev mode (npm run dev)." );
    return;
  }

  const snap = window.__vibeDebug.snapshot();
  console.group("VibeDesk Diagnostics");
  console.table(snap);

  const checks = [];
  checks.push(["Auth", snap.user ? "OK" : "MISSING", snap.user]);
  checks.push(["Premium", snap.isPremium ? "YES" : "NO", "Firestore users/{uid}.isPremium"]);
  checks.push(["Tasks", snap.tasksCount > 0 ? "OK" : "EMPTY", snap.tasksCount]);
  checks.push(["Notes", snap.notesLength > 0 ? "OK" : "EMPTY", snap.notesLength]);
  checks.push(["Presets", snap.presetsCount > 0 ? "OK" : "EMPTY", snap.presetsCount]);
  checks.push(["Weekly Goal", snap.weeklyGoalMinutes ? "OK" : "MISSING", snap.weeklyGoalMinutes]);
  checks.push(["Streak", typeof snap.streakCount === "number" ? "OK" : "MISSING", snap.streakCount]);
  checks.push(["Session History", snap.sessionHistoryCount > 0 ? "OK" : "EMPTY", snap.sessionHistoryCount]);
  checks.push(["Today Minutes", typeof snap.todayMinutes === "number" ? "OK" : "MISSING", snap.todayMinutes]);

  console.table(checks.map(([name, status, detail]) => ({ name, status, detail })));

  console.info("Next checks (manual):");
  console.info("1) Verify Firestore users/{uid} fields match local state.");
  console.info("2) Open in another browser and confirm sync for tasks/notes/presets.");
  console.info("3) Premium flow: unlock -> isPremium true -> features unlocked.");
  console.groupEnd();
})();
