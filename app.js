const $ = (selector) => document.querySelector(selector);

const state = {
  pool: [],
  current: 0,
  score: 0,
  answers: [],
  startedAt: null,
  mode: "normal",
};

const STORAGE_KEYS = {
  best: "efvvQuizBestScore",
  mistakes: "efvvQuizMistakes",
  theme: "efvvQuizTheme",
};

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getCategories() {
  const categories = [...new Set(window.QUESTION_BANK.map((q) => q.category))];
  return ["Усі категорії", ...categories];
}

function init() {
  $("#totalQuestions").textContent = window.QUESTION_BANK.length;
  renderCategories();
  updateBestScore();
  restoreTheme();
  bindEvents();
}

function renderCategories() {
  const select = $("#categorySelect");
  select.innerHTML = getCategories()
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");
}

function bindEvents() {
  $("#startBtn").addEventListener("click", () => startQuiz());
  $("#mistakesBtn").addEventListener("click", () => startMistakesQuiz());
  $("#nextBtn").addEventListener("click", nextQuestion);
  $("#exitBtn").addEventListener("click", goHome);
  $("#restartBtn").addEventListener("click", goHome);
  $("#retryWrongBtn").addEventListener("click", startMistakesQuiz);
  $("#themeToggle").addEventListener("click", toggleTheme);
}

function buildPool() {
  const selectedCategory = $("#categorySelect").value;
  const selectedCount = $("#questionCount").value;
  const shouldShuffle = $("#shuffleToggle").checked;
  let pool = selectedCategory === "Усі категорії"
    ? [...window.QUESTION_BANK]
    : window.QUESTION_BANK.filter((q) => q.category === selectedCategory);

  if (shouldShuffle) pool = shuffle(pool);
  if (selectedCount !== "all") pool = pool.slice(0, Number(selectedCount));
  return pool;
}

function startQuiz(customPool = null, mode = "normal") {
  const pool = customPool || buildPool();
  if (!pool.length) {
    alert("Для цього режиму поки немає питань.");
    return;
  }
  state.pool = pool;
  state.current = 0;
  state.score = 0;
  state.answers = [];
  state.startedAt = Date.now();
  state.mode = mode;

  $("#startCard").classList.add("hidden");
  $("#resultCard").classList.add("hidden");
  $("#quizCard").classList.remove("hidden");
  window.scrollTo({ top: $("#quizCard").offsetTop - 16, behavior: "smooth" });
  renderQuestion();
}

function startMistakesQuiz() {
  const ids = getMistakeIds();
  const pool = window.QUESTION_BANK.filter((q) => ids.includes(q.id));
  if (!pool.length) {
    alert("Помилок ще немає. Спочатку пройди звичайний тест 🙂");
    return;
  }
  startQuiz(shuffle(pool), "mistakes");
}

function renderQuestion() {
  const question = state.pool[state.current];
  const progress = ((state.current) / state.pool.length) * 100;
  $("#progressBar").style.width = `${progress}%`;
  $("#questionCategory").textContent = `${question.category} · ${labelDifficulty(question.difficulty)}`;
  $("#questionText").textContent = question.question;
  $("#currentNumber").textContent = state.current + 1;
  $("#quizTotal").textContent = state.pool.length;
  $("#explanationBox").classList.add("hidden");
  $("#nextBtn").disabled = true;
  $("#nextBtn").textContent = state.current === state.pool.length - 1 ? "Завершити" : "Далі";

  const prepared = question.options.map((text, index) => ({ text, originalIndex: index }));
  const answers = shuffle(prepared);
  $("#answers").innerHTML = answers.map((answer) => `
    <button class="answer-btn" data-index="${answer.originalIndex}" type="button">${answer.text}</button>
  `).join("");

  document.querySelectorAll(".answer-btn").forEach((button) => {
    button.addEventListener("click", () => selectAnswer(Number(button.dataset.index)));
  });
}

function selectAnswer(selectedIndex) {
  const question = state.pool[state.current];
  const isCorrect = selectedIndex === question.answer;
  if (isCorrect) state.score += 1;

  document.querySelectorAll(".answer-btn").forEach((button) => {
    const answerIndex = Number(button.dataset.index);
    button.classList.add("locked");
    if (answerIndex === question.answer) button.classList.add("correct");
    if (answerIndex === selectedIndex && !isCorrect) button.classList.add("wrong");
  });

  $("#resultLabel").textContent = isCorrect ? "Правильно ✅" : "Помилка — запам’ятай цей момент ⚡";
  $("#explanationText").textContent = question.explanation;
  $("#explanationBox").classList.remove("hidden");
  $("#nextBtn").disabled = false;

  state.answers.push({
    id: question.id,
    selectedIndex,
    correctIndex: question.answer,
    isCorrect,
  });
}

function nextQuestion() {
  if (state.current < state.pool.length - 1) {
    state.current += 1;
    renderQuestion();
    return;
  }
  finishQuiz();
}

function finishQuiz() {
  $("#progressBar").style.width = "100%";
  const percent = Math.round((state.score / state.pool.length) * 100);
  const wrongAnswers = state.answers.filter((answer) => !answer.isCorrect);
  saveMistakes(wrongAnswers.map((answer) => answer.id));
  saveBestScore(percent);

  const seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  $("#quizCard").classList.add("hidden");
  $("#resultCard").classList.remove("hidden");
  $("#resultScore").textContent = `${percent}%`;
  $("#correctCount").textContent = state.score;
  $("#wrongCount").textContent = state.pool.length - state.score;
  $("#timeSpent").textContent = formatTime(seconds);
  $("#resultTitle").textContent = titleForScore(percent);
  $("#resultMessage").textContent = messageForScore(percent);
  $("#retryWrongBtn").disabled = wrongAnswers.length === 0;
  renderReview(wrongAnswers);
  updateBestScore();
  window.scrollTo({ top: $("#resultCard").offsetTop - 16, behavior: "smooth" });
}

function renderReview(wrongAnswers) {
  const box = $("#reviewBox");
  if (!wrongAnswers.length) {
    box.innerHTML = `<div class="review-item"><strong>Ідеально!</strong><p>Помилок немає. Можеш збільшити кількість питань або пройти окремо категорію «Вчені».</p></div>`;
    return;
  }
  box.innerHTML = wrongAnswers.map((answer) => {
    const q = window.QUESTION_BANK.find((item) => item.id === answer.id);
    return `<article class="review-item">
      <span class="review-badge">${q.category}</span>
      <strong>${q.question}</strong>
      <p><b>Правильно:</b> ${q.options[q.answer]}</p>
      <p>${q.explanation}</p>
    </article>`;
  }).join("");
}

function goHome() {
  $("#quizCard").classList.add("hidden");
  $("#resultCard").classList.add("hidden");
  $("#startCard").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function labelDifficulty(value) {
  return { easy: "легко", medium: "середньо", hard: "складно" }[value] || value;
}

function titleForScore(percent) {
  if (percent >= 90) return "Потужно! Майже готово 🔥";
  if (percent >= 75) return "Хороший рівень, ще трохи практики 💪";
  if (percent >= 55) return "База є, але треба повторити слабкі теми 📚";
  return "Потрібен повтор теорії й робота з помилками 🧠";
}

function messageForScore(percent) {
  if (percent >= 90) return "Ти добре тримаєш педагогіку та вчених. Для закріплення пройди режим на всі питання.";
  if (percent >= 75) return "Нормальний результат. Найкраща стратегія — повторити помилки й окремо пройти категорію з ученими.";
  if (percent >= 55) return "Зверни увагу на дидактику, принципи навчання, методи виховання та відповідність “учений → ідея”.";
  return "Почни з категорій «Педагогіка» і «Вчені», а потім переходь до методів дослідження та психології.";
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getMistakeIds() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.mistakes) || "[]");
}

function saveMistakes(newMistakes) {
  const previous = getMistakeIds();
  const solvedNow = state.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id);
  const merged = new Set([...previous, ...newMistakes]);
  solvedNow.forEach((id) => merged.delete(id));
  localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify([...merged]));
}

function saveBestScore(percent) {
  const best = Number(localStorage.getItem(STORAGE_KEYS.best) || 0);
  if (percent > best) localStorage.setItem(STORAGE_KEYS.best, String(percent));
}

function updateBestScore() {
  const best = localStorage.getItem(STORAGE_KEYS.best);
  $("#bestScore").textContent = best ? `Найкращий результат: ${best}%` : "Найкращий результат: —";
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = current;
  localStorage.setItem(STORAGE_KEYS.theme, current);
  $("#themeToggle").textContent = current === "dark" ? "☀️" : "🌙";
}

function restoreTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved) document.documentElement.dataset.theme = saved;
  $("#themeToggle").textContent = document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙";
}

document.addEventListener("DOMContentLoaded", init);
