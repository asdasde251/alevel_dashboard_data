const dashboardEl = document.getElementById('dashboard');
const overviewEl = document.getElementById('overview');
const paperTemplate = document.getElementById('paper-template');
const STORAGE_KEY = 'alevel-dashboard-state-v1';

const PAPER_ORDER = [
  'PHYSICS PAPER 1',
  'PHYSICS PAPER 2',
  'COMPUTER SCIENCE PAPER 1',
  'COMPUTER SCIENCE PAPER 2',
  'MATHEMATICS P1',
  'MATHEMATICS S1'
];

const CATEGORY_GROUPS = {
  Physics: ['PHYSICS PAPER 1', 'PHYSICS PAPER 2'],
  'Computer Science': ['COMPUTER SCIENCE PAPER 1', 'COMPUTER SCIENCE PAPER 2'],
  Mathematics: ['MATHEMATICS P1', 'MATHEMATICS S1']
};

let appData = [];
let state = loadState();

init();

async function init() {
  try {
    const raw = await fetch('alevel_dashboard_data.txt').then((res) => res.text());
    appData = parseData(raw);
    renderDashboard();
    updateAllSummaries();
  } catch (error) {
    dashboardEl.innerHTML = `<p>Unable to load dashboard data file.</p>`;
    console.error(error);
  }
}

function parseData(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const papers = [];
  let currentPaper = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(MATHEMATICS P1|MATHEMATICS S1|COMPUTER SCIENCE PAPER 1|COMPUTER SCIENCE PAPER 2|PHYSICS PAPER 1|PHYSICS PAPER 2) \((\d+) marks\)$/i);

    if (headingMatch) {
      if (currentPaper) papers.push(currentPaper);
      currentPaper = {
        name: headingMatch[1].toUpperCase(),
        totalMarks: Number(headingMatch[2]),
        topics: []
      };
      continue;
    }

    if (!currentPaper) continue;
    const topicMatch = line.match(/^(.+) \((\d+)\)$/);
    if (topicMatch) {
      currentPaper.topics.push({
        topic: topicMatch[1],
        marks: Number(topicMatch[2])
      });
    }
  }

  if (currentPaper) papers.push(currentPaper);

  return PAPER_ORDER.map((paperName) => papers.find((p) => p.name === paperName)).filter(Boolean);
}

function renderDashboard() {
  dashboardEl.innerHTML = '';

  appData.forEach((paper) => {
    const clone = paperTemplate.content.cloneNode(true);
    const card = clone.querySelector('.paper-card');
    const title = clone.querySelector('.paper-title');
    const total = clone.querySelector('.paper-total');
    const body = clone.querySelector('.paper-body');

    card.dataset.paper = paper.name;
    title.textContent = paper.name;
    total.textContent = `Total: ${paper.totalMarks}`;

    paper.topics.forEach((topicObj, index) => {
      const row = document.createElement('tr');
      row.dataset.paper = paper.name;
      row.dataset.topic = topicObj.topic;
      row.dataset.marks = String(topicObj.marks);

      const gripValue = getStoredField(paper.name, topicObj.topic, 'grip', '');
      const notesValue = getStoredField(paper.name, topicObj.topic, 'notes', '');

      row.innerHTML = `
        <td>${topicObj.topic} (${topicObj.marks})</td>
        <td>
          <input class="grip-input" type="number" min="1" max="10" step="1" inputmode="numeric" value="${escapeAttr(
            gripValue
          )}" placeholder="1-10" aria-label="Grip rating for ${topicObj.topic}" />
        </td>
        <td>
          <input class="notes-input" type="text" value="${escapeAttr(
            notesValue
          )}" placeholder="Add notes" aria-label="Notes for ${topicObj.topic}" />
        </td>
      `;

      body.appendChild(row);
      paintRowStrength(row, Number(gripValue));

      row.querySelector('.grip-input').addEventListener('input', (event) => {
        const value = sanitizeGrip(event.target.value);
        event.target.value = value;
        setStoredField(paper.name, topicObj.topic, 'grip', value);
        paintRowStrength(row, Number(value));
        updatePaperSummary(paper.name);
        updateOverview();
      });

      row.querySelector('.notes-input').addEventListener('input', (event) => {
        setStoredField(paper.name, topicObj.topic, 'notes', event.target.value);
      });
    });

    dashboardEl.appendChild(clone);
  });

  renderOverviewCards();
}

function renderOverviewCards() {
  const cards = ['Estimated Physics Score', 'Estimated Computer Science Score', 'Estimated Math Score', 'Overall AS Score'];
  overviewEl.innerHTML = cards
    .map(
      (title) => `<article class="score-card"><h3>${title}</h3><p data-score="${title}">0.00%</p></article>`
    )
    .join('');
}

function updateAllSummaries() {
  appData.forEach((paper) => updatePaperSummary(paper.name));
  updateOverview();
}

function updatePaperSummary(paperName) {
  const card = dashboardEl.querySelector(`.paper-card[data-paper="${cssEscape(paperName)}"]`);
  if (!card) return;

  const rows = [...card.querySelectorAll('tbody tr')];
  let expected = 0;
  let total = 0;

  rows.forEach((row) => {
    const marks = Number(row.dataset.marks || 0);
    const grip = Number(row.querySelector('.grip-input').value || 0);
    expected += marks * (grip / 10);
    total += marks;
  });

  const percent = total ? (expected / total) * 100 : 0;

  card.querySelector('.summary-expected').textContent = expected.toFixed(2);
  card.querySelector('.summary-total').textContent = String(total);
  card.querySelector('.summary-percent').textContent = `${percent.toFixed(2)}%`;
}

function updateOverview() {
  const scores = Object.entries(CATEGORY_GROUPS).reduce((acc, [subject, papers]) => {
    let expected = 0;
    let total = 0;

    papers.forEach((paperName) => {
      const paperCard = dashboardEl.querySelector(`.paper-card[data-paper="${cssEscape(paperName)}"]`);
      if (!paperCard) return;
      const paperExpected = Number(paperCard.querySelector('.summary-expected').textContent || 0);
      const paperTotal = Number(paperCard.querySelector('.summary-total').textContent || 0);
      expected += paperExpected;
      total += paperTotal;
    });

    acc[subject] = total ? (expected / total) * 100 : 0;
    acc._expected = (acc._expected || 0) + expected;
    acc._total = (acc._total || 0) + total;
    return acc;
  }, {});

  setOverview('Estimated Physics Score', scores.Physics || 0);
  setOverview('Estimated Computer Science Score', scores['Computer Science'] || 0);
  setOverview('Estimated Math Score', scores.Mathematics || 0);
  setOverview('Overall AS Score', scores._total ? (scores._expected / scores._total) * 100 : 0);
}

function setOverview(label, value) {
  const target = overviewEl.querySelector(`[data-score="${label}"]`);
  if (target) target.textContent = `${value.toFixed(2)}%`;
}

function sanitizeGrip(value) {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const num = Math.min(10, Math.max(1, Number(digits)));
  return String(num);
}

function paintRowStrength(row, grip) {
  row.classList.remove('weak', 'strong');
  if (!Number.isFinite(grip)) return;
  if (grip <= 4 && grip >= 1) row.classList.add('weak');
  if (grip >= 8) row.classList.add('strong');
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function setStoredField(paper, topic, key, value) {
  state[paper] = state[paper] || {};
  state[paper][topic] = state[paper][topic] || {};
  state[paper][topic][key] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStoredField(paper, topic, key, fallback) {
  return state?.[paper]?.[topic]?.[key] ?? fallback;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return value.replace(/"/g, '\\"');
}
