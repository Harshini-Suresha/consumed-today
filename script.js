/**
 * consumed.today
 * Clean monthly planner backed by the existing logs array.
 */

const CATEGORIES = [
  { key: "physical", label: "physical" },
  { key: "video", label: "video" },
  { key: "text", label: "text" },
  { key: "audio", label: "audio" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let logData = {};
let loggedKeys = new Set();
let calYear;
let calMonth;
let selDay = null;

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shouldSkipAudioEntry(value) {
  return /advertis|promo|sponsor|\bad\b/.test(value);
}

function cleanAudioText(value) {
  return String(value)
    .replace(/\bX.Com (—|-) X\b/gi, "")
    .replace(/\bRecommended for (u|you)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .replace(/\s*[-|]+\s*$/g, "")
    .trim();
}

function normalizeAudioItem(item) {
  if (typeof item === "string") return cleanAudioText(item);
  if (!item || typeof item !== "object") return item;
  return { ...item, title: cleanAudioText(item.title || "") };
}

function parseDateShort(dateShort) {
  const parts = String(dateShort || "").split("/");
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = 2000 + Number(parts[2]);
  if (!day || !month || !year) return null;

  return { y: year, m: month, d: day };
}

function dateKeyFromParts(parts) {
  return `${parts.y}-${parts.m}-${parts.d}`;
}

function dateValue(parts) {
  return new Date(parts.y, parts.m - 1, parts.d).getTime();
}

function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function latestLoggedParts() {
  const entries = (Array.isArray(logs) ? logs : [])
    .map((entry) => parseDateShort(entry.dateShort))
    .filter(Boolean)
    .sort((a, b) => dateValue(b) - dateValue(a));

  return entries[0] || todayParts();
}

function monthValue(year, month) {
  return year * 12 + month;
}

function maxVisibleMonth() {
  const latest = latestLoggedParts();
  return monthValue(latest.y, latest.m);
}

function canNavigate(dir) {
  const nextMonth = calMonth + dir;
  const nextYear = calYear + (nextMonth < 1 ? -1 : nextMonth > 12 ? 1 : 0);
  const normalizedMonth = nextMonth < 1 ? 12 : nextMonth > 12 ? 1 : nextMonth;
  return monthValue(nextYear, normalizedMonth) <= maxVisibleMonth();
}

function normalizeItems(key, items) {
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items || []) {
    const normalizedItem = key === "audio" ? normalizeAudioItem(item) : item;
    const text = typeof normalizedItem === "string"
      ? normalizedItem
      : normalizedItem?.title || normalizedItem?.name || "";
    const normalized = String(text).toLowerCase().trim();

    if (key === "audio" && (!normalized || shouldSkipAudioEntry(normalized))) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    uniqueItems.push(normalizedItem);
  }

  return uniqueItems;
}

function buildLogData(audioByDate) {
  logData = {};
  loggedKeys = new Set();

  for (const entry of Array.isArray(logs) ? logs : []) {
    const parts = parseDateShort(entry.dateShort);
    if (!parts) continue;

    const key = dateKeyFromParts(parts);
    const audio = [
      ...(entry.audio || []),
      ...((entry.dateShort && audioByDate[entry.dateShort]) || []),
    ];

    logData[key] = {
      date: entry.date,
      dateShort: entry.dateShort,
      physical: normalizeItems("physical", entry.physical || []),
      text: normalizeItems("text", entry.text || []),
      audio: normalizeItems("audio", audio),
      video: normalizeItems("video", entry.video || []),
    };
    loggedKeys.add(key);
  }
}

async function fetchLastfmForDateShort(dateShort) {
  const { apiKey, username } = CONFIG.lastfm;
  if (!apiKey || apiKey.startsWith("PASTE")) return [];

  const parts = parseDateShort(dateShort);
  if (!parts) return [];

  const from = Math.floor(new Date(parts.y, parts.m - 1, parts.d, 0, 0, 0).getTime() / 1000);
  const to = Math.floor(new Date(parts.y, parts.m - 1, parts.d, 23, 59, 59).getTime() / 1000);
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks`
    + `&user=${encodeURIComponent(username)}`
    + `&api_key=${encodeURIComponent(apiKey)}`
    + `&from=${from}&to=${to}&limit=200&format=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const tracks = data?.recenttracks?.track || [];
    const arr = Array.isArray(tracks) ? tracks : [tracks];
    const seen = new Set();
    const result = [];

    for (const t of arr) {
      if (t["@attr"]?.nowplaying) continue;
      const artist = t.artist?.["#text"]?.trim() || "";
      const track = cleanAudioText(t.name?.trim() || "");
      const normalizedTrack = track.toLowerCase();

      if (!track || shouldSkipAudioEntry(normalizedTrack) || seen.has(normalizedTrack)) continue;

      seen.add(normalizedTrack);
      result.push({ title: `${artist} - ${track}` });
    }

    return result;
  } catch (e) {
    console.warn("Last.fm fetch failed for", dateShort, e);
    return [];
  }
}

function calNav(dir) {
  if (!canNavigate(dir)) return;

  calMonth += dir;
  if (calMonth < 1) {
    calMonth = 12;
    calYear -= 1;
  }
  if (calMonth > 12) {
    calMonth = 1;
    calYear += 1;
  }

  selDay = null;
  render();
}

function selectDay(d) {
  const nextDay = selDay === d ? null : d;
  selDay = nextDay;
  render();
  if (nextDay) {
    requestAnimationFrame(() => {
      document.getElementById("dropdownArea")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "end",
      });
    });
  }
}

function displayTitle(item, categoryKey) {
  const raw = typeof item === "string" ? item : item?.name || item?.title || "";
  const text = cleanAudioText(raw).replace(/ â€” /g, " - ");
  if (categoryKey === "audio") {
    const parts = text.split(/ (?:—|-) /);
    return parts.length > 1 ? parts.pop() : text;
  }
  return text;
}

function summarizeDay(data) {
  for (const category of CATEGORIES) {
    const items = data[category.key] || [];
    if (items.length) {
      const title = displayTitle(items[0], category.key);
      return {
        title: title || category.label,
        more: items.length > 1 ? `+${items.length - 1}` : "",
      };
    }
  }

  return null;
}

function itemText(item, categoryKey) {
  return displayTitle(item, categoryKey) || "untitled";
}

function renderCategoryItems(data, category) {
  const items = data[category.key] || [];
  if (!items.length) return `<p class="detail-empty">nothing logged</p>`;

  return `<ul class="detail-list">
    ${items.map((item) => {
      const text = escHtml(itemText(item, category.key));
      const link = typeof item === "object" && item?.link
        ? ` href="${escHtml(item.link)}" target="_blank" rel="noreferrer"`
        : "";
      const tag = link ? "a" : "span";
      return `<li><${tag}${link}>${text}</${tag}></li>`;
    }).join("")}
  </ul>`;
}

function renderDayDetail(data) {
  return `<aside class="day-detail" aria-label="Selected day details">
    <div class="detail-head">
      <span>${escHtml(data.date || "Selected day")}</span>
      <button class="detail-close" type="button" aria-label="Close details" onclick="selectDay(${selDay})">&times;</button>
    </div>
    <div class="detail-sections">
      ${CATEGORIES.map((category) => `<section class="detail-section">
        <h2>${escHtml(category.label)}</h2>
        ${renderCategoryItems(data, category)}
      </section>`).join("")}
    </div>
  </aside>`;
}

function addMonths(year, month, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return { y: date.getFullYear(), m: date.getMonth() + 1 };
}

function renderMiniMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dim = new Date(year, month, 0).getDate();
  let html = `<div class="mini-month">
    <div class="mini-title">${MONTHS[month - 1]} ${year}</div>
    <div class="mini-grid">
      ${WEEKDAYS.map((day) => `<span class="mini-day-name">${day.slice(0, 1)}</span>`).join("")}`;

  for (let i = 0; i < firstDay; i += 1) {
    html += `<span class="mini-empty">0</span>`;
  }

  for (let d = 1; d <= dim; d += 1) {
    html += `<span class="mini-day">${d}</span>`;
  }

  html += `</div></div>`;
  return html;
}

function renderUpcomingMonths() {
  const area = document.getElementById("dropdownArea");
  const full = document.getElementById("fullDetail");
  if (selDay) {
    const key = dateKeyFromParts({ y: calYear, m: calMonth, d: selDay });
    // render a full-page detail view
    if (full) {
      full.innerHTML = renderDayFull(logData[key] || {
        date: `${MONTHS[calMonth - 1]} ${selDay}, ${calYear}`,
      });
      full.setAttribute('aria-hidden', 'false');
    }
    // clear the small-side area
    area.innerHTML = "";
    return;
  }

  if (full) {
    full.innerHTML = "";
    full.setAttribute('aria-hidden', 'true');
  }

  const months = [1, 2, 3].map((offset) => addMonths(calYear, calMonth, offset));
  area.innerHTML = `<aside class="upcoming" aria-label="Upcoming months">
    ${months.map(({ y, m }) => renderMiniMonth(y, m)).join("")}
  </aside>`;
}

function renderDayFull(data) {
  return `<div class="full-head">
    <h1>${escHtml(data.date || 'Selected day')}</h1>
    <button class="full-close" type="button" aria-label="Close full details" onclick="selectDay(${selDay})">&times;</button>
  </div>
  <div class="full-grid">
    ${CATEGORIES.map((category) => `<section class="full-section">
      <h2>${escHtml(category.label)}</h2>
      ${renderCategoryItems(data, category)}
    </section>`).join("")}
  </div>`;
}

function render() {
  document.body.classList.toggle("detail-open", Boolean(selDay));
  document.getElementById("nextMonth").disabled = !canNavigate(1);
  renderCalendar();
  renderUpcomingMonths();
}

function renderCalendar() {
  const yearText = String(calYear);
  document.getElementById("calYear").textContent = yearText.split("").join("\n");
  document.getElementById("calMonth").textContent = MONTHS[calMonth - 1];

  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const dim = new Date(calYear, calMonth, 0).getDate();
  const today = todayParts();
  let html = WEEKDAYS.map((d) => `<div class="dl">${d}</div>`).join("");

  for (let i = 0; i < firstDay; i += 1) {
    html += `<div class="dtile empty"></div>`;
  }

  for (let d = 1; d <= dim; d += 1) {
    const parts = { y: calYear, m: calMonth, d };
    const key = dateKeyFromParts(parts);
    const isToday = calYear === today.y && calMonth === today.m && d === today.d;
    const isFuture = dateValue(parts) > dateValue(today);
    const isLogged = loggedKeys.has(key);
    const isSel = selDay === d;
    const data = logData[key] || {};
    const summary = summarizeDay(data);

    let cls = "dtile ";
    if (!isLogged) cls += "empty ";
    if (isFuture && !isLogged) cls += "future ";
    if (isToday) cls += "t-today ";
    if (isSel) cls += "t-sel ";

    const dotLabel = summary?.title || data.date || "logged day";
    const note = isLogged
      ? `<span class="entry-dots" aria-label="${escHtml(dotLabel)}">
          <span></span><span></span><span></span><span></span>
        </span>`
      : "";
    const clickable = isLogged || isToday;

    html += `<button class="${cls.trim()}" type="button" ${clickable ? `onclick="selectDay(${d})"` : "disabled"}>
      <span class="dn">${d}</span>${note}
    </button>`;
  }

  document.getElementById("calGrid").innerHTML = html;
}

async function init() {
  const latest = latestLoggedParts();
  calYear = latest.y;
  calMonth = latest.m;

  buildLogData({});
  render();

  const audioByDate = {};
  await Promise.all((logs || []).map(async (entry) => {
    if (!entry.dateShort) return;
    const tracks = await fetchLastfmForDateShort(entry.dateShort);
    if (tracks.length > 0) audioByDate[entry.dateShort] = tracks;
  }));

  buildLogData(audioByDate);
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("prevMonth").addEventListener("click", () => calNav(-1));
  document.getElementById("nextMonth").addEventListener("click", () => calNav(1));
  init();
});
