import { summarizeMock, shouldStopMock, PASS_RULES } from "./scoring.js";

const storeKey = "dkt-progress-v1";
const state = {
  view: "learning",
  questions: [],
  handbook: [],
  metadata: {},
  buildVersion: "celebration-build-10",
  progress: loadProgress(),
  learning: {
    index: 0,
    search: "",
    category: "all",
    imagesOnly: false,
    selected: "",
    confirmed: false,
    shuffled: [],
  },
  mock: null,
};

const labels = {
  general: "General Knowledge",
  road_safety: "Road Safety",
  traffic_signs: "Traffic Signs",
  other: "Other",
};

async function init() {
  const [questions, handbook, metadata] = await Promise.all([
    fetch("./public/data/questions.json?v=10").then((res) => res.json()),
    fetch("./public/data/handbook.json?v=10").then((res) => res.json()),
    fetch("./public/data/metadata.json?v=10").then((res) => res.json()),
  ]);
  state.questions = questions;
  state.handbook = handbook;
  state.metadata = metadata;
  resetLearningChoices();
  render();
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || { attempts: [] };
  } catch {
    return { attempts: [] };
  }
}

function saveProgress() {
  localStorage.setItem(storeKey, JSON.stringify(state.progress));
}

function shuffle(items) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function byPromptSearch(question) {
  const needle = state.learning.search.trim().toLowerCase();
  const categoryOk = state.learning.category === "all" || question.category === state.learning.category;
  const imageOk = !state.learning.imagesOnly || Boolean(question.imageId);
  if (!needle) return categoryOk && imageOk;
  return categoryOk && imageOk && `${question.sourceCode} ${question.prompt} ${question.choices.join(" ")}`.toLowerCase().includes(needle);
}

function learningQuestions() {
  return state.questions.filter(byPromptSearch);
}

function currentLearningQuestion() {
  const list = learningQuestions();
  if (!list.length) return null;
  if (state.learning.index >= list.length) state.learning.index = 0;
  return list[state.learning.index];
}

function resetLearningChoices() {
  const question = currentLearningQuestion();
  state.learning.selected = "";
  state.learning.confirmed = false;
  state.learning.shuffled = question ? shuffle(question.choices) : [];
}

function recordAttempt(mode, question, selected, correct) {
  state.progress.attempts.push({
    mode,
    questionId: question.id,
    selectedChoice: selected,
    correct,
    category: question.category,
    answeredAt: new Date().toISOString(),
  });
  saveProgress();
}

function pickMockQuestions() {
  const general = shuffle(state.questions.filter((q) => q.category === "general")).slice(0, PASS_RULES.generalTotal);
  const road = shuffle(state.questions.filter((q) => q.category !== "general")).slice(0, PASS_RULES.roadSafetyTotal);
  return [...general, ...road].map((question) => ({ question, choices: shuffle(question.choices) }));
}

function startMock() {
  state.mock = {
    questions: pickMockQuestions(),
    index: 0,
    selected: "",
    confirmed: false,
    answers: [],
    stopped: false,
  };
  state.view = "mock";
  render();
}

function progressSummary() {
  const attempts = state.progress.attempts;
  const learning = attempts.filter((a) => a.mode === "learning");
  const byQuestion = new Map();
  learning.forEach((attempt) => byQuestion.set(attempt.questionId, attempt));
  const missedIds = new Set(learning.filter((attempt) => !attempt.correct).map((attempt) => attempt.questionId));
  const categories = Object.keys(labels).map((category) => {
    const catAttempts = attempts.filter((attempt) => attempt.category === category);
    const correct = catAttempts.filter((attempt) => attempt.correct).length;
    return { category, total: catAttempts.length, correct };
  });
  return {
    attempts,
    answered: byQuestion.size,
    learningCorrect: learning.filter((a) => a.correct).length,
    learningTotal: learning.length,
    missed: state.questions.filter((question) => missedIds.has(question.id)),
    categories,
  };
}

function optionButton(choice, selected, confirmed, correctChoice, onClick) {
  const isSelected = selected === choice;
  const isCorrect = confirmed && choice === correctChoice;
  const isWrong = confirmed && isSelected && choice !== correctChoice;
  return `<button class="option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}" ${confirmed ? "disabled" : ""} data-action="${onClick}" data-choice="${encodeURIComponent(choice)}">${escapeHtml(choice)}</button>`;
}

function renderShell(content) {
  const nav = [
    ["learning", "Learning Mode"],
    ["mock", "Mock Test"],
    ["bank", "Question Bank"],
    ["handbook", "Handbook Vault"],
    ["progress", "Progress"],
  ];
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="mark">L</div>
        <div>
          <h1>NSW DKT Practice</h1>
            <p>${state.metadata.questionCount || 0} questions loaded · ${state.buildVersion}</p>
        </div>
        </div>
        <nav>
          ${nav.map(([id, label]) => `<button class="${state.view === id ? "active" : ""}" data-action="nav" data-view="${id}">${label}</button>`).join("")}
        </nav>
        <button class="primary wide" data-action="start-mock">New Mock Test</button>
      </aside>
      <main>${content}</main>
    </div>
  `;
}

function renderLearning() {
  const list = learningQuestions();
  const question = currentLearningQuestion();
  if (!question) {
    return renderShell(`
      <section class="toolbar">
        ${filters()}
      </section>
      <section class="empty">No questions match the current filters.</section>
    `);
  }
  const result = state.learning.confirmed ? state.learning.selected === question.correctChoice : null;
  return renderShell(`
    <section class="toolbar">
      ${filters()}
      <div class="counter">Question ${state.learning.index + 1} of ${list.length}</div>
    </section>
    <section class="question-panel">
      <div class="eyebrow">${question.sourceCode} · ${labels[question.category] || "Question"}</div>
      <h2>${escapeHtml(question.prompt)}</h2>
      ${renderQuestionImage(question)}
      <div class="options">
        ${state.learning.shuffled.map((choice) => optionButton(choice, state.learning.selected, state.learning.confirmed, question.correctChoice, "select-learning")).join("")}
      </div>
      <div class="actions">
        <button class="primary" data-action="confirm-learning" ${!state.learning.selected || state.learning.confirmed ? "disabled" : ""}>Check</button>
        <button data-action="prev-learning">Previous</button>
        <button data-action="next-learning">Next</button>
      </div>
      ${state.learning.confirmed ? renderResult(result, question) : ""}
    </section>
  `);
}

function filters() {
  return `
    <label class="search"><span>Search</span><input data-action="search" value="${escapeHtml(state.learning.search)}" placeholder="Question, answer, code" /></label>
    <label><span>Category</span><select data-action="category">
      <option value="all">All sections</option>
      ${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${state.learning.category === value ? "selected" : ""}>${label}</option>`).join("")}
    </select></label>
    <label class="check-filter"><input type="checkbox" data-action="images-only" ${state.learning.imagesOnly ? "checked" : ""} /> Images only</label>
  `;
}

function renderResult(correct, question) {
  return `
    <div class="result ${correct ? "pass" : "fail"}">
      <div class="result-head">
        <strong>${correct ? "Correct" : "Incorrect"}</strong>
        <p>The correct answer is: ${escapeHtml(question.correctChoice)}</p>
      </div>
      <div class="reason">
        <h3>Reason</h3>
        ${renderExplanation(question)}
      </div>
    </div>
  `;
}

function handbookUrl(page = 1) {
  return `./public/assets/road-users-handbook-english.pdf#page=${encodeURIComponent(page)}`;
}

function renderHandbookRef(ref) {
  return `<a href="${handbookUrl(ref.page)}" target="_blank" rel="noopener">${escapeHtml(ref.sectionTitle || "Road User Handbook")} · page ${ref.page}</a>`;
}

function fallbackReason(question) {
  return `This answer needs a reviewed explanation. Official answer: ${question.correctChoice}`;
}

function renderExplanation(question) {
  const explanation = question.explanation;
  if (!explanation) return `<p>${escapeHtml(question.reason || fallbackReason(question))}</p>`;
  return `
    <div class="explanation-block">
      <p><b>Rule:</b> ${escapeHtml(explanation.principle)}</p>
      <p><b>Why:</b> ${escapeHtml(explanation.application)}</p>
      ${explanation.watchOut ? `<p><b>Watch out:</b> ${escapeHtml(explanation.watchOut)}</p>` : ""}
    </div>
  `;
}

function renderMock() {
  if (!state.mock) {
    return renderShell(`
      <section class="intro">
        <h2>Mock Test</h2>
        <p>This imitates the in-person DKT format: 45 questions, no timer, and section-based pass marks.</p>
        <button class="primary" data-action="start-mock">Start Mock Test</button>
      </section>
    `);
  }
  const mock = state.mock;
  const summary = summarizeMock(mock.answers);
  if (mock.stopped || mock.index >= mock.questions.length) {
    return renderShell(renderMockSummary(summary, mock.answers));
  }
  const item = mock.questions[mock.index];
  const question = item.question;
  return renderShell(`
    <section class="mock-status">
      <div><b>${mock.index + 1}</b><span>of 45</span></div>
      <div><b>${summary.generalCorrect}/15</b><span>General</span></div>
      <div><b>${summary.roadSafetyCorrect}/30</b><span>Road safety</span></div>
      <div><b>${summary.generalWrong + summary.roadSafetyWrong}</b><span>Wrong</span></div>
    </section>
    <section class="question-panel">
      <div class="eyebrow">${labels[question.category]} · ${question.sourceCode}</div>
      <h2>${escapeHtml(question.prompt)}</h2>
      ${renderQuestionImage(question)}
      <div class="options">
        ${item.choices.map((choice) => optionButton(choice, mock.selected, mock.confirmed, question.correctChoice, "select-mock")).join("")}
      </div>
      <div class="actions">
        <button class="primary" data-action="confirm-mock" ${!mock.selected || mock.confirmed ? "disabled" : ""}>Check</button>
        <button data-action="next-mock" ${!mock.confirmed ? "disabled" : ""}>Next</button>
      </div>
    </section>
  `);
}

function renderMockSummary(summary, answers) {
  return `
    <section class="summary ${summary.passed ? "passed" : "failed"}">
      <h2>${summary.passed ? "Passed" : "Not passed"}</h2>
      <p>General Knowledge: ${summary.generalCorrect}/15. Road Safety: ${summary.roadSafetyCorrect}/30.</p>
      <p>${summary.earlyFail ? "The test ended early because the in-person DKT failure threshold was reached." : "The test is complete."}</p>
      <button class="primary" data-action="start-mock">Start another test</button>
    </section>
    <section class="review-list">
      ${answers.map((answer, index) => `
        <article class="${answer.correct ? "ok" : "needs-work"}">
          <span>${index + 1}. ${escapeHtml(answer.question.sourceCode)}</span>
          <b>${answer.correct ? "Correct" : "Incorrect"}</b>
          <p>${escapeHtml(answer.question.prompt)}</p>
        </article>
      `).join("")}
    </section>
  `;
}

function renderQuestionImage(question) {
  if (!question.imageId) return "";
  return `
    <figure class="question-image">
      <img src="./public/${escapeHtml(question.imageId)}" alt="Question illustration for ${escapeHtml(question.sourceCode)}" loading="lazy" />
      <figcaption>${escapeHtml(question.sourceCode)} image</figcaption>
    </figure>
  `;
}

function renderThumb(question) {
  if (!question.imageId) return "";
  return `<img class="thumb" src="./public/${escapeHtml(question.imageId)}" alt="" loading="lazy" />`;
}

function renderBank() {
  const grouped = Object.entries(labels).map(([category, label]) => {
    const questions = state.questions.filter((question) => question.category === category);
    return `
      <section class="bank-group">
        <h2>${label}</h2>
        <div class="bank-grid">
          ${questions.map((question) => `<article>${renderThumb(question)}<b>${question.sourceCode}</b><p>${escapeHtml(question.prompt)}</p></article>`).join("")}
        </div>
      </section>
    `;
  }).join("");
  return renderShell(grouped);
}

function renderHandbook() {
  const sections = [];
  const seen = new Set();
  for (const chunk of state.handbook) {
    const key = `${chunk.sectionTitle}-${chunk.page}`;
    if (!chunk.sectionTitle || seen.has(key)) continue;
    seen.add(key);
    sections.push(chunk);
  }
  return renderShell(`
    <section class="intro">
      <h2>Handbook Vault</h2>
      <p>The original Road Users Handbook is the source of truth. Question references open the relevant PDF page directly.</p>
      <div class="actions">
        <a class="button-link primary" href="${handbookUrl(1)}" target="_blank" rel="noopener">Open handbook PDF</a>
        <a class="button-link" href="./public/assets/road-users-handbook-english.pdf" download>Download PDF</a>
      </div>
    </section>
    <section class="handbook-viewer">
      <iframe title="Road Users Handbook PDF" src="${handbookUrl(1)}"></iframe>
    </section>
    <section class="bank-group">
      <h2>Quick Page Links</h2>
      <div class="handbook-links">
        ${sections.slice(0, 80).map((chunk) => `<a href="${handbookUrl(chunk.page)}" target="_blank" rel="noopener">Page ${chunk.page} · ${escapeHtml(chunk.sectionTitle)}</a>`).join("")}
      </div>
    </section>
  `);
}

function renderProgress() {
  const summary = progressSummary();
  return renderShell(`
    <section class="stats-grid">
      <article><b>${summary.answered}</b><span>Questions practised</span></article>
      <article><b>${summary.learningTotal ? Math.round((summary.learningCorrect / summary.learningTotal) * 100) : 0}%</b><span>Learning accuracy</span></article>
      <article><b>${summary.missed.length}</b><span>Retry list</span></article>
    </section>
    <section class="bank-group">
      <h2>Category Accuracy</h2>
      <div class="progress-bars">
        ${summary.categories.map((item) => {
          const pct = item.total ? Math.round((item.correct / item.total) * 100) : 0;
          return `<div><span>${labels[item.category]}</span><meter min="0" max="100" value="${pct}"></meter><b>${pct}%</b></div>`;
        }).join("")}
      </div>
    </section>
    <section class="bank-group">
      <h2>Retry List</h2>
      <div class="bank-grid">
        ${summary.missed.slice(0, 60).map((question) => `<article><b>${question.sourceCode}</b><p>${escapeHtml(question.prompt)}</p></article>`).join("") || "<p>No missed questions yet.</p>"}
      </div>
      <button data-action="clear-progress">Clear progress</button>
    </section>
  `);
}

function render() {
  const views = {
    learning: renderLearning,
    mock: renderMock,
    bank: renderBank,
    handbook: renderHandbook,
    progress: renderProgress,
  };
  document.querySelector("#app").innerHTML = (views[state.view] || renderLearning)();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function celebrate(anchor) {
  playCorrectSound();
  const rect = anchor.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const colours = ["#0b5cab", "#ffc857", "#17874f", "#f25f5c", "#35a7ff"];
  const layer = document.createElement("div");
  layer.className = "celebration-layer";
  document.body.appendChild(layer);

  for (let i = 0; i < 34; i += 1) {
    const particle = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 70 + Math.random() * 130;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - 35;
    particle.className = "confetti";
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.setProperty("--x", `${x}px`);
    particle.style.setProperty("--y", `${y}px`);
    particle.style.setProperty("--r", `${Math.random() * 360}deg`);
    particle.style.background = colours[i % colours.length];
    particle.style.animationDelay = `${Math.random() * 70}ms`;
    layer.appendChild(particle);
  }

  for (let i = 0; i < 3; i += 1) {
    const ring = document.createElement("span");
    ring.className = "firework-ring";
    ring.style.left = `${originX}px`;
    ring.style.top = `${originY}px`;
    ring.style.animationDelay = `${i * 90}ms`;
    layer.appendChild(ring);
  }

  window.setTimeout(() => layer.remove(), 1000);
}

function playCorrectSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const now = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.075);
    oscillator.connect(gain);
    oscillator.start(now + index * 0.075);
    oscillator.stop(now + 0.36 + index * 0.035);
  });

  window.setTimeout(() => context.close(), 650);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  let handled = true;
  if (action === "nav") {
    state.view = target.dataset.view;
  } else if (action === "start-mock") {
    startMock();
    return;
  } else if (action === "select-learning") {
    state.learning.selected = decodeURIComponent(target.dataset.choice);
  } else if (action === "confirm-learning") {
    const question = currentLearningQuestion();
    const correct = state.learning.selected === question.correctChoice;
    state.learning.confirmed = true;
    recordAttempt("learning", question, state.learning.selected, correct);
    if (correct) celebrate(target);
  } else if (action === "next-learning" || action === "prev-learning") {
    const list = learningQuestions();
    const delta = action === "next-learning" ? 1 : -1;
    state.learning.index = (state.learning.index + delta + list.length) % list.length;
    resetLearningChoices();
  } else if (action === "select-mock") {
    state.mock.selected = decodeURIComponent(target.dataset.choice);
  } else if (action === "confirm-mock") {
    const item = state.mock.questions[state.mock.index];
    const correct = state.mock.selected === item.question.correctChoice;
    state.mock.confirmed = true;
    state.mock.answers.push({ question: item.question, category: item.question.category, selected: state.mock.selected, correct });
    recordAttempt("mock", item.question, state.mock.selected, correct);
    if (correct) celebrate(target);
    if (shouldStopMock(state.mock.answers)) state.mock.stopped = true;
  } else if (action === "next-mock") {
    state.mock.index += 1;
    state.mock.selected = "";
    state.mock.confirmed = false;
  } else if (action === "clear-progress") {
    state.progress = { attempts: [] };
    saveProgress();
  } else {
    handled = false;
  }
  if (handled) render();
});

document.addEventListener("input", (event) => {
  if (event.target.dataset.action === "search") {
    state.learning.search = event.target.value;
    state.learning.index = 0;
    resetLearningChoices();
    render();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.dataset.action === "category") {
    state.learning.category = event.target.value;
    state.learning.index = 0;
    resetLearningChoices();
    render();
  }
  if (event.target.dataset.action === "images-only") {
    state.learning.imagesOnly = event.target.checked;
    state.learning.index = 0;
    resetLearningChoices();
    render();
  }
});

init();
