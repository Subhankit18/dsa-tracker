let currentUser = null;
let allProblems = [];
let progressRows = [];
let revisionRows = [];

const today = new Date();
const todayISO = toISODate(today);

const popularPatternMap = {
  "Two Sum": "Hashing",
  "3Sum": "Two Pointers",
  "Best Time to Buy and Sell Stock": "Sliding Window",
  "Longest Substring Without Repeating Characters": "Sliding Window",
  "Binary Search": "Binary Search",
  "Search in Rotated Sorted Array": "Binary Search",
  "Merge Intervals": "Merge Intervals",
  "Valid Parentheses": "Stack",
  "Daily Temperatures": "Monotonic Stack",
  "Number of Islands": "DFS",
  "Clone Graph": "BFS",
  "Course Schedule": "Topological Sort",
  "Subsets": "Backtracking",
  "Combination Sum": "Backtracking"
};

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function getPlatformFromURL(url) {
  const value = url.toLowerCase();
  if (value.includes("leetcode.com")) return "LeetCode";
  if (value.includes("geeksforgeeks.org")) return "GeeksforGeeks";
  if (value.includes("codeforces.com")) return "Codeforces";
  return "Other";
}

function daysFromToday(days) {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = session.user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", currentUser.id)
    .maybeSingle();

  const username = profile?.username || currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "User";
  document.getElementById("usernameDisplay").textContent = username;
  document.getElementById("heroUsername").textContent = username;

  setupEvents();
  await loadData();
}

async function loadData() {
  const [problemResult, progressResult, revisionResult] = await Promise.all([
    supabaseClient.from("problems").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
    supabaseClient.from("problem_progress").select("*").eq("user_id", currentUser.id).order("completed_date", { ascending: false }),
    supabaseClient.from("problem_revisions").select("*").eq("user_id", currentUser.id).order("scheduled_date", { ascending: true })
  ]);

  if (problemResult.error) return showToast(problemResult.error.message);
  if (progressResult.error) return showToast(progressResult.error.message);
  if (revisionResult.error) return showToast("Run the v4 SQL migration first: " + revisionResult.error.message);

  allProblems = problemResult.data || [];
  progressRows = progressResult.data || [];
  revisionRows = revisionResult.data || [];

  populatePatternFilter();
  renderStats();
  renderCalendar();
  renderProblems();
  renderRevisionQueue();
  renderUpcomingRevisions();
  renderRevisionHistory();
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) return String(isoDate);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getRevisionDueProblems() {
  return revisionRows
    .filter(r => r.status === "pending" && r.scheduled_date <= todayISO)
    .map(r => ({ revision: r, problem: allProblems.find(p => p.id === r.problem_id) }))
    .filter(x => x.problem)
    .sort((a, b) => {
      if (a.revision.scheduled_date !== b.revision.scheduled_date) {
        return a.revision.scheduled_date.localeCompare(b.revision.scheduled_date);
      }
      return (a.revision.revision_number || 0) - (b.revision.revision_number || 0);
    });
}

function getUpcomingRevisions() {
  return revisionRows
    .filter(r => r.status === "pending" && r.scheduled_date > todayISO)
    .map(r => ({ revision: r, problem: allProblems.find(p => p.id === r.problem_id) }))
    .filter(x => x.problem)
    .sort((a, b) => {
      if (a.revision.scheduled_date !== b.revision.scheduled_date) {
        return a.revision.scheduled_date.localeCompare(b.revision.scheduled_date);
      }
      return (a.revision.revision_number || 0) - (b.revision.revision_number || 0);
    });
}

function getRevisionHistory() {
  return revisionRows
    .filter(r => r.status === "completed")
    .map(r => ({ revision: r, problem: allProblems.find(p => p.id === r.problem_id) }))
    .filter(x => x.problem)
    .sort((a, b) => {
      const ad = a.revision.completed_at || "";
      const bd = b.revision.completed_at || "";
      return bd.localeCompare(ad);
    });
}

function renderStats() {
  const todayRows = progressRows.filter(r => r.completed_date === todayISO);
  const weekStart = new Date(today);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  const weekStartISO = toISODate(weekStart);
  const weekRows = progressRows.filter(r => r.completed_date >= weekStartISO && r.completed_date <= todayISO);
  const uniqueProblemIds = new Set(progressRows.map(r => r.problem_id));
  const due = getRevisionDueProblems().length;
  const upcoming = getUpcomingRevisions().length;

  document.getElementById("todayCount").textContent = todayRows.length;
  document.getElementById("weekCount").textContent = weekRows.length;
  document.getElementById("totalCount").textContent = uniqueProblemIds.size;
  document.getElementById("revisionCount").textContent = due;
  document.getElementById("revisionBadge").textContent = due;
  const upcomingCount = document.getElementById("upcomingCount");
  if (upcomingCount) upcomingCount.textContent = upcoming;
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let mondayIndex = first.getDay() - 1;
  if (mondayIndex < 0) mondayIndex = 6;

  for (let i = 0; i < mondayIndex; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-day blank";
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = toISODate(date);
    const count = progressRows.filter(r => r.completed_date === iso).length;
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (iso === todayISO) cell.classList.add("today");
    if (count >= 1) cell.classList.add("level-1");
    if (count >= 3) cell.classList.add("level-2");
    if (count >= 5) cell.classList.add("level-3");
    if (count >= 8) cell.classList.add("level-4");
    cell.innerHTML = `<span>${day}</span><small>${count ? count : ""}</small>`;
    cell.title = `${iso}: ${count} completed`;
    grid.appendChild(cell);
  }
}

function populatePatternFilter() {
  const filter = document.getElementById("patternFilter");
  if (!filter) return;

  const current = filter.value;
  const patterns = [...new Set(allProblems.map(p => p.pattern).filter(Boolean))].sort();
  filter.innerHTML = `<option value="">All Patterns</option>` +
    patterns.map(p => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join("");
  filter.value = patterns.includes(current) ? current : "";
}

function renderProblems() {
  const list = document.getElementById("problemList");
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const patternFilter = document.getElementById("patternFilter").value;

  const filtered = allProblems.filter(p => {
    const matchesSearch = [p.title, p.topic, p.pattern, p.platform, p.difficulty]
      .some(v => String(v || "").toLowerCase().includes(query));
    const matchesPattern = !patternFilter || p.pattern === patternFilter;
    return matchesSearch && matchesPattern;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty">No problems found.</div>`;
    return;
  }

  list.innerHTML = filtered.map(problem => {
    const doneToday = progressRows.some(r => r.problem_id === problem.id && r.completed_date === todayISO);
    const difficultyClass = String(problem.difficulty || "Easy").toLowerCase();
    const pendingRevisions = revisionRows
      .filter(r => r.problem_id === problem.id && r.status === "pending")
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    const nextRevision = pendingRevisions[0];

    return `
      <article class="problem-row">
        <div class="problem-main">
          <div class="problem-title-line">
            <a href="${escapeHTML(problem.url)}" target="_blank" rel="noopener">${escapeHTML(problem.title)}</a>
            <span class="difficulty ${difficultyClass}">${escapeHTML(problem.difficulty || "Easy")}</span>
          </div>
          <div class="tags">
            <span>${escapeHTML(problem.platform || "Other")}</span>
            ${problem.topic ? `<span>Topic: ${escapeHTML(problem.topic)}</span>` : ""}
            ${problem.pattern ? `<span>Pattern: ${escapeHTML(problem.pattern)}</span>` : ""}
          </div>
          ${nextRevision ? `
            <div class="next-revision">
              🔄 Revision #${escapeHTML(nextRevision.revision_number)}
              · ${nextRevision.scheduled_date <= todayISO ? "Due today" : `Due ${escapeHTML(formatDate(nextRevision.scheduled_date))}`}
            </div>` : `
            <div class="next-revision muted">Revision cycle complete</div>`}
        </div>
        <div class="problem-actions">
          <button class="${doneToday ? "done-btn" : "primary-btn small"}" data-action="complete" data-id="${problem.id}" ${doneToday ? "disabled" : ""}>
            ${doneToday ? "✓ Done Today" : "Mark Done Today"}
          </button>
          <button class="revision-btn small" data-action="add-revision" data-id="${problem.id}">
            ${nextRevision ? "🔄 In Revision" : "🔄 Add to Revision"}
          </button>
        </div>
      </article>`;
  }).join("");
}

function renderRevisionQueue() {
  const list = document.getElementById("revisionList");
  const due = getRevisionDueProblems();

  if (!due.length) {
    list.innerHTML = `<div class="empty">🎉 No revisions are due right now.</div>`;
    return;
  }

  list.innerHTML = due.slice(0, 12).map(item => `
    <div class="revision-item revision-due">
      <div>
        <a href="${escapeHTML(item.problem.url)}" target="_blank" rel="noopener">${escapeHTML(item.problem.title)}</a>
        <small>
          Revision #${escapeHTML(item.revision.revision_number)}
          · Due ${escapeHTML(formatDate(item.revision.scheduled_date))}
        </small>
      </div>
      <button class="primary-btn small" data-action="revise" data-id="${item.revision.id}">✓ Mark Revised</button>
    </div>`).join("");
}

function renderUpcomingRevisions() {
  const list = document.getElementById("upcomingRevisionList");
  if (!list) return;

  const upcoming = getUpcomingRevisions();

  if (!upcoming.length) {
    list.innerHTML = `<div class="empty">📅 No upcoming revisions.</div>`;
    return;
  }

  list.innerHTML = upcoming.slice(0, 20).map(item => `
    <div class="revision-item">
      <div>
        <a href="${escapeHTML(item.problem.url)}" target="_blank" rel="noopener">${escapeHTML(item.problem.title)}</a>
        <small>
          Revision #${escapeHTML(item.revision.revision_number)}
          · Due ${escapeHTML(formatDate(item.revision.scheduled_date))}
        </small>
      </div>
      <span class="schedule-badge">${escapeHTML(item.revision.scheduled_date)}</span>
    </div>`).join("");
}

function renderRevisionHistory() {
  const list = document.getElementById("revisionHistoryList");
  if (!list) return;

  const history = getRevisionHistory();

  if (!history.length) {
    list.innerHTML = `<div class="empty">No completed revisions yet.</div>`;
    return;
  }

  list.innerHTML = history.slice(0, 20).map(item => `
    <div class="revision-item history-item">
      <div>
        <a href="${escapeHTML(item.problem.url)}" target="_blank" rel="noopener">${escapeHTML(item.problem.title)}</a>
        <small>
          Revision #${escapeHTML(item.revision.revision_number)}
          · Completed ${escapeHTML(formatDate(String(item.revision.completed_at).slice(0, 10)))}
        </small>
      </div>
      <span class="completed-badge">✓ Completed</span>
    </div>`).join("");
}

async function fetchProblemMetadata() {
  const url = document.getElementById("url").value.trim();
  const message = document.getElementById("fetchMessage");
  const button = document.getElementById("fetchProblemBtn");

  if (!url) {
    message.textContent = "Paste a problem link first.";
    return;
  }

  document.getElementById("platform").value = getPlatformFromURL(url);
  button.disabled = true;
  button.textContent = "Fetching...";
  message.textContent = "Fetching problem details...";

  const { data, error } = await supabaseClient.functions.invoke("fetch-problem", {
    body: { url }
  });

  button.disabled = false;
  button.textContent = "Auto Fetch";

  if (error || !data) {
    message.textContent = "Auto-fetch failed. You can still enter the title manually.";
    return;
  }

  if (data.title) document.getElementById("title").value = data.title;
  if (data.difficulty && ["Easy", "Medium", "Hard"].includes(data.difficulty)) {
    document.getElementById("difficulty").value = data.difficulty;
  }
  if (Array.isArray(data.topics) && data.topics.length) {
    const topic = data.topics[0];
    const select = document.getElementById("topic");
    const option = [...select.options].find(o => o.value.toLowerCase() === topic.toLowerCase());
    if (option) select.value = option.value;
  }
  if (data.pattern) {
    const select = document.getElementById("pattern");
    const option = [...select.options].find(o => o.value.toLowerCase() === data.pattern.toLowerCase());
    if (option) select.value = option.value;
  }

  message.textContent = "Problem details fetched. Check them before saving.";
}

function getTopicValue() {
  const value = document.getElementById("topic").value;
  return value === "Other" ? document.getElementById("customTopic").value.trim() : value;
}

function getPatternValue() {
  const value = document.getElementById("pattern").value;
  return value === "Other" ? document.getElementById("customPattern").value.trim() : value;
}

async function addProblem(e) {
  e.preventDefault();
  const message = document.getElementById("problemMessage");
  message.textContent = "Saving...";

  const payload = {
    user_id: currentUser.id,
    title: document.getElementById("title").value.trim(),
    url: document.getElementById("url").value.trim(),
    platform: document.getElementById("platform").value,
    difficulty: document.getElementById("difficulty").value,
    topic: getTopicValue(),
    pattern: getPatternValue()
  };

  const { data: problem, error } = await supabaseClient.from("problems").insert(payload).select().single();
  if (error) return message.textContent = error.message;

  const { error: progressError } = await supabaseClient.from("problem_progress").insert({
    problem_id: problem.id,
    user_id: currentUser.id,
    completed_date: todayISO,
    status: "done",
    revision_count: 0,
    last_revised: todayISO,
    revision_enabled: true,
    next_revision_date: daysFromToday(3)
  });
  if (progressError) return message.textContent = progressError.message;

  const { error: revisionError } = await supabaseClient.from("problem_revisions").insert({
    problem_id: problem.id,
    user_id: currentUser.id,
    revision_number: 1,
    scheduled_date: daysFromToday(3),
    status: "pending"
  });
  if (revisionError) return message.textContent = `Problem saved, but revision scheduling failed: ${revisionError.message}`;

  document.getElementById("problemForm").reset();
  document.getElementById("customTopic").classList.add("hidden");
  document.getElementById("customPattern").classList.add("hidden");
  message.textContent = "Solved today ✓ and automatically added to revision.";
  showToast("Problem saved + revision scheduled for 3 days from now 🔄");
  await loadData();
}

async function markDone(problemId) {
  if (progressRows.some(r => r.problem_id === problemId && r.completed_date === todayISO)) return;

  const { error } = await supabaseClient.from("problem_progress").insert({
    problem_id: problemId,
    user_id: currentUser.id,
    completed_date: todayISO,
    status: "done",
    revision_count: 0,
    last_revised: todayISO,
    revision_enabled: true,
    next_revision_date: daysFromToday(3)
  });
  if (error) return showToast(error.message);

  const revisionResult = await addRevisionSchedule(problemId, 1, 3);
  if (!revisionResult.ok) {
    showToast(`Marked done, but revision scheduling failed: ${revisionResult.error?.message || "database error"}`);
    await loadData();
    return;
  }

  showToast(`Marked done ✓ Revision scheduled for ${formatDate(revisionResult.data.scheduled_date)}`);
  await loadData();
}

async function addRevisionSchedule(problemId, revisionNumber, days) {
  const scheduled = daysFromToday(days);

  const { data, error } = await supabaseClient.from("problem_revisions").insert({
    problem_id: problemId,
    user_id: currentUser.id,
    revision_number: revisionNumber,
    scheduled_date: scheduled,
    status: "pending"
  }).select().single();

  if (error) {
    console.error("Revision schedule error:", error);
    return { ok: false, error };
  }

  return { ok: true, data };
}

async function addToRevision(problemId) {
  const pending = revisionRows.filter(r => r.problem_id === problemId && r.status === "pending");
  if (pending.length) {
    const next = pending.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
    showToast(`Already in revision · Due ${formatDate(next.scheduled_date)}`);
    return;
  }

  const completed = progressRows.filter(r => r.problem_id === problemId);
  if (!completed.length) {
    await markDone(problemId);
    return;
  }

  const maxRevision = revisionRows
    .filter(r => r.problem_id === problemId)
    .reduce((max, r) => Math.max(max, r.revision_number || 0), 0);

  const nextNumber = maxRevision + 1;
  const intervals = [3, 7, 14, 30, 60];
  const days = intervals[Math.min(nextNumber - 1, intervals.length - 1)];

  const result = await addRevisionSchedule(problemId, nextNumber, days);
  if (!result.ok) {
    showToast(result.error?.message || "Could not add this problem to revision.");
    return;
  }

  showToast(`Added to revision ✓ Due ${formatDate(result.data.scheduled_date)}`);
  await loadData();
}

async function markRevised(revisionId) {
  const revision = revisionRows.find(r => r.id === revisionId);
  if (!revision || revision.status !== "pending") return;

  const nextNumber = (revision.revision_number || 1) + 1;
  const intervals = [3, 7, 14, 30, 60];
  const days = intervals[Math.min(nextNumber - 1, intervals.length - 1)];

  // Schedule the next revision first so a successful "Revised" action
  // does not leave the problem without a future review if insertion fails.
  const nextResult = await addRevisionSchedule(revision.problem_id, nextNumber, days);
  if (!nextResult.ok) {
    showToast(`Could not schedule next revision: ${nextResult.error?.message || "database error"}`);
    return;
  }

  const { error: completeError } = await supabaseClient.from("problem_revisions").update({
    status: "completed",
    completed_at: new Date().toISOString()
  }).eq("id", revisionId).eq("user_id", currentUser.id).eq("status", "pending");

  if (completeError) {
    await supabaseClient.from("problem_revisions")
      .delete()
      .eq("id", nextResult.data.id)
      .eq("user_id", currentUser.id);

    return showToast(completeError.message);
  }

  const latestProgress = progressRows
    .filter(r => r.problem_id === revision.problem_id)
    .sort((a, b) => b.completed_date.localeCompare(a.completed_date))[0];

  if (latestProgress) {
    const { error: progressError } = await supabaseClient.from("problem_progress").update({
      revision_count: nextNumber,
      last_revised: todayISO,
      revision_enabled: true,
      next_revision_date: nextResult.data.scheduled_date
    }).eq("id", latestProgress.id).eq("user_id", currentUser.id);

    if (progressError) {
      console.warn("Could not update progress revision metadata:", progressError);
    }
  }

  showToast(`Revision #${revision.revision_number} completed ✓ Next review ${formatDate(nextResult.data.scheduled_date)}`);
  await loadData();
}

function setupCustomSelect(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;
  select.addEventListener("change", () => {
    const custom = select.value === "Other";
    input.classList.toggle("hidden", !custom);
    if (custom) input.focus();
  });
}

function setupEvents() {
  document.getElementById("problemForm").addEventListener("submit", addProblem);
  document.getElementById("searchInput").addEventListener("input", renderProblems);
  const patternFilter = document.getElementById("patternFilter");
  if (patternFilter) patternFilter.addEventListener("change", renderProblems);
  document.getElementById("fetchProblemBtn").addEventListener("click", fetchProblemMetadata);
  document.getElementById("url").addEventListener("blur", () => {
    if (document.getElementById("url").value.trim() && !document.getElementById("title").value.trim()) fetchProblemMetadata();
  });

  setupCustomSelect("topic", "customTopic");
  setupCustomSelect("pattern", "customPattern");

  document.getElementById("problemList").addEventListener("click", e => {
    const completeButton = e.target.closest("[data-action='complete']");
    if (completeButton) return markDone(Number(completeButton.dataset.id));
    const revisionButton = e.target.closest("[data-action='add-revision']");
    if (revisionButton) addToRevision(Number(revisionButton.dataset.id));
  });

  document.getElementById("revisionList").addEventListener("click", e => {
    const button = e.target.closest("[data-action='revise']");
    if (button) markRevised(Number(button.dataset.id));
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });

  document.getElementById("focusAddBtn").addEventListener("click", () => {
    document.getElementById("url").focus();
    document.getElementById("problemForm").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

init();
