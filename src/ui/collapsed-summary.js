function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function truncate(value, limit = 28) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text;
}

function pluralTasks(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return "задача";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "задачи";
  return "задач";
}

function focusTimerSummary(config, now) {
  const endsAt = Number(config.endsAt);
  const running = Boolean(config.running);
  const saved = Math.max(0, Number(config.remainingSeconds) || 0);
  const remaining = running && Number.isFinite(endsAt) ? Math.max(0, (endsAt - now) / 1000) : saved;
  return remaining > 0 ? formatDuration(remaining) : "";
}

/** Returns concise, local-only status text for a collapsed widget. */
export function getCollapsedSummary(widget, now = Date.now()) {
  const config = widget?.config || {};
  if (widget?.type === "focus-timer") return focusTimerSummary(config, now);
  if (widget?.type === "todo") {
    const tasks = Array.isArray(config.tasks) ? config.tasks : [];
    const open = tasks.filter((task) => !task?.done && !task?.completed).length;
    return open ? `${open} ${pluralTasks(open)}` : "Готово";
  }
  if (widget?.type === "rss") {
    const unread = Math.max(0, Number(config.unreadCount ?? config.unread) || 0);
    return unread ? `${unread} новых` : "";
  }
  if (widget?.type === "weather") return truncate(config.city || config.location || "");
  if (widget?.type === "browser-media" || widget?.type === "player") return truncate(config.trackTitle || config.nowPlaying || config.title || "");
  return "";
}
