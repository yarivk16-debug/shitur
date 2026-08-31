const API_ROOT = "/api/airtable";

const TABLES = {
  users: "tbl9jDv9YMhdNQ054",
  shifts: "tbllB2O9DGz8uYncu",
  assignments: "tblYgIC9b4X7cexbz",
  change: "tblUubUEHvTpB6jiy",
  notifications: "Notifications"
};

const FIELDS = {
  users: {
    username: ["﻿מזהה משתמש", "מזהה משתמש"],
    name: "שם מלא",
    phone: "טלפון",
    email: "אימייל",
    role: "תפקיד",
    status: "סטטוס",
    qualified: "כשיר למשמרת",
    password: ["סיסמה", "Password", "password"]
  },
  shifts: {
    id: ["﻿מזהה משמרת", "מזהה משמרת"],
    date: "תאריך",
    day: "יום",
    start: "שעת התחלה",
    end: "שעת סיום",
    type: "סוג משמרת",
    location: "מיקום",
    required: "כמות נדרשת",
    approved: "משובצים מאושרים",
    available: "פנויים",
    status: "סטטוס",
    notes: "הערות מנהל"
  },
  assignments: {
    id: ["﻿מזהה שיבוץ", "מזהה שיבוץ"],
    shiftId: "מזהה משמרת",
    username: "שם משתמש",
    status: "סטטוס שיבוץ",
    requestDate: "תאריך בקשה",
    approvedBy: "אושר על ידי",
    approvalDate: "תאריך אישור",
    notes: "הערות"
  },
  notifications: {
    title: ["Title", "כותרת"],
    body: ["Body", "תוכן"],
    target: ["Target", "יעד"],
    createdAt: ["Date", "תאריך"],
    createdBy: ["Created By", "נוצר על ידי"],
    readBy: ["Read By", "נקרא על ידי"]
  }
};

let state = {
  users: [],
  shifts: [],
  assignments: [],
  notifications: [],
  user: null,
  calendarDate: new Date(),
  calendarLayout: "calendar",
  printScope: null,
  draggedShiftId: "",
  managerAssignmentShiftId: "",
  holidaysByYear: {},
  loadingHolidayYears: new Set()
};

const els = {
  loginScreen: document.getElementById("loginScreen"),
  mainShell: document.getElementById("mainShell"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  rememberLoginInput: document.getElementById("rememberLoginInput"),
  activeUserLabel: document.getElementById("activeUserLabel"),
  logoutButton: document.getElementById("logoutButton"),
  refreshButton: document.getElementById("refreshButton"),
  monthlyTableButton: document.getElementById("monthlyTableButton"),
  createMonthButton: document.getElementById("createMonthButton"),
  printMonthButton: document.getElementById("printMonthButton"),
  printScopeSelect: document.getElementById("printScopeSelect"),
  printScheduleButton: document.getElementById("printScheduleButton"),
  statusMessage: document.getElementById("statusMessage"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  openCount: document.getElementById("openCount"),
  pendingCount: document.getElementById("pendingCount"),
  approvedCount: document.getElementById("approvedCount"),
  noticeCount: document.getElementById("noticeCount"),
  myAssignments: document.getElementById("myAssignments"),
  nextOpenShifts: document.getElementById("nextOpenShifts"),
  openShiftsList: document.getElementById("openShiftsList"),
  shiftSearchInput: document.getElementById("shiftSearchInput"),
  shiftStatusFilter: document.getElementById("shiftStatusFilter"),
  calendarGrid: document.getElementById("calendarGrid"),
  calendarTitle: document.getElementById("calendarTitle"),
  prevMonthButton: document.getElementById("prevMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),
  pendingAssignments: document.getElementById("pendingAssignments"),
  createShiftForm: document.getElementById("createShiftForm"),
  shiftHoursForm: document.getElementById("shiftHoursForm"),
  notificationsList: document.getElementById("notificationsList"),
  noticeTitleInput: document.getElementById("noticeTitleInput"),
  noticeBodyInput: document.getElementById("noticeBodyInput"),
  sendNoticeButton: document.getElementById("sendNoticeButton"),
  contextMenu: document.getElementById("contextMenu"),
  assignmentModal: document.getElementById("assignmentModal"),
  assignmentModalTitle: document.getElementById("assignmentModalTitle"),
  assignmentModalSubtitle: document.getElementById("assignmentModalSubtitle"),
  assignmentModalClose: document.getElementById("assignmentModalClose"),
  assignmentModalAssigned: document.getElementById("assignmentModalAssigned"),
  assignmentVolunteerSelect: document.getElementById("assignmentVolunteerSelect"),
  assignmentAddExistingButton: document.getElementById("assignmentAddExistingButton"),
  assignmentToggleNewVolunteerButton: document.getElementById("assignmentToggleNewVolunteerButton"),
  assignmentNewVolunteerForm: document.getElementById("assignmentNewVolunteerForm"),
  newVolunteerNameInput: document.getElementById("newVolunteerNameInput"),
  newVolunteerPhoneInput: document.getElementById("newVolunteerPhoneInput")
};

function field(record, names, fallback = "") {
  if (!record) return fallback;
  const fields = record.fields || record;
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null) return fields[key];
  }
  return fallback;
}

function shiftPublicId(shift) {
  return field(shift, FIELDS.shifts.id) || shift.id;
}

function usernameOf(user) {
  return field(user, FIELDS.users.username);
}

function currentUsername() {
  return usernameOf(state.user);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidFirstName(value) {
  return /^[\u0590-\u05FFA-Za-z]{2,32}$/.test(String(value || "").trim());
}

function currentUserEmail() {
  return field(state.user, FIELDS.users.email);
}

async function ensureVolunteerEmail() {
  if (!state.user || isManager() || isValidEmail(currentUserEmail())) return;

  let email = "";
  while (!isValidEmail(email)) {
    email = prompt("נא להזין מייל לשמירת פרטי משמרות ביומן:") || "";
    email = email.trim();
    if (!email) return;
    if (!isValidEmail(email)) alert("כתובת המייל אינה תקינה.");
  }

  showStatus("שומר מייל...");
  await airtable(`${TABLES.users}/${state.user.id}`, {
    method: "PATCH",
    body: { fields: { [FIELDS.users.email]: email } }
  });
  state.user.fields[FIELDS.users.email] = email;
  const user = state.users.find((item) => item.id === state.user.id);
  if (user) user.fields[FIELDS.users.email] = email;
  hideStatus();
}

function isManager() {
  return field(state.user, FIELDS.users.role) === "מנהל";
}

function adminUser() {
  return {
    id: "local-admin",
    fields: {
      [FIELDS.users.username[0]]: "admin",
      [FIELDS.users.name]: "מנהל מערכת",
      [FIELDS.users.role]: "מנהל",
      [FIELDS.users.status]: "פעיל",
      [FIELDS.users.qualified]: "כן"
    }
  };
}

async function airtable(table, options = {}) {
  const url = new URL(API_ROOT, window.location.origin);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      table,
      method: options.method || "GET",
      params: options.params || {},
      body: options.body || null
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  return response.json();
}

async function fetchAll(table) {
  let records = [];
  let offset = "";
  do {
    const data = await airtable(table, { params: offset ? { offset } : undefined });
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}

async function loadData() {
  showStatus("טוען נתונים מ-Airtable...");
  const [users, shifts, assignments] = await Promise.all([
    fetchAll(TABLES.users),
    fetchAll(TABLES.shifts),
    fetchAll(TABLES.assignments)
  ]);

  state.users = users;
  state.shifts = shifts.sort((a, b) => String(field(a, FIELDS.shifts.date)).localeCompare(String(field(b, FIELDS.shifts.date))));
  state.assignments = assignments;

  try {
    state.notifications = await fetchAll(TABLES.notifications);
  } catch (error) {
    state.notifications = localNotifications();
  }

  hideStatus();
}

function showStatus(text, tone = "info") {
  els.statusMessage.textContent = text;
  els.statusMessage.dataset.tone = tone;
  els.statusMessage.classList.remove("hidden");
}

function hideStatus() {
  els.statusMessage.classList.add("hidden");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function localDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function datePlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateIso(date);
}

const DEFAULT_WEEKEND_SHIFT_TEMPLATES = [
  { type: "משמרת בוקר", start: "08:00", end: "14:00" },
  { type: "משמרת מבצעי", start: "10:00", end: "16:00" },
  { type: "משמרת צהריים", start: "14:00", end: "19:00" },
  { type: "משמרת ערב", start: "19:00", end: "07:00" }
];

let WEEKEND_SHIFT_TEMPLATES = loadShiftTemplates();
const VOLUNTEER_MIDWEEK_TEMPLATE_INDEXES = [0, 2, 3];

function loadShiftTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem("marineShiftTemplates") || "[]");
    if (Array.isArray(saved) && saved.length === DEFAULT_WEEKEND_SHIFT_TEMPLATES.length) {
      return DEFAULT_WEEKEND_SHIFT_TEMPLATES.map((template, index) => ({
        type: template.type,
        start: saved[index]?.start || template.start,
        end: saved[index]?.end || template.end
      }));
    }
  } catch (error) {
    localStorage.removeItem("marineShiftTemplates");
  }
  return DEFAULT_WEEKEND_SHIFT_TEMPLATES.map((template) => ({ ...template }));
}

function saveShiftTemplates(templates) {
  localStorage.setItem("marineShiftTemplates", JSON.stringify(templates.map(({ start, end }) => ({ start, end }))));
}

function nextMonthParts() {
  const base = state.calendarDate || new Date();
  return {
    year: base.getMonth() === 11 ? base.getFullYear() + 1 : base.getFullYear(),
    month: (base.getMonth() + 1) % 12
  };
}

function monthCursor(year, month) {
  return { year, month };
}

function nextMonthCursor(cursor) {
  return cursor.month === 11 ? { year: cursor.year + 1, month: 0 } : { year: cursor.year, month: cursor.month + 1 };
}

function monthCursorKey(cursor) {
  return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
}

function monthsFromJuneForward(count = 12) {
  const now = new Date();
  const start = monthCursor(2026, 5);
  const current = monthCursor(now.getFullYear(), now.getMonth());
  let cursor = current.year > start.year || (current.year === start.year && current.month > start.month) ? current : start;
  const months = [];
  for (let i = 0; i < count; i += 1) {
    months.push(cursor);
    cursor = nextMonthCursor(cursor);
  }
  return months;
}

function isFridayOrSaturday(date) {
  const day = date.getDay();
  return day === 5 || day === 6;
}

function shiftDateObject(shift) {
  const date = field(shift, FIELDS.shifts.date);
  return date ? new Date(`${date}T12:00:00`) : null;
}

function isWeekendShift(shift) {
  const date = shiftDateObject(shift);
  return Boolean(date) && isFridayOrSaturday(date);
}

function isCanceledShift(shift) {
  const status = String(field(shift, FIELDS.shifts.status, "")).toLowerCase();
  return status.includes("canceled") || status.includes("cancelled") || status.includes("מבוטל") || status.includes("סגור");
}

function activeWeekendShifts() {
  return state.shifts.filter((shift) => !isCanceledShift(shift));
}

function activeWeekendShiftIds() {
  return new Set(activeWeekendShifts().map(shiftPublicId));
}

function monthlyAutomationKey(year, month) {
  return `marine-all-week-shifts-${year}-${String(month + 1).padStart(2, "0")}`;
}

function hebrewDay(dateIso) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(new Date(`${dateIso}T12:00:00`));
}

function holidayItemsForDate(dateIso) {
  const year = dateIso ? dateIso.slice(0, 4) : "";
  return state.holidaysByYear[year]?.[dateIso] || [];
}

function shouldDisplayHoliday(item) {
  const category = String(item.category || "");
  const title = String(item.hebrew || item.title || "");
  if (!["holiday", "major", "minor", "modern"].includes(category)) return false;
  if (/×”×“×œ×§×ª|×¦××ª|×¤×¨×©×ª|×¡×¤×™×¨×ª/.test(title)) return false;
  return Boolean(title);
}

async function ensureHolidaysForYear(year) {
  const key = String(year);
  if (state.holidaysByYear[key] || state.loadingHolidayYears.has(key)) return;

  state.loadingHolidayYears.add(key);
  try {
    const url = new URL("https://www.hebcal.com/hebcal");
    url.searchParams.set("cfg", "json");
    url.searchParams.set("v", "1");
    url.searchParams.set("year", key);
    url.searchParams.set("maj", "on");
    url.searchParams.set("min", "on");
    url.searchParams.set("mod", "on");
    url.searchParams.set("nx", "on");
    url.searchParams.set("i", "on");
    url.searchParams.set("lg", "h");

    const response = await fetch(url);
    if (!response.ok) throw new Error("Holiday fetch failed");
    const data = await response.json();
    const holidays = {};
    (data.items || []).filter(shouldDisplayHoliday).forEach((item) => {
      const date = item.date;
      if (!date) return;
      if (!holidays[date]) holidays[date] = [];
      holidays[date].push(item.hebrew || item.title);
    });
    state.holidaysByYear[key] = holidays;
  } catch (error) {
    state.holidaysByYear[key] = {};
  } finally {
    state.loadingHolidayYears.delete(key);
  }
}

function ensureCalendarHolidays(year) {
  const key = String(year);
  if (state.holidaysByYear[key] || state.loadingHolidayYears.has(key)) return;
  ensureHolidaysForYear(year).then(() => {
    if (state.calendarDate.getFullYear() === year) renderCalendar();
  });
}

function shortHebrewDay(dateIso) {
  const day = new Date(`${dateIso}T12:00:00`).getDay();
  return ["יום א", "יום ב", "יום ג", "יום ד", "יום ה", "יום ו", "שבת"][day];
}

function compactDate(dateIso) {
  if (!dateIso) return "";
  const [year, month, day] = dateIso.split("-");
  return `${shortHebrewDay(dateIso)}, ${day}/${month}/${year.slice(-2)}`;
}

function formatNumericDate(dateIso) {
  if (!dateIso) return "";
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

function withinNextMonth(shift) {
  const date = field(shift, FIELDS.shifts.date);
  return !isCanceledShift(shift) && date >= todayIso() && date <= datePlusDays(35);
}

function approvedForShift(shift) {
  const id = shiftPublicId(shift);
  return state.assignments.filter((item) => field(item, FIELDS.assignments.shiftId) === id && field(item, FIELDS.assignments.status) === "מאושר");
}

function pendingForShift(shift) {
  const id = shiftPublicId(shift);
  return state.assignments.filter((item) => field(item, FIELDS.assignments.shiftId) === id && field(item, FIELDS.assignments.status) === "ממתין");
}

function assignedUsersForShift(shift) {
  const id = shiftPublicId(shift);
  return state.assignments
    .filter((item) => field(item, FIELDS.assignments.shiftId) === id && field(item, FIELDS.assignments.status) !== "נדחה")
    .map((item) => field(item, FIELDS.assignments.username))
    .filter(Boolean);
}

function capacityLeft(shift) {
  const required = Number(field(shift, FIELDS.shifts.required, 0)) || 0;
  return Math.max(required - approvedForShift(shift).length, 0);
}

function activeVolunteers() {
  return state.users
    .filter((user) => field(user, FIELDS.users.role, "מתנדב") !== "מנהל")
    .filter((user) => !field(user, FIELDS.users.status) || field(user, FIELDS.users.status) === "פעיל")
    .filter((user) => usernameOf(user))
    .sort((a, b) => String(usernameOf(a)).localeCompare(String(usernameOf(b)), "he"));
}

function assignmentForUsername(shift, username) {
  const id = shiftPublicId(shift);
  return state.assignments.find((item) => {
    return field(item, FIELDS.assignments.shiftId) === id &&
      field(item, FIELDS.assignments.username) === username &&
      field(item, FIELDS.assignments.status) !== "נדחה";
  });
}

function requiredCapacity(shift) {
  return Number(field(shift, FIELDS.shifts.required, 0)) || 0;
}

function canRequestShift(shift) {
  const id = shiftPublicId(shift);
  return !state.assignments.some((item) => field(item, FIELDS.assignments.shiftId) === id && field(item, FIELDS.assignments.username) === currentUsername());
}

function userAssignmentForShift(shift) {
  const id = shiftPublicId(shift);
  return state.assignments.find((item) => field(item, FIELDS.assignments.shiftId) === id && field(item, FIELDS.assignments.username) === currentUsername());
}

function visibleNotifications() {
  return state.notifications.filter((notice) => {
    const target = String(field(notice, FIELDS.notifications.target, "כולם"));
    return target === "כולם" || (target === "מנהל" && isManager()) || target === currentUsername();
  });
}

function statusBadge(status) {
  const className = status === "מאושר" ? "ok" : status === "נדחה" ? "danger" : "pending";
  return `<span class="badge ${className}">${status || "פתוח"}</span>`;
}

function notificationReadList(notice) {
  return String(field(notice, FIELDS.notifications.readBy, ""))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isNotificationRead(notice) {
  return notificationReadList(notice).includes(currentUsername());
}

function render() {
  if (!state.user) return;
  renderManagerVisibility();
  updateCreateMonthButtonLabel();
  updateMonthlyTableButton();
  renderDashboard();
  renderOpenShifts();
  renderCalendar();
  renderManager();
  renderShiftHoursForm();
  renderNotifications();
}

function updateCreateMonthButtonLabel() {
  const { year, month } = nextMonthParts();
  const monthName = new Intl.DateTimeFormat("he-IL", { month: "long" }).format(new Date(year, month, 1));
  els.createMonthButton.textContent = `פתח את משמרות חודש ${monthName}`;
}

function renderManagerVisibility() {
  document.querySelectorAll(".manager-only").forEach((el) => {
    el.classList.toggle("show-manager", isManager());
  });
}

function updateMonthlyTableButton() {
  if (!els.monthlyTableButton) return;
  els.monthlyTableButton.textContent = state.calendarLayout === "monthlyTable" ? "תצוגת לוח שנה" : "תצוגה חודשית";
  els.monthlyTableButton.classList.toggle("active-toggle", state.calendarLayout === "monthlyTable");
}

function renderDashboard() {
  const openShifts = state.shifts.filter(withinNextMonth).filter((shift) => capacityLeft(shift) > 0);
  const visibleShiftIds = activeWeekendShiftIds();
  const pending = state.assignments.filter((item) => field(item, FIELDS.assignments.status) === "ממתין" && visibleShiftIds.has(field(item, FIELDS.assignments.shiftId)));
  const approved = state.assignments.filter((item) => field(item, FIELDS.assignments.status) === "מאושר" && visibleShiftIds.has(field(item, FIELDS.assignments.shiftId)));
  const myAssignments = state.assignments.filter((item) => {
    return field(item, FIELDS.assignments.username) === currentUsername() && visibleShiftIds.has(field(item, FIELDS.assignments.shiftId));
  });

  els.openCount.textContent = openShifts.length;
  els.pendingCount.textContent = isManager() ? pending.length : myAssignments.filter((item) => field(item, FIELDS.assignments.status) === "ממתין").length;
  els.approvedCount.textContent = isManager() ? approved.length : myAssignments.filter((item) => field(item, FIELDS.assignments.status) === "מאושר").length;
  els.noticeCount.textContent = visibleNotifications().filter((notice) => !isNotificationRead(notice)).length;

  els.myAssignments.innerHTML = renderAssignmentList(myAssignments, false);
  els.nextOpenShifts.innerHTML = openShifts.slice(0, 5).map(renderShiftMini).join("") || empty("אין משמרות פתוחות לחודש הקרוב");
}

function renderAssignmentList(assignments, withShift = true) {
  if (!assignments.length) return empty("אין עדיין שיבוצים");
  return assignments
    .map((assignment) => {
      const shift = state.shifts.find((item) => shiftPublicId(item) === field(assignment, FIELDS.assignments.shiftId));
      const title = shift ? shiftTitle(shift) : field(assignment, FIELDS.assignments.shiftId);
      return `
        <article class="list-item">
          <div class="item-head">
            <strong>${escapeHtml(withShift ? title : field(assignment, FIELDS.assignments.shiftId))}</strong>
            ${statusBadge(field(assignment, FIELDS.assignments.status))}
          </div>
          ${shift ? `<div class="meta-line">${shiftDetails(shift)}</div>` : ""}
          <div class="meta-line">משתמש: ${escapeHtml(field(assignment, FIELDS.assignments.username))}</div>
        </article>
      `;
    })
    .join("");
}

function renderShiftMini(shift) {
  return `
    <article class="list-item">
      <div class="item-head">
        <strong>${shiftTitle(shift)}</strong>
        <span class="badge ok">${capacityLeft(shift)} פנויים</span>
      </div>
      <div class="meta-line">${shiftDetails(shift)}</div>
    </article>
  `;
}

function renderOpenShifts() {
  const query = els.shiftSearchInput.value.trim().toLowerCase();
  const status = els.shiftStatusFilter.value;
  const shifts = state.shifts
    .filter(withinNextMonth)
    .filter((shift) => {
      const text = [
        field(shift, FIELDS.shifts.date),
        field(shift, FIELDS.shifts.day),
        field(shift, FIELDS.shifts.type),
        field(shift, FIELDS.shifts.location),
        field(shift, FIELDS.shifts.status)
      ].join(" ").toLowerCase();
      if (query && !text.includes(query)) return false;
      if (status === "available" && capacityLeft(shift) <= 0) return false;
      if (status === "open" && String(field(shift, FIELDS.shifts.status)).includes("סגור")) return false;
      return true;
    });

  els.openShiftsList.innerHTML = shifts.map(renderShiftCard).join("") || empty("לא נמצאו משמרות מתאימות");
}

function renderShiftCard(shift) {
  const requested = !canRequestShift(shift);
  const disabled = !isManager() && (requested || capacityLeft(shift) <= 0);
  const users = assignedUsersForShift(shift);
  const action = isManager() ? "manager-open-assignment" : "request-shift";
  const buttonText = isManager() ? "בקשת שיבוץ" : (requested ? "כבר נשלחה בקשה" : "בקשת שיבוץ");
  return `
    <article class="shift-card">
      <h3>${shiftTitle(shift)}</h3>
      <div class="meta-line">${shiftDetails(shift)}</div>
      ${users.length ? `<div class="meta-line">${escapeHtml(users.join(", "))}</div>` : ""}
      <div class="meta-line">${escapeHtml(field(shift, FIELDS.shifts.notes, ""))}</div>
      <footer>
        <span class="badge ${capacityLeft(shift) > 0 ? "ok" : "danger"}">${capacityLeft(shift)} מקומות פנויים</span>
        <button class="small-button" data-action="${action}" data-shift="${shift.id}" ${disabled ? "disabled" : ""}>
          ${buttonText}
        </button>
      </footer>
    </article>
  `;
}

function renderCalendar() {
  updateCreateMonthButtonLabel();
  updateMonthlyTableButton();
  els.calendarGrid.classList.remove("monthly-table-grid");
  const date = state.calendarDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  ensureCalendarHolidays(year);
  els.calendarTitle.textContent = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(date);

  if (state.calendarLayout === "monthlyTable") {
    renderMonthlyShiftTable(year, month);
    return;
  }

  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const last = new Date(year, month + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));
  const visibleShifts = state.shifts.filter((shift) => !isCanceledShift(shift));
  const cells = ["יום א", "יום ב", "יום ג", "יום ד", "יום ה", "יום ו", "שבת"].map((dayName) => {
    return `<div class="weekday-cell">${dayName}</div>`;
  });

  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const iso = localDateIso(day);
    const holidays = holidayItemsForDate(iso);
    const shifts = visibleShifts.filter((shift) => field(shift, FIELDS.shifts.date) === iso);
    const isWeekendDay = isFridayOrSaturday(day);
    const isCurrentMonth = day.getMonth() === month;
    const shouldShowDay = isCurrentMonth;
    const canVolunteerRequestDay = !isManager() && !isWeekendDay;

    if (!shouldShowDay) {
      cells.push(`<div class="calendar-placeholder"></div>`);
      continue;
    }

    cells.push(`
      <div class="day-cell focused-day ${isWeekendDay ? "weekend-day" : "midweek-shift-day"} ${canVolunteerRequestDay ? "volunteer-request-day" : ""} ${shifts.length ? "has-shifts" : "no-shifts"}" data-date="${iso}" data-weekend="${isWeekendDay ? "true" : "false"}" data-current-month="true">
        <div class="day-number">${compactDate(iso)}</div>
        ${holidays.length ? `<div class="holiday-label">${escapeHtml(holidays.join(", "))}</div>` : ""}
        ${shifts.map(renderCalendarShiftChoice).join("")}
      </div>
    `);
  }
  els.calendarGrid.innerHTML = cells.join("") || empty("אין ימים להצגה בחודש הזה");
}

function monthTableDates(year, month) {
  const visibleShifts = state.shifts.filter((shift) => !isCanceledShift(shift));
  const dates = new Set();
  const last = new Date(year, month + 1, 0);

  if (state.printScope === "weekend") {
    for (let day = 1; day <= last.getDate(); day += 1) {
      const current = new Date(year, month, day);
      if ([5, 6].includes(current.getDay())) dates.add(localDateIso(current));
    }
    return Array.from(dates).sort();
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const current = new Date(year, month, day);
    if (isFridayOrSaturday(current)) dates.add(localDateIso(current));
  }

  if (last.getDay() === 5) {
    const nextSaturday = new Date(year, month, last.getDate() + 1);
    dates.add(localDateIso(nextSaturday));
  }

  visibleShifts.forEach((shift) => {
    const iso = field(shift, FIELDS.shifts.date);
    if (!iso) return;
    const dateObject = new Date(`${iso}T12:00:00`);
    if (dateObject.getFullYear() !== year || dateObject.getMonth() !== month) return;
    if (isFridayOrSaturday(dateObject)) return;
    if (assignedUsersForShift(shift).length) dates.add(iso);
  });

  return Array.from(dates).sort();
}

function shiftForMonthTableCell(dateIso, template) {
  return state.shifts.find((shift) => {
    return !isCanceledShift(shift) &&
      field(shift, FIELDS.shifts.date) === dateIso &&
      field(shift, FIELDS.shifts.start) === template.start &&
      field(shift, FIELDS.shifts.end) === template.end &&
      field(shift, FIELDS.shifts.type) === template.type;
  });
}

function renderMonthlyShiftTable(year, month) {
  els.calendarGrid.classList.add("monthly-table-grid");
  const canManage = isManager();
  const dates = monthTableDates(year, month);
  if (!dates.length) {
    els.calendarGrid.innerHTML = empty("אין ימים להצגה בחודש הזה");
    return;
  }

  const headerCells = dates.map((iso) => {
    return `
      <th class="month-date-head">
        <span>${escapeHtml(shortHebrewDay(iso))}</span>
        <strong>${escapeHtml(formatNumericDate(iso))}</strong>
      </th>
    `;
  }).join("");

  const rows = WEEKEND_SHIFT_TEMPLATES.map((template) => {
    const cells = dates.map((iso) => {
      const shift = shiftForMonthTableCell(iso, template);
      const users = shift ? assignedUsersForShift(shift) : [];
      return `
        <td class="${users.length ? "has-shift" : shift ? "assignable-empty-shift" : ""}" data-date="${iso}" ${shift ? `data-shift="${shift.id}"` : ""}>
          ${shift && users.length ? `
            <div class="month-shift-cell ${canManage ? "manager-shift" : ""}" ${canManage ? `draggable="true" data-shift="${shift.id}"` : ""}>
              <strong>${escapeHtml(users.join(", "))}</strong>
            </div>
          ` : ""}
        </td>
      `;
    }).join("");

    return `
      <tr>
        <th class="month-shift-label">
          <strong>${escapeHtml(template.type)}</strong>
          <span>(${escapeHtml(template.start)}-${escapeHtml(template.end)})</span>
        </th>
        ${cells}
      </tr>
    `;
  }).join("");

  els.calendarGrid.innerHTML = `
    <div class="month-table-wrap">
      <table class="month-shift-table">
        <thead>
          <tr>
            <th class="month-label-spacer"></th>
            ${headerCells}
          </tr>
          <tr class="month-separator-row">
            <th></th>
            ${dates.map(() => "<th></th>").join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderCalendarShiftChoice(shift) {
  if (isManager()) return renderManagerDraggableShift(shift);

  const assignment = userAssignmentForShift(shift);
  const status = assignment ? field(assignment, FIELDS.assignments.status) : "";
  const checked = Boolean(assignment);
  const disabled = !checked && capacityLeft(shift) <= 0;
  const label = `${field(shift, FIELDS.shifts.type)} ${field(shift, FIELDS.shifts.start)}-${field(shift, FIELDS.shifts.end)}`;
  return `
    <label class="shift-choice ${checked ? "selected" : ""}">
      <input type="checkbox" data-action="toggle-shift" data-shift="${shift.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
      <span class="check-mark">V</span>
      <span class="shift-choice-text">${escapeHtml(label)}</span>
      ${status ? `<small>${escapeHtml(status)}</small>` : ""}
    </label>
  `;
}

function renderManagerDraggableShift(shift) {
  const label = `${field(shift, FIELDS.shifts.type)} ${field(shift, FIELDS.shifts.start)}-${field(shift, FIELDS.shifts.end)}`;
  const users = assignedUsersForShift(shift);
  if (!users.length) return "";
  const required = requiredCapacity(shift);
  const assigned = approvedForShift(shift).length;
  return `
    <div class="shift-choice manager-shift" draggable="true" data-shift="${shift.id}" title="גרור ליום אחר">
      <span class="drag-handle">↕</span>
      <span class="shift-choice-text">${escapeHtml(label)}</span>
      <small class="assigned-users">${escapeHtml(users.join(", "))}</small>
      <div class="capacity-controls">
        <button type="button" data-action="capacity-change" data-shift="${shift.id}" data-delta="-1" ${required <= assigned ? "disabled" : ""}>-</button>
        <span>${required}</span>
        <button type="button" data-action="capacity-change" data-shift="${shift.id}" data-delta="1">+</button>
      </div>
    </div>
  `;
}

function renderManager() {
  const visibleShiftIds = activeWeekendShiftIds();
  const pending = state.assignments.filter((item) => field(item, FIELDS.assignments.status) === "ממתין" && visibleShiftIds.has(field(item, FIELDS.assignments.shiftId)));
  if (!pending.length) {
    els.pendingAssignments.innerHTML = empty("אין בקשות ממתינות לאישור");
    return;
  }

  els.pendingAssignments.innerHTML = pending
    .map((assignment) => {
      const shift = state.shifts.find((item) => shiftPublicId(item) === field(assignment, FIELDS.assignments.shiftId));
      return `
        <article class="list-item">
          <div class="item-head">
            <strong>${escapeHtml(field(assignment, FIELDS.assignments.username))}</strong>
            ${statusBadge("ממתין")}
          </div>
          <div class="meta-line">${shift ? shiftTitle(shift) : field(assignment, FIELDS.assignments.shiftId)}</div>
          <div class="list-actions">
            <button class="small-button approve" data-action="assignment-status" data-id="${assignment.id}" data-status="מאושר">אישור</button>
            <button class="small-button reject" data-action="assignment-status" data-id="${assignment.id}" data-status="נדחה">דחייה</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderShiftHoursForm() {
  if (!els.shiftHoursForm || !isManager()) return;
  if (els.shiftHoursForm.contains(document.activeElement)) return;
  WEEKEND_SHIFT_TEMPLATES.forEach((template, index) => {
    const startInput = els.shiftHoursForm.elements[`start-${index}`];
    const endInput = els.shiftHoursForm.elements[`end-${index}`];
    if (startInput) startInput.value = template.start;
    if (endInput) endInput.value = template.end;
  });
}

function renderNotifications() {
  const notices = visibleNotifications();
  if (!notices.length) {
    els.notificationsList.innerHTML = empty("אין התראות להצגה");
    return;
  }

  els.notificationsList.innerHTML = notices
    .slice()
    .reverse()
    .map((notice) => {
      const read = isNotificationRead(notice);
      return `
      <article class="list-item notification-item ${read ? "read" : "unread"}" data-action="mark-notice-read" data-id="${notice.id}">
        <div class="item-head">
          <strong>${escapeHtml(field(notice, FIELDS.notifications.title, "התראה"))}</strong>
          <span class="badge ${read ? "ok" : "danger"}">${read ? "נקראה" : "חדשה"}</span>
        </div>
        <p>${escapeHtml(field(notice, FIELDS.notifications.body, ""))}</p>
        <div class="meta-line">${escapeHtml(field(notice, FIELDS.notifications.createdAt, ""))}</div>
        <div class="meta-line">נשלח על ידי: ${escapeHtml(field(notice, FIELDS.notifications.createdBy, ""))}</div>
      </article>
    `;
    })
    .join("");
}

function managerSelectedShift() {
  return state.shifts.find((shift) => shift.id === state.managerAssignmentShiftId) || null;
}

function openManagerAssignmentModal(shiftRecordId) {
  if (!isManager()) return;
  state.managerAssignmentShiftId = shiftRecordId;
  renderManagerAssignmentModal();
  els.assignmentModal.classList.remove("hidden");
}

function closeManagerAssignmentModal() {
  state.managerAssignmentShiftId = "";
  els.assignmentModal.classList.add("hidden");
  els.assignmentNewVolunteerForm.classList.add("hidden");
  els.assignmentNewVolunteerForm.reset();
}

function renderManagerAssignmentModal() {
  const shift = managerSelectedShift();
  if (!shift) return;
  const assignments = approvedForShift(shift);
  const assignedNames = new Set(assignments.map((assignment) => field(assignment, FIELDS.assignments.username)));
  const volunteers = activeVolunteers();
  const availableVolunteers = volunteers.filter((user) => !assignedNames.has(usernameOf(user)));

  els.assignmentModalTitle.textContent = "ניהול שיבוץ משמרת";
  els.assignmentModalSubtitle.textContent = `${shiftTitle(shift)} | ${shiftDetails(shift)}`;

  els.assignmentModalAssigned.innerHTML = assignments.length ? assignments.map((assignment) => `
    <article class="list-item">
      <div class="item-head">
        <strong>${escapeHtml(field(assignment, FIELDS.assignments.username))}</strong>
        <button class="small-button reject" type="button" data-action="manager-remove-assignment" data-id="${assignment.id}">הסרה</button>
      </div>
    </article>
  `).join("") : empty("אין מתנדבים משובצים למשמרת הזו");

  els.assignmentVolunteerSelect.innerHTML = availableVolunteers.length ? availableVolunteers.map((user) => {
    const username = usernameOf(user);
    const name = field(user, FIELDS.users.name, username);
    return `<option value="${escapeHtml(username)}">${escapeHtml(name)} (${escapeHtml(username)})</option>`;
  }).join("") : `<option value="">אין מתנדבים זמינים לשיבוץ</option>`;
  els.assignmentAddExistingButton.disabled = !availableVolunteers.length;
}

async function notifyVolunteer(username, title, body) {
  const notice = {
    [FIELDS.notifications.title[0]]: title,
    [FIELDS.notifications.body[0]]: body,
    [FIELDS.notifications.target[0]]: username,
    [FIELDS.notifications.createdAt[0]]: todayIso(),
    [FIELDS.notifications.createdBy[0]]: currentUsername(),
    [FIELDS.notifications.readBy[0]]: ""
  };

  try {
    await airtable(TABLES.notifications, { method: "POST", body: { fields: notice } });
  } catch (error) {
    const notices = localNotifications();
    notices.push({ id: `local-${Date.now()}`, fields: notice });
    localStorage.setItem("marineNotifications", JSON.stringify(notices));
  }
}

async function managerAssignVolunteer(username) {
  const shift = managerSelectedShift();
  if (!shift || !username) return;
  if (assignmentForUsername(shift, username)) {
    alert("המתנדב כבר משובץ למשמרת הזו.");
    return;
  }

  const shiftId = shiftPublicId(shift);
  showStatus("משבץ מתנדב למשמרת...");
  await airtable(TABLES.assignments, {
    method: "POST",
    body: {
      fields: {
        [FIELDS.assignments.id[0]]: `A-${Date.now()}`,
        [FIELDS.assignments.shiftId]: shiftId,
        [FIELDS.assignments.username]: username,
        [FIELDS.assignments.status]: "מאושר",
        [FIELDS.assignments.requestDate]: todayIso(),
        [FIELDS.assignments.approvedBy]: currentUsername(),
        [FIELDS.assignments.approvalDate]: todayIso()
      }
    }
  });

  await notifyVolunteer(
    username,
    "שובצת למשמרת",
    `מנהל המערכת שיבץ אותך למשמרת: ${shiftTitle(shift)} | ${shiftDetails(shift)}`
  );
  await loadData();
  render();
  renderManagerAssignmentModal();
  showStatus("השיבוץ נשמר ונשלחה התראה למתנדב");
  setTimeout(hideStatus, 2400);
}

async function managerCreateVolunteerAndAssign(event) {
  event.preventDefault();
  const username = els.newVolunteerNameInput.value.trim();
  const phone = els.newVolunteerPhoneInput.value.trim();

  if (!isValidFirstName(username)) {
    alert("יש להזין שם פרטי ללא רווחים, לפחות 2 תווים.");
    return;
  }
  if (!/^0?5\d[- ]?\d{7}$/.test(phone)) {
    alert("יש להזין מספר נייד ישראלי תקין, לדוגמה 0501234567.");
    return;
  }

  const existing = state.users.find((user) => String(usernameOf(user)).toLowerCase() === username.toLowerCase());
  if (!existing) {
    const user = await createFirstLoginUser(username, phone);
    state.users.push(user);
  }

  await managerAssignVolunteer(existing ? usernameOf(existing) : username);
  els.assignmentNewVolunteerForm.classList.add("hidden");
  els.assignmentNewVolunteerForm.reset();
}

async function managerRemoveAssignment(assignmentId) {
  const shift = managerSelectedShift();
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!shift || !assignment) return;
  const username = field(assignment, FIELDS.assignments.username);

  if (!confirm(`להסיר את ${username} מהמשמרת?`)) return;
  showStatus("מסיר שיבוץ...");
  await airtable(`${TABLES.assignments}/${assignmentId}`, { method: "DELETE" });
  await notifyVolunteer(
    username,
    "בוטל שיבוץ למשמרת",
    `מנהל המערכת ביטל את השיבוץ שלך למשמרת: ${shiftTitle(shift)} | ${shiftDetails(shift)}`
  );
  await loadData();
  render();
  renderManagerAssignmentModal();
  showStatus("השיבוץ הוסר ונשלחה התראה למתנדב");
  setTimeout(hideStatus, 2400);
}

function shiftTitle(shift) {
  return compactDate(field(shift, FIELDS.shifts.date));
}

function shiftDetails(shift) {
  return `${field(shift, FIELDS.shifts.start)}-${field(shift, FIELDS.shifts.end)} | ${field(shift, FIELDS.shifts.type)} | ${field(shift, FIELDS.shifts.location)}`;
}

function empty(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const REMEMBER_LOGIN_KEY = "marineRememberLogin";

function loadRememberedLogin() {
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_LOGIN_KEY) || "{}");
    if (!saved.username || !saved.password) return;
    els.usernameInput.value = saved.username;
    els.passwordInput.value = saved.password;
    els.rememberLoginInput.checked = true;
  } catch (error) {
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
  }
}

function updateRememberedLogin(username, password) {
  if (!els.rememberLoginInput.checked) {
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
    return;
  }
  localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ username, password }));
}

async function login(event) {
  event.preventDefault();
  try {
    const username = els.usernameInput.value.trim();
    const password = els.passwordInput.value.trim();

    if (username.toLowerCase() === "admin" && password === "1234") {
      updateRememberedLogin(username, password);
      state.user = adminUser();
      sessionStorage.setItem("marineUser", "admin");
      els.activeUserLabel.textContent = "מנהל מערכת | מנהל";
      els.loginScreen.classList.add("hidden");
      els.mainShell.classList.remove("hidden");
      if (!state.shifts.length) {
        try {
          await loadData();
        } catch (error) {
          showStatus(`כניסת מנהל בוצעה, אך טעינת Airtable נכשלה: ${error.message}`, "error");
        }
      }
      switchView("calendarView");
      render();
      return;
    }

    if (!isValidFirstName(username)) {
      throw new Error("יש להזין שם פרטי ללא רווחים, לפחות 2 תווים.");
    }

    if (!/^0?5\d[- ]?\d{7}$/.test(password)) {
      throw new Error("יש להזין מספר נייד ישראלי תקין, לדוגמה 0501234567.");
    }

    if (!state.users.length) await loadData();
    const normalizedUsername = username.toLowerCase();
    const user = state.users.find((item) => {
      return String(usernameOf(item)).toLowerCase() === normalizedUsername ||
        String(field(item, FIELDS.users.email)).toLowerCase() === normalizedUsername ||
        String(field(item, FIELDS.users.name)).toLowerCase() === normalizedUsername;
    });

    if (!user) {
      state.user = await createFirstLoginUser(username, password);
      updateRememberedLogin(username, password);
      state.users.push(state.user);
      sessionStorage.setItem("marineUser", usernameOf(state.user));
      els.activeUserLabel.textContent = `${field(state.user, FIELDS.users.name, usernameOf(state.user))} | ${field(state.user, FIELDS.users.role, "מתנדב")}`;
      els.loginScreen.classList.add("hidden");
      els.mainShell.classList.remove("hidden");
      switchView("calendarView");
      await ensureVolunteerEmail();
      render();
      return;
    }

    const storedPassword = field(user, FIELDS.users.password, "");
    if (storedPassword && digitsOnly(storedPassword) !== digitsOnly(password)) throw new Error("מספר הנייד לא תואם לרשומת המשתמש.");
    if (!storedPassword && digitsOnly(field(user, FIELDS.users.phone, "")) !== digitsOnly(password)) {
      throw new Error("מספר הנייד לא תואם לרשומת המשתמש.");
    }
    if (field(user, FIELDS.users.status) && field(user, FIELDS.users.status) !== "פעיל") throw new Error("המשתמש אינו פעיל");

    state.user = user;
    updateRememberedLogin(username, password);
    sessionStorage.setItem("marineUser", usernameOf(user));
    els.activeUserLabel.textContent = `${field(user, FIELDS.users.name, usernameOf(user))} | ${field(user, FIELDS.users.role, "מתנדב")}`;
    els.loginScreen.classList.add("hidden");
    els.mainShell.classList.remove("hidden");
    switchView("calendarView");
    await ensureVolunteerEmail();
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function createFirstLoginUser(username, phone) {
  showStatus("יוצר משתמש חדש בטבלת USERS...");
  const response = await airtable(TABLES.users, {
    method: "POST",
    params: { typecast: "true" },
    body: {
      fields: {
        [FIELDS.users.username[0]]: username,
        [FIELDS.users.name]: username,
        [FIELDS.users.phone]: phone,
        [FIELDS.users.role]: "מתנדב",
        [FIELDS.users.status]: "פעיל",
        [FIELDS.users.qualified]: "כן",
        [FIELDS.users.password[1]]: phone
      }
    }
  });
  hideStatus();
  return response;
}

async function requestShift(shiftRecordId) {
  const shift = state.shifts.find((item) => item.id === shiftRecordId);
  if (!shift) return;
  if (capacityLeft(shift) <= 0) {
    alert("המשמרת מלאה.");
    render();
    return;
  }

  const otherVolunteers = assignedUsersForShift(shift).filter((username) => username !== currentUsername());
  if (otherVolunteers.length && !confirm("שים לב שמשמרת זו כבר יש מתנדב אחר שנרשם. האם ברצונך להרשם בכל זאת?")) {
    render();
    return;
  }

  const shiftId = shiftPublicId(shift);
  showStatus("משבץ אותך למשמרת...");
  await airtable(TABLES.assignments, {
    method: "POST",
    body: {
      fields: {
        [FIELDS.assignments.id[0]]: `A-${Date.now()}`,
        [FIELDS.assignments.shiftId]: shiftId,
        [FIELDS.assignments.username]: currentUsername(),
        [FIELDS.assignments.status]: "מאושר",
        [FIELDS.assignments.requestDate]: todayIso(),
        [FIELDS.assignments.approvalDate]: todayIso()
      }
    }
  });
  await loadData();
  render();
  showStatus("השיבוץ נשמר והמשמרת נתפסה עבורך");
  promptEmailCalendarInvite(shift);
  setTimeout(hideStatus, 2400);
}

async function toggleVolunteerShift(shiftRecordId) {
  const shift = state.shifts.find((item) => item.id === shiftRecordId);
  if (!shift) return;

  const assignment = userAssignmentForShift(shift);
  if (!assignment) {
    await requestShift(shiftRecordId);
    return;
  }

  if (!confirm("האם אתה בטוח שאתה מבטל את המשמרת?")) {
    render();
    return;
  }

  showStatus("מבטל את השיבוץ...");
  await airtable(`${TABLES.assignments}/${assignment.id}`, { method: "DELETE" });
  await notifyManagerAboutCancelledShift(shift);
  await loadData();
  render();
  showStatus("השיבוץ בוטל ונשלחה הודעה למנהל המערכת");
  setTimeout(hideStatus, 2600);
}

async function notifyManagerAboutCancelledShift(shift) {
  const date = field(shift, FIELDS.shifts.date);
  const title = "ביטול משמרת על ידי מתנדב";
  const body = [
    `שם המתנדב: ${currentUsername()}`,
    `יום המשמרת: ${field(shift, FIELDS.shifts.day) || hebrewDay(date)} ${date}`,
    `משמרת מבוטלת: ${field(shift, FIELDS.shifts.type)} ${field(shift, FIELDS.shifts.start)}-${field(shift, FIELDS.shifts.end)}`
  ].join("\n");

  const notice = {
    [FIELDS.notifications.title[0]]: title,
    [FIELDS.notifications.body[0]]: body,
    [FIELDS.notifications.target[0]]: "מנהל",
    [FIELDS.notifications.createdAt[0]]: todayIso(),
    [FIELDS.notifications.createdBy[0]]: currentUsername(),
    [FIELDS.notifications.readBy[0]]: ""
  };

  try {
    await airtable(TABLES.notifications, { method: "POST", body: { fields: notice } });
  } catch (error) {
    saveLocalNotification(notice);
  }
}

async function notifyManagerAboutVolunteerSelfShift(shift, createdNewShift) {
  const date = field(shift, FIELDS.shifts.date);
  const title = createdNewShift ? "שיבוץ עצמי למשמרת חדשה" : "שיבוץ עצמי למשמרת קיימת";
  const body = [
    `שם המתנדב: ${currentUsername()}`,
    `יום המשמרת: ${field(shift, FIELDS.shifts.day) || hebrewDay(date)} ${date}`,
    `משמרת שנבחרה: ${field(shift, FIELDS.shifts.type)} ${field(shift, FIELDS.shifts.start)}-${field(shift, FIELDS.shifts.end)}`,
    createdNewShift ? "המשמרת נוצרה על ידי בקשת מתנדב ביום א-ה." : "המתנדב שובץ למשמרת קיימת ביום א-ה."
  ].join("\n");

  const notice = {
    [FIELDS.notifications.title[0]]: title,
    [FIELDS.notifications.body[0]]: body,
    [FIELDS.notifications.target[0]]: "מנהל",
    [FIELDS.notifications.createdAt[0]]: todayIso(),
    [FIELDS.notifications.createdBy[0]]: currentUsername(),
    [FIELDS.notifications.readBy[0]]: ""
  };

  try {
    await airtable(TABLES.notifications, { method: "POST", body: { fields: notice } });
  } catch (error) {
    saveLocalNotification(notice);
  }
}

async function volunteerRequestMidweekShift(date, templateIndex) {
  if (isManager()) return;
  const dateObject = new Date(`${date}T12:00:00`);
  if (isFridayOrSaturday(dateObject)) return;

  const template = WEEKEND_SHIFT_TEMPLATES[Number(templateIndex)];
  if (!template || !VOLUNTEER_MIDWEEK_TEMPLATE_INDEXES.includes(Number(templateIndex))) return;

  showStatus("משבץ אותך למשמרת...");
  let shift = state.shifts.find((item) => {
    return field(item, FIELDS.shifts.date) === date &&
      field(item, FIELDS.shifts.start) === template.start &&
      field(item, FIELDS.shifts.end) === template.end &&
      field(item, FIELDS.shifts.type) === template.type &&
      !isCanceledShift(item);
  });
  let createdNewShift = false;

  if (!shift) {
    shift = await airtable(TABLES.shifts, {
      method: "POST",
      params: { typecast: "true" },
      body: {
        fields: {
          [FIELDS.shifts.id[0]]: `S-${date}-${template.type}`,
          [FIELDS.shifts.date]: date,
          [FIELDS.shifts.day]: hebrewDay(date),
          [FIELDS.shifts.start]: template.start,
          [FIELDS.shifts.end]: template.end,
          [FIELDS.shifts.type]: template.type,
          [FIELDS.shifts.location]: "תחנה / נקודת יציאה",
          [FIELDS.shifts.required]: 2,
          [FIELDS.shifts.approved]: "",
          [FIELDS.shifts.available]: "2",
          [FIELDS.shifts.status]: "פתוח",
          [FIELDS.shifts.notes]: "נוצר בעקבות בקשת מתנדב"
        }
      }
    });
    createdNewShift = true;
  }

  if (userAssignmentForShift(shift)) {
    alert("כבר שובצת למשמרת הזו.");
    await loadData();
    render();
    hideStatus();
    return;
  }

  if (capacityLeft(shift) <= 0) {
    alert("המשמרת מלאה.");
    await loadData();
    render();
    hideStatus();
    return;
  }

  const otherVolunteers = assignedUsersForShift(shift).filter((username) => username !== currentUsername());
  if (otherVolunteers.length && !confirm("שים לב שמשמרת זו כבר יש מתנדב אחר שנרשם. האם ברצונך להרשם בכל זאת?")) {
    await loadData();
    render();
    hideStatus();
    return;
  }

  await airtable(TABLES.assignments, {
    method: "POST",
    body: {
      fields: {
        [FIELDS.assignments.id[0]]: `A-${Date.now()}`,
        [FIELDS.assignments.shiftId]: shiftPublicId(shift),
        [FIELDS.assignments.username]: currentUsername(),
        [FIELDS.assignments.status]: "מאושר",
        [FIELDS.assignments.requestDate]: todayIso(),
        [FIELDS.assignments.approvalDate]: todayIso(),
        [FIELDS.assignments.notes]: createdNewShift ? "שיבוץ עצמי למשמרת שלא היתה פתוחה" : "שיבוץ עצמי דרך לחיצה על יום"
      }
    }
  });
  await notifyManagerAboutVolunteerSelfShift(shift, createdNewShift);
  await loadData();
  render();
  showStatus("השיבוץ נשמר ונשלחה הודעה למנהל המערכת");
  promptEmailCalendarInvite(shift);
  setTimeout(hideStatus, 2600);
}

function promptEmailCalendarInvite(shift) {
  const email = currentUserEmail();
  if (!isValidEmail(email)) return;
  if (!confirm("האם לשלוח את פרטי המשמרת ליומן שלך במייל?")) return;

  const date = field(shift, FIELDS.shifts.date);
  const subject = `משמרת שיטור ימי - ${date}`;
  const body = [
    "שלום,",
    "",
    "אלו פרטי המשמרת שבחרת:",
    `תאריך: ${date}`,
    `יום: ${field(shift, FIELDS.shifts.day) || hebrewDay(date)}`,
    `סוג: ${field(shift, FIELDS.shifts.type)}`,
    `שעות: ${field(shift, FIELDS.shifts.start)}-${field(shift, FIELDS.shifts.end)}`,
    `מיקום: ${field(shift, FIELDS.shifts.location)}`,
    "",
    "אפשר להעתיק את הפרטים ליומן האישי שלך."
  ].join("\n");

  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function updateAssignmentStatus(recordId, status) {
  showStatus("מעדכן בקשת שיבוץ...");
  await airtable(`${TABLES.assignments}/${recordId}`, {
    method: "PATCH",
    body: {
      fields: {
        [FIELDS.assignments.status]: status,
        [FIELDS.assignments.approvedBy]: currentUsername(),
        [FIELDS.assignments.approvalDate]: todayIso()
      }
    }
  });
  await loadData();
  render();
  showStatus(`הבקשה עודכנה: ${status}`);
  setTimeout(hideStatus, 2200);
}

async function moveShiftToDate(shiftRecordId, targetDate) {
  if (!isManager()) return;
  const shift = state.shifts.find((item) => item.id === shiftRecordId);
  if (!shift) return;

  const sameSlotExists = state.shifts.some((item) => {
    return item.id !== shiftRecordId &&
      field(item, FIELDS.shifts.date) === targetDate &&
      field(item, FIELDS.shifts.start) === field(shift, FIELDS.shifts.start) &&
      field(item, FIELDS.shifts.end) === field(shift, FIELDS.shifts.end) &&
      field(item, FIELDS.shifts.type) === field(shift, FIELDS.shifts.type) &&
      !isCanceledShift(item);
  });

  if (sameSlotExists) {
    alert("כבר קיימת משמרת זהה ביום היעד.");
    return;
  }

  showStatus("מעדכן תאריך משמרת...");
  await airtable(`${TABLES.shifts}/${shiftRecordId}`, {
    method: "PATCH",
    params: { typecast: "true" },
    body: {
      fields: {
        [FIELDS.shifts.date]: targetDate,
        [FIELDS.shifts.day]: hebrewDay(targetDate)
      }
    }
  });
  await loadData();
  render();
  showStatus("המשמרת הועברה בהצלחה");
  setTimeout(hideStatus, 2200);
}

async function createTemplateShift(date, templateIndex) {
  if (!isManager()) return;
  const template = WEEKEND_SHIFT_TEMPLATES[Number(templateIndex)];
  if (!template) return;

  const exists = state.shifts.some((shift) => {
    return field(shift, FIELDS.shifts.date) === date &&
      field(shift, FIELDS.shifts.start) === template.start &&
      field(shift, FIELDS.shifts.end) === template.end &&
      field(shift, FIELDS.shifts.type) === template.type &&
      !isCanceledShift(shift);
  });

  if (exists) {
    alert("המשמרת הזו כבר קיימת בתאריך שנבחר.");
    return;
  }

  showStatus("מוסיף משמרת...");
  await airtable(TABLES.shifts, {
    method: "POST",
    params: { typecast: "true" },
    body: {
      fields: {
        [FIELDS.shifts.id[0]]: `S-${date}-${template.type}`,
        [FIELDS.shifts.date]: date,
        [FIELDS.shifts.day]: hebrewDay(date),
        [FIELDS.shifts.start]: template.start,
        [FIELDS.shifts.end]: template.end,
        [FIELDS.shifts.type]: template.type,
        [FIELDS.shifts.location]: "תחנה / נקודת יציאה",
        [FIELDS.shifts.required]: 2,
        [FIELDS.shifts.approved]: "",
        [FIELDS.shifts.available]: "2",
        [FIELDS.shifts.status]: "פתוח",
        [FIELDS.shifts.notes]: ""
      }
    }
  });
  await loadData();
  render();
  showStatus("המשמרת נוספה");
  setTimeout(hideStatus, 2200);
}

async function deleteShift(shiftRecordId) {
  if (!isManager()) return;
  const shift = state.shifts.find((item) => item.id === shiftRecordId);
  if (!shift) return;

  const shiftId = shiftPublicId(shift);
  const related = state.assignments.filter((assignment) => field(assignment, FIELDS.assignments.shiftId) === shiftId);
  if (related.length) {
    const approved = related.filter((assignment) => field(assignment, FIELDS.assignments.status) === "מאושר").length;
    const pending = related.filter((assignment) => field(assignment, FIELDS.assignments.status) === "ממתין").length;
    if (!confirm(`יש ${related.length} שיבוצים למשמרת הזו (${approved} מאושרים, ${pending} ממתינים). למחוק בכל זאת?`)) return;
  } else if (!confirm("למחוק את המשמרת?")) {
    return;
  }

  showStatus("מוחק משמרת...");
  await airtable(`${TABLES.shifts}/${shiftRecordId}`, { method: "DELETE" });
  await loadData();
  render();
  showStatus("המשמרת נמחקה");
  setTimeout(hideStatus, 2200);
}

async function changeShiftCapacity(shiftRecordId, delta) {
  if (!isManager()) return;
  const shift = state.shifts.find((item) => item.id === shiftRecordId);
  if (!shift) return;

  const assigned = approvedForShift(shift).length;
  const current = requiredCapacity(shift);
  const next = current + Number(delta);

  if (next < assigned) {
    alert("אי אפשר להקטין מתחת למספר המתנדבים שכבר שובצו למשמרת.");
    return;
  }

  if (next < 1) {
    alert("כמות התקנים חייבת להיות לפחות 1.");
    return;
  }

  showStatus("מעדכן תקנים...");
  await airtable(`${TABLES.shifts}/${shiftRecordId}`, {
    method: "PATCH",
    params: { typecast: "true" },
    body: {
      fields: {
        [FIELDS.shifts.required]: next,
        [FIELDS.shifts.available]: String(Math.max(next - assigned, 0))
      }
    }
  });
  await loadData();
  render();
  showStatus("כמות התקנים עודכנה");
  setTimeout(hideStatus, 1800);
}

async function createShift(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const date = data.get("date");
  showStatus("יוצר משמרת...");
    await airtable(TABLES.shifts, {
      method: "POST",
      params: { typecast: "true" },
      body: {
      fields: {
        [FIELDS.shifts.id[0]]: `S-${Date.now()}`,
        [FIELDS.shifts.date]: date,
        [FIELDS.shifts.day]: hebrewDay(date),
        [FIELDS.shifts.start]: data.get("start"),
        [FIELDS.shifts.end]: data.get("end"),
        [FIELDS.shifts.type]: data.get("type"),
        [FIELDS.shifts.location]: data.get("location"),
        [FIELDS.shifts.required]: Number(data.get("required")),
        [FIELDS.shifts.approved]: "",
        [FIELDS.shifts.available]: String(data.get("required")),
        [FIELDS.shifts.status]: "פתוח",
        [FIELDS.shifts.notes]: data.get("notes")
      }
    }
  });
  event.target.reset();
  await loadData();
  render();
  showStatus("המשמרת נוצרה");
  setTimeout(hideStatus, 2200);
}

async function updateShiftHours(event) {
  event.preventDefault();
  if (!isManager()) return;

  const data = new FormData(event.target);
  const nextTemplates = WEEKEND_SHIFT_TEMPLATES.map((template, index) => ({
    type: template.type,
    start: data.get(`start-${index}`),
    end: data.get(`end-${index}`)
  }));

  if (nextTemplates.some((template) => !template.start || !template.end)) {
    alert("יש למלא שעת התחלה ושעת סיום לכל משמרת.");
    return;
  }

  const changed = nextTemplates.filter((template, index) => {
    return template.start !== WEEKEND_SHIFT_TEMPLATES[index].start || template.end !== WEEKEND_SHIFT_TEMPLATES[index].end;
  });

  if (!changed.length) {
    showStatus("לא בוצע שינוי בשעות המשמרות");
    setTimeout(hideStatus, 1800);
    return;
  }

  if (!confirm("לעדכן את שעות כל המשמרות הקיימות לפי ההגדרות החדשות?")) return;

  showStatus("מעדכן את שעות כל המשמרות...");
  const previousTemplates = WEEKEND_SHIFT_TEMPLATES.map((template) => ({ ...template }));
  WEEKEND_SHIFT_TEMPLATES = nextTemplates;
  saveShiftTemplates(WEEKEND_SHIFT_TEMPLATES);

  let updated = 0;
  for (const shift of state.shifts) {
    const type = field(shift, FIELDS.shifts.type);
    const template = WEEKEND_SHIFT_TEMPLATES.find((item) => item.type === type);
    if (!template) continue;
    if (field(shift, FIELDS.shifts.start) === template.start && field(shift, FIELDS.shifts.end) === template.end) continue;

    await airtable(`${TABLES.shifts}/${shift.id}`, {
      method: "PATCH",
      params: { typecast: "true" },
      body: {
        fields: {
          [FIELDS.shifts.start]: template.start,
          [FIELDS.shifts.end]: template.end
        }
      }
    });
    updated += 1;
  }

  try {
    await loadData();
  } catch (error) {
    WEEKEND_SHIFT_TEMPLATES = previousTemplates;
    saveShiftTemplates(WEEKEND_SHIFT_TEMPLATES);
    throw error;
  }
  render();
  showStatus(`עודכנו ${updated} משמרות לפי שעות המשמרת החדשות`);
  setTimeout(hideStatus, 2600);
}

async function createNextMonthShifts() {
  const { year, month } = nextMonthParts();
  const monthName = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  if (!confirm(`לפתוח משמרות לכל ימי השבוע עבור ${monthName}?`)) return;
  await ensureNextMonthWeekendShifts({ force: true, silent: false });
  state.calendarDate = new Date(year, month, 1);
  renderCalendar();
}

function printSchedule(scope = "month") {
  const previousLayout = state.calendarLayout;
  switchView("calendarView");
  state.printScope = scope;
  state.calendarLayout = scope === "weekend" ? "monthlyTable" : "calendar";
  document.body.classList.toggle("printing-month", scope === "weekend");
  renderCalendar();
  const restorePrintState = () => {
    document.body.classList.remove("printing-month");
    state.printScope = null;
    state.calendarLayout = previousLayout;
    renderCalendar();
  };
  window.addEventListener("afterprint", restorePrintState, { once: true });
  window.print();
}

function printCurrentMonth() {
  printSchedule("month");
}

function printSelectedSchedule() {
  printSchedule(els.printScopeSelect?.value || "month");
}

async function ensureNextMonthWeekendShifts({ force = false, silent = true } = {}) {
  const { year, month } = nextMonthParts();
  return ensureWeekendShiftsForMonth(year, month, { force, silent });
}

async function ensureWeekendShiftsFromJuneForward({ force = false, silent = true, monthsAhead = 12 } = {}) {
  let created = 0;
  const months = monthsFromJuneForward(monthsAhead);
  if (!silent) showStatus("מוודא משמרות בכל ימי השבוע מיוני 2026 קדימה...");

  for (const cursor of months) {
    created += await ensureWeekendShiftsForMonth(cursor.year, cursor.month, { force, silent: true, reload: false });
  }

  await loadData();
  render();
  if (!silent) {
    showStatus(created ? `נוצרו ${created} משמרות חסרות` : "כל המשמרות לכל ימי השבוע כבר קיימות");
    setTimeout(hideStatus, 2600);
  }
  return created;
}

async function ensureWeekendShiftsForMonth(year, month, { force = false, silent = true, reload = true } = {}) {
  const automationKey = monthlyAutomationKey(year, month);
  if (!force && localStorage.getItem(automationKey) === "done") return 0;

  const last = new Date(year, month + 1, 0).getDate();
  let created = 0;
  if (!silent) showStatus(`פותח משמרות ${monthCursorKey({ year, month })}...`);

  for (let day = 1; day <= last; day += 1) {
    const dateObject = new Date(year, month, day);
    const date = localDateIso(dateObject);
    for (const template of WEEKEND_SHIFT_TEMPLATES) {
      const shiftId = `S-${date}-${template.type}`;
      const exists = state.shifts.some((shift) => {
        return shiftPublicId(shift) === shiftId || (
          field(shift, FIELDS.shifts.date) === date &&
          field(shift, FIELDS.shifts.start) === template.start &&
          field(shift, FIELDS.shifts.end) === template.end &&
          field(shift, FIELDS.shifts.type) === template.type
        );
      });

      if (exists) continue;

      await airtable(TABLES.shifts, {
        method: "POST",
        params: { typecast: "true" },
        body: {
          fields: {
            [FIELDS.shifts.id[0]]: shiftId,
            [FIELDS.shifts.date]: date,
            [FIELDS.shifts.day]: hebrewDay(date),
            [FIELDS.shifts.start]: template.start,
            [FIELDS.shifts.end]: template.end,
            [FIELDS.shifts.type]: template.type,
            [FIELDS.shifts.location]: "תחנה / נקודת יציאה",
            [FIELDS.shifts.required]: 2,
            [FIELDS.shifts.approved]: "",
            [FIELDS.shifts.available]: "2",
            [FIELDS.shifts.status]: "פתוח",
            [FIELDS.shifts.notes]: ""
          }
        }
      });
      created += 1;
    }
  }

  localStorage.setItem(automationKey, "done");
  if (reload) {
    await loadData();
    render();
  }
  if (!silent && reload) {
    showStatus(created ? `נוצרו ${created} משמרות לכל ימי השבוע לחודש הבא` : "כל המשמרות לכל ימי השבוע לחודש הבא כבר קיימות");
    setTimeout(hideStatus, 2600);
  }
  return created;
}

async function resetShiftsAndCreateJuly() {
  if (!isManager()) return;
  if (!confirm("למחוק את כל המשמרות הקיימות וליצור מחדש את משמרות יולי?")) return;

  showStatus("מוחק משמרות קיימות...");
  const allShifts = await fetchAll(TABLES.shifts);
  for (let i = 0; i < allShifts.length; i += 10) {
    const batch = allShifts.slice(i, i + 10);
    await Promise.all(batch.map((shift) => airtable(`${TABLES.shifts}/${shift.id}`, { method: "DELETE" })));
  }

  state.shifts = [];
  localStorage.removeItem(monthlyAutomationKey(2026, 6));
  showStatus("יוצר משמרות יולי...");
  const created = await ensureWeekendShiftsForMonth(2026, 6, { force: true, silent: true, reload: true });
  state.calendarDate = new Date(2026, 6, 1);
  switchView("calendarView");
  showStatus(`נוצרו ${created} משמרות עבור יולי`);
  setTimeout(hideStatus, 2600);
}

function localNotifications() {
  return JSON.parse(localStorage.getItem("marineNotifications") || "[]");
}

function saveLocalNotification(notice) {
  const notices = localNotifications();
  notices.push({ id: `local-${Date.now()}`, fields: notice });
  localStorage.setItem("marineNotifications", JSON.stringify(notices));
  state.notifications = notices;
}

async function sendNotification() {
  const title = els.noticeTitleInput.value.trim();
  const body = els.noticeBodyInput.value.trim();
  if (!title || !body) return;

  const notice = {
    [FIELDS.notifications.title[0]]: title,
    [FIELDS.notifications.body[0]]: body,
    [FIELDS.notifications.target[0]]: "כולם",
    [FIELDS.notifications.createdAt[0]]: todayIso(),
    [FIELDS.notifications.createdBy[0]]: currentUsername(),
    [FIELDS.notifications.readBy[0]]: ""
  };

  try {
    await airtable(TABLES.notifications, { method: "POST", body: { fields: notice } });
    state.notifications = await fetchAll(TABLES.notifications);
  } catch (error) {
    saveLocalNotification(notice);
    showStatus("לא נמצאה טבלת Notifications ב-Airtable, ההתראה נשמרה מקומית בדפדפן");
  }

  els.noticeTitleInput.value = "";
  els.noticeBodyInput.value = "";
  render();
}

async function markNotificationRead(noticeId) {
  const notice = state.notifications.find((item) => item.id === noticeId);
  if (!notice || isNotificationRead(notice)) return;

  const readers = notificationReadList(notice);
  readers.push(currentUsername());
  const readBy = readers.join(", ");

  if (String(notice.id).startsWith("local-")) {
    notice.fields[FIELDS.notifications.readBy[0]] = readBy;
    localStorage.setItem("marineNotifications", JSON.stringify(state.notifications));
    renderNotifications();
    return;
  }

  await airtable(`${TABLES.notifications}/${noticeId}`, {
    method: "PATCH",
    body: { fields: { [FIELDS.notifications.readBy[0]]: readBy } }
  });
  notice.fields[FIELDS.notifications.readBy[0]] = readBy;
  renderNotifications();
  renderDashboard();
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active-view", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  const titles = {
    dashboardView: ["סקירה", "תמונת מצב חודשית"],
    openShiftsView: ["משמרות פתוחות", "בחירת משמרת לחודש הקרוב"],
    calendarView: ["יומן משמרות", "תצוגת חודש נוחה"],
    notificationsView: ["התראות", "הודעות פנימיות למתנדבים"],
    managerView: ["ניהול", "אישור בקשות ופתיחת משמרות"]
  };
  els.viewTitle.textContent = titles[viewId][0];
  els.viewSubtitle.textContent = titles[viewId][1];
}

function hideContextMenu() {
  els.contextMenu.classList.add("hidden");
  els.contextMenu.innerHTML = "";
}

function showContextMenu(event, html) {
  els.contextMenu.innerHTML = html;
  els.contextMenu.style.left = `${event.clientX}px`;
  els.contextMenu.style.top = `${event.clientY}px`;
  els.contextMenu.classList.remove("hidden");
}

function showDayContextMenu(event, date) {
  const options = WEEKEND_SHIFT_TEMPLATES.map((template, index) => {
    return `<button data-menu-action="add-shift" data-date="${date}" data-template="${index}">${escapeHtml(template.type)} ${template.start}-${template.end}</button>`;
  }).join("");
  showContextMenu(event, `<strong>הוספת משמרת</strong>${options}`);
}

function showVolunteerMidweekShiftMenu(event, date) {
  const options = VOLUNTEER_MIDWEEK_TEMPLATE_INDEXES.map((index) => {
    const template = WEEKEND_SHIFT_TEMPLATES[index];
    return `<button data-menu-action="volunteer-midweek-shift" data-date="${date}" data-template="${index}">${escapeHtml(template.type)} ${template.start}-${template.end}</button>`;
  }).join("");
  showContextMenu(event, `<strong>בחירת משמרת</strong>${options}`);
}

function showShiftContextMenu(event, shiftId) {
  showContextMenu(event, `<strong>משמרת</strong><button data-menu-action="delete-shift" data-shift="${shiftId}">מחיקת משמרת</button>`);
}

document.addEventListener("click", async (event) => {
  const menuTarget = event.target.closest("[data-menu-action]");
  if (menuTarget) {
    const action = menuTarget.dataset.menuAction;
    hideContextMenu();
    if (action === "add-shift") await createTemplateShift(menuTarget.dataset.date, menuTarget.dataset.template);
    if (action === "delete-shift") await deleteShift(menuTarget.dataset.shift);
    if (action === "volunteer-midweek-shift") await volunteerRequestMidweekShift(menuTarget.dataset.date, menuTarget.dataset.template);
    return;
  }
  if (!event.target.closest("#contextMenu")) hideContextMenu();

  const managerShiftTarget = event.target.closest(".manager-shift, .month-shift-table td[data-shift]");
  if (isManager() && managerShiftTarget && !event.target.closest(".capacity-controls") && !event.target.closest("[data-action]")) {
    openManagerAssignmentModal(managerShiftTarget.dataset.shift);
    return;
  }

  const volunteerDayTarget = event.target.closest(".day-cell[data-date]");
  if (!isManager() && volunteerDayTarget && !event.target.closest(".shift-choice, [data-action]")) {
    const date = volunteerDayTarget.dataset.date;
    const dateObject = new Date(`${date}T12:00:00`);
    if (!isFridayOrSaturday(dateObject)) {
      showVolunteerMidweekShiftMenu(event, date);
      return;
    }
  }

  const target = event.target.closest("[data-action], .nav-item");
  if (!target) return;

  if (target.classList.contains("nav-item")) {
    switchView(target.dataset.view);
    return;
  }

  if (target.dataset.action === "request-shift") {
    await requestShift(target.dataset.shift);
  }

  if (target.dataset.action === "manager-open-assignment") {
    openManagerAssignmentModal(target.dataset.shift);
  }

  if (target.dataset.action === "toggle-shift") {
    await toggleVolunteerShift(target.dataset.shift);
  }

  if (target.dataset.action === "assignment-status") {
    await updateAssignmentStatus(target.dataset.id, target.dataset.status);
  }

  if (target.dataset.action === "manager-remove-assignment") {
    await managerRemoveAssignment(target.dataset.id);
  }

  if (target.dataset.action === "mark-notice-read") {
    await markNotificationRead(target.dataset.id);
  }

  if (target.dataset.action === "capacity-change") {
    await changeShiftCapacity(target.dataset.shift, target.dataset.delta);
  }

  if (target.dataset.action === "toggle-monthly-table") {
    state.calendarLayout = state.calendarLayout === "monthlyTable" ? "calendar" : "monthlyTable";
    renderCalendar();
  }
});

document.addEventListener("contextmenu", (event) => {
  if (!isManager()) return;
  const shift = event.target.closest(".manager-shift");
  if (shift) {
    event.preventDefault();
    showShiftContextMenu(event, shift.dataset.shift);
    return;
  }

  const dayCell = event.target.closest(".day-cell, .month-shift-table td[data-date]");
  if (dayCell && (dayCell.dataset.currentMonth === "true" || dayCell.dataset.date)) {
    event.preventDefault();
    showDayContextMenu(event, dayCell.dataset.date);
  }
});

document.addEventListener("dragstart", (event) => {
  const shift = event.target.closest(".manager-shift");
  if (!shift || !isManager() || event.target.closest(".capacity-controls")) return;
  state.draggedShiftId = shift.dataset.shift;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", state.draggedShiftId);
});

document.addEventListener("dragover", (event) => {
  const dayCell = event.target.closest(".day-cell, .month-shift-table td[data-date]");
  if (!dayCell || (!dayCell.dataset.date && dayCell.dataset.currentMonth !== "true") || !state.draggedShiftId) return;
  event.preventDefault();
  dayCell.classList.add("drop-target");
});

document.addEventListener("dragleave", (event) => {
  const dayCell = event.target.closest(".day-cell");
  if (dayCell) dayCell.classList.remove("drop-target");
});

document.addEventListener("drop", async (event) => {
  const dayCell = event.target.closest(".day-cell, .month-shift-table td[data-date]");
  if (!dayCell || !state.draggedShiftId) return;
  event.preventDefault();
  document.querySelectorAll(".drop-target").forEach((cell) => cell.classList.remove("drop-target"));
  const shiftId = event.dataTransfer.getData("text/plain") || state.draggedShiftId;
  state.draggedShiftId = "";
  await moveShiftToDate(shiftId, dayCell.dataset.date);
});

document.addEventListener("dragend", () => {
  state.draggedShiftId = "";
  document.querySelectorAll(".drop-target").forEach((cell) => cell.classList.remove("drop-target"));
});

els.loginForm.addEventListener("submit", login);
els.logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("marineUser");
  location.reload();
});
els.refreshButton.addEventListener("click", async () => {
  await loadData();
  render();
});
els.shiftSearchInput.addEventListener("input", renderOpenShifts);
els.shiftStatusFilter.addEventListener("change", renderOpenShifts);
els.monthlyTableButton.addEventListener("click", () => {
  state.calendarLayout = state.calendarLayout === "monthlyTable" ? "calendar" : "monthlyTable";
  renderCalendar();
});
els.prevMonthButton.addEventListener("click", () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
  renderCalendar();
});
els.nextMonthButton.addEventListener("click", () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
  renderCalendar();
});
els.createShiftForm.addEventListener("submit", createShift);
els.shiftHoursForm.addEventListener("submit", updateShiftHours);
els.createMonthButton.addEventListener("click", createNextMonthShifts);
els.printMonthButton.addEventListener("click", printCurrentMonth);
els.printScheduleButton.addEventListener("click", printSelectedSchedule);
els.sendNoticeButton.addEventListener("click", sendNotification);
els.assignmentModalClose.addEventListener("click", closeManagerAssignmentModal);
els.assignmentModal.addEventListener("click", (event) => {
  if (event.target === els.assignmentModal) closeManagerAssignmentModal();
});
els.assignmentAddExistingButton.addEventListener("click", () => {
  managerAssignVolunteer(els.assignmentVolunteerSelect.value);
});
els.assignmentToggleNewVolunteerButton.addEventListener("click", () => {
  els.assignmentNewVolunteerForm.classList.toggle("hidden");
  if (!els.assignmentNewVolunteerForm.classList.contains("hidden")) els.newVolunteerNameInput.focus();
});
els.assignmentNewVolunteerForm.addEventListener("submit", managerCreateVolunteerAndAssign);

(async function init() {
  try {
    loadRememberedLogin();
    await loadData();
    const savedUser = sessionStorage.getItem("marineUser");
    if (savedUser) {
      state.user = savedUser === "admin" ? adminUser() : state.users.find((user) => usernameOf(user) === savedUser) || null;
      if (state.user) {
        els.activeUserLabel.textContent = `${field(state.user, FIELDS.users.name, usernameOf(state.user))} | ${field(state.user, FIELDS.users.role, "מתנדב")}`;
        els.loginScreen.classList.add("hidden");
        els.mainShell.classList.remove("hidden");
        switchView("calendarView");
        render();
      }
    }
  } catch (error) {
    showStatus(`שגיאה בטעינת Airtable: ${error.message}`, "error");
  }
})();
