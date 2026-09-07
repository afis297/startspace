import { callExtensionApi, getExtensionApi } from "./extension-api.js";

const MEDIA_PERMISSION = Object.freeze({
  permissions: ["tabs", "scripting"],
  origins: ["<all_urls>"],
});
const browserApi = () => getExtensionApi();

// This function is serialized by chrome.scripting.executeScript. Keep it self-contained.
function pageMediaSnapshot() {
  const host = location.hostname.toLowerCase().replace(/^www\./, "");
  const siteProfiles = [
    ["youtube", ["youtube.com", "youtube-nocookie.com"], "video.html5-main-video, #movie_player video"],
    ["vk-video", ["vk.com", "vkvideo.ru", "player.vk.com", "video.vk.com", "player.cdnvideohub.com", "cdnvideohub.com"], ".videoplayer video, .video_player video, .vjs-tech, video"],
    ["rutube", ["rutube.ru"], ".video-player video, .rutube-player video, video"],
    ["twitch", ["twitch.tv"], "video[data-a-target='player-video'], .video-player__video video, video"],
    ["vimeo", ["vimeo.com"], ".vp-video-wrapper video, .player video, video"],
    ["dailymotion", ["dailymotion.com", "dai.ly"], ".dmp_Player video, .dmp_Video video, video"],
    ["tiktok", ["tiktok.com"], "video[playsinline], video"],
    ["instagram", ["instagram.com"], "article video, video"],
    ["facebook", ["facebook.com", "fb.watch"], "video"],
    ["x", ["x.com", "twitter.com"], "article video, video"],
    ["ok", ["ok.ru"], ".videoplayer video, .video-player video, video"],
    ["netflix", ["netflix.com"], "video"],
    ["kinopoisk", ["kinopoisk.ru"], ".video-player video, video"],
    ["ivi", ["ivi.ru"], ".video-player video, video"],
    ["okko", ["okko.tv"], ".video-player video, video"],
    ["wink", ["wink.ru"], ".video-player video, video"],
    ["premier", ["premier.one"], ".video-player video, video"],
    ["start", ["start.ru"], ".video-player video, video"],
    ["yandex-music", ["music.yandex.ru"], "audio, video"],
    ["spotify", ["open.spotify.com"], "audio, video"],
    ["apple-music", ["music.apple.com"], "audio, video"],
    ["deezer", ["deezer.com"], "audio, video"],
    ["soundcloud", ["soundcloud.com"], "audio, video"],
    ["bandcamp", ["bandcamp.com"], "audio, video"],
    ["mixcloud", ["mixcloud.com"], "audio, video"],
    ["rumble", ["rumble.com"], ".video-js video, video"],
    ["bilibili", ["bilibili.com"], "video"],
    ["telegram", ["web.telegram.org"], "video, audio"],
  ];
  const profile = siteProfiles.find(([, hosts]) => hosts.some((site) => host === site || host.endsWith(`.${site}`))) || ["native", [], "audio, video"];
  const provider = profile[0];
  const primarySelector = profile[2];
  // VK и другие современные сайты могут помещать настоящий HTMLMediaElement
  // в открытый Shadow DOM, который обычный document.querySelectorAll не видит.
  const collectMediaNodes = () => {
    const roots = new Set();
    const nodes = [];
    const visit = (root) => {
      if (!root || roots.has(root)) return;
      roots.add(root);
      root.querySelectorAll?.("audio, video").forEach((node) => {
        if (!nodes.includes(node)) nodes.push(node);
      });
      root.querySelectorAll?.("*").forEach((entry) => {
        if (entry.shadowRoot) visit(entry.shadowRoot);
      });
    };
    visit(document);
    return nodes;
  };
  const mediaKeyFor = (node, index) => {
    if (!node.dataset.mfltMediaKey) node.dataset.mfltMediaKey = `mflt-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    return node.dataset.mfltMediaKey;
  };
  const seekLimit = (node) => {
    if (Number.isFinite(node.duration) && node.duration > 0) return node.duration;
    const ranges = node.seekable;
    return ranges?.length ? ranges.end(ranges.length - 1) : 0;
  };
  const isVisible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && (node.tagName === "AUDIO" || (rect.width >= 64 && rect.height >= 36));
  };
  const hasMediaSource = (node) => Boolean(node.currentSrc || node.src || node.srcObject || node.querySelector?.("source[src]"));
  const youtubePlayer = document.querySelector("#movie_player");
  const describe = (node, index) => {
    const isYoutube = provider === "youtube";
    const primary = Boolean(node.matches?.(primarySelector));
    const playerVolume = isYoutube && typeof youtubePlayer?.getVolume === "function" ? Number(youtubePlayer.getVolume()) : Number(node.volume) * 100;
    const playerMuted = isYoutube && typeof youtubePlayer?.isMuted === "function" ? Boolean(youtubePlayer.isMuted()) : Boolean(node.muted);
    const duration = seekLimit(node);
    return {
      mediaKey: mediaKeyFor(node, index),
      provider,
      paused: Boolean(node.paused),
      ended: Boolean(node.ended),
      isPlaying: !node.paused && !node.ended,
      muted: playerMuted,
      isPrimary: primary,
      visible: isVisible(node),
      // Только движение временной шкалы или активное воспроизведение являются
      // сигналом реального медиа. Готовый буфер/currentSrc сам по себе часто
      // принадлежит скрытому preview, например YouTube 00:00 / 60:00.
      hasSignal: (!node.paused && !node.ended) || Number(node.currentTime) > 0.1,
      volume: Math.round(Math.max(0, Math.min(100, Number.isFinite(playerVolume) ? playerVolume : 0))),
      currentTime: Math.max(0, Number(node.currentTime) || 0),
      duration: Math.max(0, Number(duration) || 0),
      canSeek: Number.isFinite(duration) && duration > 0,
    };
  };
  // VK Видео может подключать MediaSource позже, поэтому у настоящего видимого
  // <video> на первых секундах иногда ещё нет currentSrc/src. Для VK это всё
  // равно валидный кандидат; на остальных сайтах остаётся строгая проверка источника.
  const nodes = collectMediaNodes()
    .filter((node) => hasMediaSource(node) || (provider === "vk-video" && isVisible(node)));
  const candidates = nodes.map(describe).filter((candidate) => candidate.isPlaying || candidate.hasSignal || (candidate.provider === "vk-video" && candidate.isPrimary && candidate.visible));
  if (!candidates.length) return { found: false, title: document.title || "Без названия", url: location.href, candidates: [] };
  const score = (candidate) => (candidate.isPlaying ? 1000 : 0) + (candidate.isPrimary ? 80 : 0) + (candidate.visible ? 28 : 0) + (!candidate.muted ? 6 : 0) + (candidate.canSeek ? 4 : 0);
  const available = candidates.filter((candidate) => !candidate.ended);
  const selected = [...(available.length ? available : candidates)].sort((left, right) => score(right) - score(left))[0];
  return {
    found: true,
    title: document.title || "Без названия",
    url: location.href,
    mediaCount: candidates.length,
    candidates,
    ...selected,
  };
}

// This function is serialized by chrome.scripting.executeScript. Do not reference module helpers here.
async function pageMediaControl(action, value, requestedMediaKey) {
  const host = location.hostname.toLowerCase().replace(/^www\./, "");
  const siteProfiles = [
    ["youtube", ["youtube.com", "youtube-nocookie.com"], "video.html5-main-video, #movie_player video"],
    ["vk-video", ["vk.com", "vkvideo.ru", "player.vk.com", "video.vk.com", "player.cdnvideohub.com", "cdnvideohub.com"], ".videoplayer video, .video_player video, .vjs-tech, video"],
    ["rutube", ["rutube.ru"], ".video-player video, .rutube-player video, video"],
    ["twitch", ["twitch.tv"], "video[data-a-target='player-video'], .video-player__video video, video"],
    ["vimeo", ["vimeo.com"], ".vp-video-wrapper video, .player video, video"],
    ["dailymotion", ["dailymotion.com", "dai.ly"], ".dmp_Player video, .dmp_Video video, video"],
    ["tiktok", ["tiktok.com"], "video[playsinline], video"],
    ["instagram", ["instagram.com"], "article video, video"],
    ["facebook", ["facebook.com", "fb.watch"], "video"],
    ["x", ["x.com", "twitter.com"], "article video, video"],
    ["ok", ["ok.ru"], ".videoplayer video, .video-player video, video"],
    ["netflix", ["netflix.com"], "video"],
    ["kinopoisk", ["kinopoisk.ru"], ".video-player video, video"],
    ["ivi", ["ivi.ru"], ".video-player video, video"],
    ["okko", ["okko.tv"], ".video-player video, video"],
    ["wink", ["wink.ru"], ".video-player video, video"],
    ["premier", ["premier.one"], ".video-player video, video"],
    ["start", ["start.ru"], ".video-player video, video"],
    ["yandex-music", ["music.yandex.ru"], "audio, video"],
    ["spotify", ["open.spotify.com"], "audio, video"],
    ["apple-music", ["music.apple.com"], "audio, video"],
    ["deezer", ["deezer.com"], "audio, video"],
    ["soundcloud", ["soundcloud.com"], "audio, video"],
    ["bandcamp", ["bandcamp.com"], "audio, video"],
    ["mixcloud", ["mixcloud.com"], "audio, video"],
    ["rumble", ["rumble.com"], ".video-js video, video"],
    ["bilibili", ["bilibili.com"], "video"],
    ["telegram", ["web.telegram.org"], "video, audio"],
  ];
  const profile = siteProfiles.find(([, hosts]) => hosts.some((site) => host === site || host.endsWith(`.${site}`))) || ["native", [], "audio, video"];
  const provider = profile[0];
  const primarySelector = profile[2];
  // VK и другие современные сайты могут помещать настоящий HTMLMediaElement
  // в открытый Shadow DOM, который обычный document.querySelectorAll не видит.
  const collectMediaNodes = () => {
    const roots = new Set();
    const nodes = [];
    const visit = (root) => {
      if (!root || roots.has(root)) return;
      roots.add(root);
      root.querySelectorAll?.("audio, video").forEach((node) => {
        if (!nodes.includes(node)) nodes.push(node);
      });
      root.querySelectorAll?.("*").forEach((entry) => {
        if (entry.shadowRoot) visit(entry.shadowRoot);
      });
    };
    visit(document);
    return nodes;
  };
  const mediaKeyFor = (node, index) => {
    if (!node.dataset.mfltMediaKey) node.dataset.mfltMediaKey = `mflt-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    return node.dataset.mfltMediaKey;
  };
  const hasMediaSource = (node) => Boolean(node.currentSrc || node.src || node.srcObject || node.querySelector?.("source[src]"));
  const isVisible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && (node.tagName === "AUDIO" || (rect.width >= 64 && rect.height >= 36));
  };
  const nodes = collectMediaNodes()
    .filter((node) => hasMediaSource(node) || (provider === "vk-video" && isVisible(node)));
  const keyed = nodes.map((node, index) => ({ node, index, mediaKey: mediaKeyFor(node, index), isPrimary: Boolean(node.matches?.(primarySelector)) }));
  const rank = (entry) => (entry.node.paused || entry.node.ended ? 0 : 1000) + (entry.isPrimary ? 80 : 0) + (entry.node.muted ? 0 : 6);
  const ordered = [...keyed].sort((left, right) => rank(right) - rank(left));
  const chosen = keyed.find((entry) => entry.mediaKey === requestedMediaKey)
    || ordered.find((entry) => !entry.node.ended)
    || ordered[0];
  if (!chosen) return { found: false, message: "На странице не найден HTML-аудио или видео-плеер." };

  const { node: active, mediaKey } = chosen;
  const isYoutube = provider === "youtube";
  const youtubePlayer = isYoutube ? document.querySelector("#movie_player") : null;
  const seekLimit = () => {
    if (Number.isFinite(active.duration) && active.duration > 0) return active.duration;
    const ranges = active.seekable;
    return ranges?.length ? ranges.end(ranges.length - 1) : 0;
  };
  const snapshot = (message = "") => {
    const apiVolume = isYoutube && typeof youtubePlayer?.getVolume === "function" ? Number(youtubePlayer.getVolume()) : Number(active.volume) * 100;
    const apiMuted = isYoutube && typeof youtubePlayer?.isMuted === "function" ? Boolean(youtubePlayer.isMuted()) : Boolean(active.muted);
    const duration = seekLimit();
    return {
      found: true,
      provider,
      title: document.title || "Без названия",
      url: location.href,
      mediaKey,
      mediaCount: nodes.length,
      paused: Boolean(active.paused),
      ended: Boolean(active.ended),
      muted: apiMuted,
      volume: Math.round(Math.max(0, Math.min(100, Number.isFinite(apiVolume) ? apiVolume : 0))),
      currentTime: Math.max(0, Number(active.currentTime) || 0),
      duration: Math.max(0, Number(duration) || 0),
      message,
    };
  };

  try {
    if (action === "previous" || action === "next") {
    const isPrevious = action === "previous";
    const providerSelector = isPrevious
      ? (provider === "youtube" ? ".ytp-prev-button" : "")
      : (provider === "youtube" ? ".ytp-next-button" : "");
    const labelPattern = isPrevious ? /предыдущ|previous|prev\s*(track|song|video)?/i : /следующ|next\s*(track|song|video)?/i;
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return !node.disabled && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const target = (providerSelector && document.querySelector(providerSelector))
      || [...document.querySelectorAll("button, [role=\"button\"], a")].find((node) => visible(node) && labelPattern.test(`${node.getAttribute("aria-label") || ""} ${node.title || ""} ${node.textContent || ""}`));
    if (!target) return snapshot(isPrevious ? "Этот сайт не предоставляет кнопку предыдущего трека." : "Этот сайт не предоставляет кнопку следующего трека.");
    target.click();
    return snapshot();
  }

  if (action === "toggle") {
      if (!active.paused && !active.ended) active.pause();
      else {
        try {
          await active.play();
        } catch {
          // Some YouTube pages ignore play() even after a direct user gesture.
          if (isYoutube) {
            const playerSurface = document.querySelector("#movie_player") || active;
            playerSurface.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", bubbles: true }));
            playerSurface.dispatchEvent(new KeyboardEvent("keyup", { key: "k", code: "KeyK", bubbles: true }));
          } else return snapshot("Сайт не разрешил запуск. Откройте вкладку с плеером и попробуйте ещё раз.");
        }
      }
    }
    if (action === "seek") {
      const limit = seekLimit();
      if (Number.isFinite(limit) && limit > 0) {
        const next = Math.max(0, Math.min(limit, (Number(active.currentTime) || 0) + (Number(value) || 0)));
        active.currentTime = next;
        if (isYoutube && typeof youtubePlayer?.seekTo === "function") youtubePlayer.seekTo(next, true);
      } else if (!active.paused) return snapshot("Это прямой эфир: перемотка недоступна.");
    }
    if (action === "volume") {
      const next = Math.max(0, Math.min(100, Number(value) || 0));
      if (next > 0) active.muted = false;
      active.volume = next / 100;
      if (isYoutube) {
        if (typeof youtubePlayer?.setVolume === "function") youtubePlayer.setVolume(next);
        if (next > 0 && typeof youtubePlayer?.unMute === "function") youtubePlayer.unMute();
      }
      active.dispatchEvent(new Event("volumechange", { bubbles: true }));
    }
    if (action === "mute") {
      const nextMuted = !(isYoutube && typeof youtubePlayer?.isMuted === "function" ? Boolean(youtubePlayer.isMuted()) : Boolean(active.muted));
      active.muted = nextMuted;
      if (isYoutube) {
        if (nextMuted && typeof youtubePlayer?.mute === "function") youtubePlayer.mute();
        if (!nextMuted && typeof youtubePlayer?.unMute === "function") youtubePlayer.unMute();
      }
      active.dispatchEvent(new Event("volumechange", { bubbles: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 90));
    return snapshot();
  } catch {
    return snapshot("Плеер не принял команду: обновите вкладку и повторите поиск.");
  }
}

async function executeInTab(tabId, func, args = [], frameId = null, allResults = false) {
  const api = browserApi();
  if (!api?.scripting?.executeScript) throw new Error("Управление воспроизведением доступно только внутри Chrome-расширения после выдачи доступа.");
  const target = Number.isInteger(frameId) ? { tabId, frameIds: [frameId] } : { tabId, allFrames: true };
  // Vivaldi rejects undefined in ScriptInjection.args; null is a valid no-value marker.
  const serializableArgs = args.map((value) => value === undefined ? null : value);
  const injection = { target, func, args: serializableArgs, world: "MAIN" };
  let results;
  try {
    results = await callExtensionApi(api.scripting.executeScript, api.scripting, [injection]);
  } catch (mainWorldError) {
    // Older Chromium-based builds can reject the world field. A normal isolated
    // injection still handles native HTMLMediaElement controls on most pages.
    const fallbackInjection = { target, func, args: serializableArgs };
    try {
      results = await callExtensionApi(api.scripting.executeScript, api.scripting, [fallbackInjection]);
    } catch {
      throw mainWorldError;
    }
  }
  const snapshots = (results || [])
    .filter((item) => item?.result)
    .map((item) => ({ ...item.result, frameId: item.frameId }));
  if (allResults) return snapshots;
  const successful = snapshots.find((item) => item?.found) || snapshots[0];
  return successful || null;
}

async function permissionContains() {
  const api = browserApi();
  if (!api?.permissions?.contains) return false;
  return Boolean(await callExtensionApi(api.permissions.contains, api.permissions, [MEDIA_PERMISSION]));
}

export async function hasBrowserMediaPermission() {
  try {
    return await permissionContains();
  } catch {
    return false;
  }
}

export async function ensureBrowserMediaPermission() {
  const api = browserApi();
  if (!api?.permissions?.request) return { granted: false, message: "Откройте расширение в Chrome, чтобы выдать доступ к медиавкладкам." };
  try {
    if (await permissionContains()) return { granted: true };
    const granted = Boolean(await callExtensionApi(api.permissions.request, api.permissions, [MEDIA_PERMISSION]));
    return granted ? { granted: true } : { granted: false, message: "Доступ к медиавкладкам не предоставлен." };
  } catch (error) {
    console.warn("Не удалось запросить доступ к медиавкладкам.", error);
    return { granted: false, message: "Chrome не смог выдать доступ к медиавкладкам." };
  }
}

function sameSource(candidate, session) {
  return Number(candidate?.tabId) === Number(session?.tabId)
    && Number(candidate?.frameId) === Number(session?.frameId)
    && String(candidate?.mediaKey || "") === String(session?.mediaKey || "");
}

function sourceScore(candidate, session) {
  let score = 0;
  // При новом ручном поиске слышимый активный плеер получает решающий приоритет:
  // он должен заменить старую фоновую YouTube-сессию, даже если та ещё играет.
  if (candidate.isPlaying) score += candidate.audible ? 520 : 180;
  if (candidate.audible) score += 620;
  if (candidate.active) score += 70;
  if (sameSource(candidate, session) && !session.forceRefresh) score += 90;
  if (candidate.isPrimary) score += 80;
  if (candidate.visible) score += 28;
  if (candidate.hasSignal) score += 22;
  if (!candidate.muted) score += 6;
  if (candidate.canSeek) score += 4;
  return score;
}

function chooseSource(candidates, session = {}) {
  const liveCandidates = candidates.filter((candidate) => !candidate.ended);
  const pool = liveCandidates.length ? liveCandidates : candidates;
  if (!pool.length) return null;
  const current = pool.find((candidate) => sameSource(candidate, session));
  // Keep the selected player while it is still playing. A second simultaneous stream
  // must not silently steal control; the user can use «Другой источник» to switch.
  if (!session.cycle && !session.forceRefresh && current?.isPlaying) return current;
  const ordered = [...pool].sort((left, right) => {
    const score = sourceScore(right, session) - sourceScore(left, session);
    if (score) return score;
    return Number(right.lastAccessed || 0) - Number(left.lastAccessed || 0);
  });
  if (session.cycle && current) {
    const currentIndex = ordered.findIndex((candidate) => sameSource(candidate, session));
    if (currentIndex >= 0) return ordered[(currentIndex + 1) % ordered.length];
  }
  return ordered[0];
}

export async function discoverBrowserMedia(session = {}) {
  const api = browserApi();
  if (!await permissionContains()) return { found: false, permissionRequired: true, message: "Нужно разрешение на управление медиавкладками." };
  const requested = Number.isInteger(session) ? { tabId: session } : (session || {});
  try {
    const tabs = await callExtensionApi(api.tabs.query, api.tabs, [{}]);
    const ordered = [...tabs]
      .filter((tab) => Number.isInteger(tab.id) && !tab.discarded)
      .sort((left, right) => {
        const preferredOrder = Number(right.id === requested.tabId) - Number(left.id === requested.tabId);
        if (preferredOrder) return preferredOrder;
        const audibleOrder = Number(Boolean(right.audible)) - Number(Boolean(left.audible));
        if (audibleOrder) return audibleOrder;
        const activeOrder = Number(Boolean(right.active)) - Number(Boolean(left.active));
        if (activeOrder) return activeOrder;
        return Number(right.lastAccessed || 0) - Number(left.lastAccessed || 0);
      })
      .slice(0, 24);
    if (!ordered.length) return { found: false, message: "Chrome не видит доступных вкладок для поиска медиаплеера." };

    const candidates = [];
    let lastFailure = null;
    for (const tab of ordered) {
      try {
        const snapshots = await executeInTab(tab.id, pageMediaSnapshot, [], null, true);
        snapshots.filter((snapshot) => snapshot?.found).forEach((snapshot) => {
          (snapshot.candidates || []).forEach((candidate) => {
            const belongsToCurrentSession = Number(tab.id) === Number(requested.tabId)
              && Number(snapshot.frameId) === Number(requested.frameId)
              && String(candidate.mediaKey || "") === String(requested.mediaKey || "");
            const isRealCandidate = candidate.isPlaying || candidate.hasSignal || (candidate.provider === "vk-video" && candidate.isPrimary && candidate.visible);
            // Не добавляем паузные preview/preload-видео из сторонних вкладок. Уже
            // выбранный источник сохраняем, чтобы виджет не терял управление на паузе.
            if (!isRealCandidate && (!belongsToCurrentSession || requested.forceRefresh)) return;
            candidates.push({
              ...candidate,
              tabId: tab.id,
              frameId: snapshot.frameId,
              tabTitle: tab.title || snapshot.title,
              tabMuted: Boolean(tab.mutedInfo?.muted),
              audible: Boolean(tab.audible),
              active: Boolean(tab.active),
              lastAccessed: Number(tab.lastAccessed || 0),
            });
          });
        });
      } catch (error) {
        lastFailure = error;
      }
    }
    const selected = chooseSource(candidates, requested);
    if (!selected) return { found: false, message: lastFailure ? "Медиавкладка найдена, но сайт не разрешает доступ к плееру." : "Не найден HTML-аудио или видео-плеер: откройте вкладку с воспроизведением и повторите поиск." };
    const sourceCount = candidates.filter((candidate) => !candidate.ended).length || candidates.length;
    return {
      found: true,
      provider: selected.provider,
      tabId: selected.tabId,
      frameId: selected.frameId,
      mediaKey: selected.mediaKey,
      tabTitle: selected.tabTitle,
      title: selected.tabTitle,
      tabMuted: selected.tabMuted,
      muted: selected.muted,
      paused: selected.paused,
      ended: selected.ended,
      volume: selected.volume,
      currentTime: selected.currentTime,
      duration: selected.duration,
      mediaCount: sourceCount,
      sourceCount,
      message: sourceCount > 1 ? `Доступно источников: ${sourceCount}` : "",
    };
  } catch (error) {
    console.warn("Не удалось найти воспроизведение во вкладках.", error);
    return { found: false, message: "Не удалось прочитать список вкладок с воспроизведением." };
  }
}

export async function controlBrowserMedia(tabId, action, value, frameId = null, mediaKey = "") {
  if (!Number.isInteger(tabId)) return { found: false, message: "Сначала найдите воспроизведение во вкладке." };
  try {
    let media = await executeInTab(tabId, pageMediaControl, [action, value, mediaKey], frameId);
    // A player can replace its iframe after discovery. Retry every frame and retain the new owner.
    if (!media?.found && Number.isInteger(frameId)) media = await executeInTab(tabId, pageMediaControl, [action, value, mediaKey]);
    return media ? { ...media, tabId } : { found: false, message: "Сайт не вернул состояние плеера." };
  } catch (error) {
    console.warn("Не удалось передать команду медиаплееру.", error);
    return { found: false, message: "Команда не выполнена: вкладка могла быть закрыта или сайт запретил внедрение." };
  }
}

export async function focusBrowserMediaTab(tabId) {
  const api = browserApi();
  if (!api?.tabs?.update || !Number.isInteger(tabId)) return false;
  try { await callExtensionApi(api.tabs.update, api.tabs, [tabId, { active: true }]); return true; } catch { return false; }
}
