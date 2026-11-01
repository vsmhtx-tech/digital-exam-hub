"use strict";

/* ==========================================================
   Online Examination System - script.js
   Works standalone with sample data. To use a Java backend
   (Servlet / Spring Boot), set API_BASE and expose:
     GET  {API_BASE}/exams            -> [{id,title,minutes,pass,questions:[{q,o:[],a}]}]
     POST {API_BASE}/results          -> body {student, examId, answers}
   For real exams, send questions WITHOUT the correct answer (a)
   and grade on the server; the POST can return {correct,total}.
   ========================================================== */

const API_BASE = "";            // e.g. "http://localhost:8080/api". Empty = use sample data.

/* ---------- Sample data (fallback) ---------- */
const SAMPLE_EXAMS = [
  { id: "java-basics", title: "Java Basics", minutes: 10, pass: 60, questions: [
    { q: "Which keyword is used to inherit a class in Java?", o: ["implements", "extends", "inherits", "super"], a: 1 },
    { q: "What is the default value of an int instance variable?", o: ["null", "undefined", "0", "1"], a: 2 },
    { q: "Which collection does not allow duplicate elements?", o: ["ArrayList", "LinkedList", "HashSet", "Vector"], a: 2 },
    { q: "Which of these is NOT a primitive type in Java?", o: ["boolean", "char", "String", "double"], a: 2 },
    { q: "Which method is the entry point of a Java program?", o: ["start()", "main()", "run()", "init()"], a: 1 },
    { q: "What does JVM stand for?", o: ["Java Variable Machine", "Java Virtual Machine", "Joint Visual Module", "Java Verified Method"], a: 1 },
    { q: "Which keyword prevents a method from being overridden?", o: ["static", "const", "final", "private"], a: 2 },
    { q: "Which interface must be implemented to create a thread by interface?", o: ["Runnable", "Callable", "Serializable", "Cloneable"], a: 0 }
  ]},
  { id: "web-basics", title: "Web Basics", minutes: 8, pass: 50, questions: [
    { q: "Which HTML tag defines a hyperlink?", o: ["<link>", "<a>", "<href>", "<url>"], a: 1 },
    { q: "Which CSS property changes text colour?", o: ["font-color", "text-color", "color", "foreground"], a: 2 },
    { q: "Which HTTP method is typically used to submit a form that creates data?", o: ["GET", "POST", "HEAD", "TRACE"], a: 1 },
    { q: "Which statement declares a block-scoped variable in JavaScript?", o: ["var", "let", "def", "dim"], a: 1 }
  ]}
];

/* ---------- State ---------- */
let exams = [];
let exam = null, student = null;
let idx = 0, answers = [], marked = [];
let endAt = 0, tick = null, submitted = false;

const $ = id => document.getElementById(id);

/* ---------- Data loading ---------- */
async function loadExams() {
  if (!API_BASE) return SAMPLE_EXAMS;
  try {
    const res = await fetch(`${API_BASE}/exams`);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.warn("Could not reach the server; using sample exams.", err);
    return SAMPLE_EXAMS;
  }
}

async function init() {
  exams = await loadExams();
  const sel = $("examSel");
  sel.innerHTML = "";
  exams.forEach(e =>
    sel.add(new Option(`${e.title} (${e.minutes} min, ${e.questions.length} questions)`, e.id))
  );
}

/* ---------- Login ---------- */
$("loginForm").addEventListener("submit", ev => {
  ev.preventDefault();
  const name = $("name").value.trim();
  const roll = $("roll").value.trim();
  if (!name || !roll) {
    $("loginErr").textContent = "Enter your full name and roll number to continue.";
    return;
  }
  exam = exams.find(e => e.id === $("examSel").value);
  if (!exam) {
    $("loginErr").textContent = "Choose an exam to continue.";
    return;
  }
  student = { name, roll };
  answers = Array(exam.questions.length).fill(null);
  marked = Array(exam.questions.length).fill(false);
  idx = 0;
  submitted = false;
  endAt = Date.now() + exam.minutes * 60000;

  $("who").textContent = `${name} · ${roll}`;
  $("examTitle").textContent = exam.title;
  $("loginErr").textContent = "";
  $("loginView").classList.add("hidden");
  $("examView").classList.remove("hidden");
  $("timer").classList.remove("hidden");

  buildPalette();
  render();
  updateTimer();
  tick = setInterval(updateTimer, 500);
});

/* ---------- Rendering ---------- */
function buildPalette() {
  const grid = $("palette");
  grid.innerHTML = "";
  exam.questions.forEach((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "qn";
    b.textContent = i + 1;
    b.setAttribute("aria-label", `Go to question ${i + 1}`);
    b.addEventListener("click", () => { idx = i; render(); });
    grid.appendChild(b);
  });
}

function render() {
  const q = exam.questions[idx];
  $("qCount").textContent = `Question ${idx + 1} of ${exam.questions.length}`;
  $("qText").textContent = q.q;

  const box = $("options");
  box.innerHTML = "";
  q.o.forEach((text, i) => {
    const label = document.createElement("label");
    label.className = "opt" + (answers[idx] === i ? " sel" : "");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "opt";
    radio.checked = answers[idx] === i;
    radio.addEventListener("change", () => { answers[idx] = i; render(); });
    label.append(radio, document.createTextNode(text));
    box.appendChild(label);
  });

  $("prevBtn").disabled = idx === 0;
  $("nextBtn").textContent = idx === exam.questions.length - 1 ? "Save" : "Save and next";
  $("markBtn").textContent = marked[idx] ? "Remove review mark" : "Mark for review";

  [...$("palette").children].forEach((b, i) => {
    b.classList.toggle("answered", answers[i] !== null && !marked[i]);
    b.classList.toggle("marked", marked[i]);
    b.classList.toggle("current", i === idx);
  });
}

$("prevBtn").addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
$("nextBtn").addEventListener("click", () => {
  if (idx < exam.questions.length - 1) idx++;
  render();
});
$("clearBtn").addEventListener("click", () => { answers[idx] = null; render(); });
$("markBtn").addEventListener("click", () => { marked[idx] = !marked[idx]; render(); });

/* Keyboard shortcuts: arrows move between questions */
document.addEventListener("keydown", e => {
  if (!exam || submitted || $("examView").classList.contains("hidden")) return;
  if (e.target.tagName === "INPUT" || $("confirmDlg").open) return;
  if (e.key === "ArrowRight" && idx < exam.questions.length - 1) { idx++; render(); }
  if (e.key === "ArrowLeft" && idx > 0) { idx--; render(); }
});

/* ---------- Timer ---------- */
function updateTimer() {
  const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  $("timer").textContent = `${m}:${s}`;
  $("timer").classList.toggle("low", left <= 60);
  if (left === 0) finish();
}

/* ---------- Submit ---------- */
$("submitBtn").addEventListener("click", () => {
  const unanswered = answers.filter(a => a === null).length;
  $("confirmMsg").textContent = unanswered
    ? `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. You cannot change answers after submitting.`
    : "You cannot change answers after submitting.";
  $("confirmDlg").showModal();
});

$("confirmDlg").addEventListener("close", () => {
  if ($("confirmDlg").returnValue === "ok") finish();
});

async function sendResult() {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student, examId: exam.id, answers })
    });
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.warn("Could not save result to the server.", err);
    return null;
  }
}

async function finish() {
  if (!exam || submitted) return;
  submitted = true;
  clearInterval(tick);
  if ($("confirmDlg").open) $("confirmDlg").close("auto");

  sendResult();           // fire and forget; the on-screen result uses local grading
  showResult();
}

function showResult() {
  const total = exam.questions.length;
  let correct = 0, skipped = 0;
  exam.questions.forEach((q, i) => {
    if (answers[i] === null) skipped++;
    else if (answers[i] === q.a) correct++;
  });
  const wrong = total - correct - skipped;
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= exam.pass;

  $("examView").classList.add("hidden");
  $("timer").classList.add("hidden");
  $("resultView").classList.remove("hidden");

  $("score").textContent = `${correct} / ${total}`;
  $("verdict").innerHTML =
    `<b style="color:var(${passed ? "--ok" : "--bad"})">${passed ? "Passed" : "Not passed"}</b> · ${pct}% (pass mark ${exam.pass}%)`;
  $("sCorrect").textContent = correct;
  $("sWrong").textContent = wrong;
  $("sSkipped").textContent = skipped;

  const review = $("review");
  review.innerHTML = "<h3>Review</h3>";
  exam.questions.forEach((q, i) => {
    const isCorrect = answers[i] === q.a;
    const mine = answers[i] === null ? "Not answered" : q.o[answers[i]];

    const row = document.createElement("div");
    row.className = "rev";

    const title = document.createElement("div");
    title.textContent = `${i + 1}. ${q.q}`;

    const detail = document.createElement("div");
    const tag = document.createElement("span");
    tag.className = isCorrect ? "ok" : "bad";
    tag.textContent = isCorrect ? "Correct" : "Incorrect";
    detail.append(
      tag,
      document.createTextNode(` · Your answer: ${mine}${isCorrect ? "" : ` · Correct: ${q.o[q.a]}`}`)
    );

    row.append(title, detail);
    review.appendChild(row);
  });
}

/* ---------- Guard against accidental refresh/close ---------- */
window.addEventListener("beforeunload", e => {
  if (exam && !submitted) {
    e.preventDefault();
    e.returnValue = "";
  }
});

init();
