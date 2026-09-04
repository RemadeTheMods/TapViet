if (typeof window.storage === 'undefined') {
  window.storage = {
    async get(key) {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return { key, value: raw };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      const existed = localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
      return { key, deleted: existed };
    },
    async list(prefix) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!prefix || k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix: prefix || null };
    }
  };
}

// Config
const GEMINI_API_KEY = 'AQ.Ab8RN6J61bDnIJDopdf_mgqkLInvl-TbGa2gKQGd553Etc2VXw';

let running = false;
let currentEssayId = null;
let currentPhotos = []; // { id, name, dataUrl }
let timerInterval = null;
let timerRemaining = 2400;
let timerRunning = false;
let timerCount = 0;
let wpmInterval = null;

const els = {
  question: document.getElementById('question'),
  goalInput: document.getElementById('goal-input'),
  goalBar: document.getElementById('goal-bar'),
  goalCaption: document.getElementById('goal-caption'),
  essay: document.getElementById('essay'),
  essayTitle: document.getElementById('essay-title'),
  saveBtn: document.getElementById('save-btn'),
  newEssayBtn: document.getElementById('new-essay-btn'),
  saveStatus: document.getElementById('save-status'),
  historyList: document.getElementById('history-list'),
  statEssays: document.getElementById('stat-essays'),
  statWords: document.getElementById('stat-words'),
  statStreak: document.getElementById('stat-streak'),
  statAvg: document.getElementById('stat-avg'),
  timerDisplay: document.getElementById('timer-display'),
  timerCountDisplay: document.getElementById('m-timer'),
  timerToggle: document.getElementById('timer-toggle'),
  timerReset: document.getElementById('timer-reset'),
  timerLength: document.getElementById('timer-length'),
  mWords: document.getElementById('m-words'),
  mChars: document.getElementById('m-chars'),
  mSentences: document.getElementById('m-sentences'),
  mParagraphs: document.getElementById('m-paragraphs'),
  mWPM: document.getElementById('m-wpm'),
  addPhotoBtn: document.getElementById('add-photo-btn'),
  photoInput: document.getElementById('photo-input'),
  photosGrid: document.getElementById('photos-grid'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
  
};


// Đổi bài 
function change1() {
  const bro = document.getElementById('question');
  bro.className='type1';
  
  els.goalInput.value = 150;
  updateMetrics();
  
  const div = document.getElementById('photo');
  div.style.display = 'block'; 

  const task1 = document.getElementById('task1');
  const task2 = document.getElementById('task2');
  
  task1.className = 'mono';
  task2.className = 'ghost mono';
}
function change2() {
  const bro = document.getElementById('question');
  bro.className='type2';
  
  els.goalInput.value = 250;
  updateMetrics();
  
  const div = document.getElementById('photo');
  div.style.display = 'none'; 
  
  const task1 = document.getElementById('task1');
  const task2 = document.getElementById('task2');
  
  task2.className = 'mono';
  task1.className = 'ghost mono';
}

// đếm
function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
function countSentences(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?]+[.!?]+/g);
  if (matches) return matches.length;
  return trimmed.length > 0 ? 1 : 0;
}
function countParagraphs(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
}
// update
function updateTimerCount() {
  if (!wpmInterval) {
    wpmInterval = setInterval(() => {
      if (running) {
        timerCount++;
        updateMetrics();
        updateTimerDisplay();
      }
    }, 1000);
  }
}

function updateMetrics() {
  const min = timerCount/60;
  const text = els.essay.value;
  const words = countWords(text);
  const chars = text.length;
  const sentences = countSentences(text);
  const paragraphs = countParagraphs(text);
  const wordPM = Math.max(1, Math.round(words / min));

  
  els.mWords.textContent = words.toLocaleString();
  els.mChars.textContent = chars.toLocaleString();
  els.mSentences.textContent = sentences.toLocaleString();
  els.mParagraphs.textContent = paragraphs.toLocaleString();
  els.mWPM.textContent = words === 0 ? '0' : wordPM;

  const goal = Math.max(0, parseInt(els.goalInput.value) || 0);
  const pct = goal > 0 ? Math.min(100, Math.round((words / goal) * 100)) : 0;
  els.goalBar.style.width = pct + '%';
  els.goalCaption.textContent = words.toLocaleString() + ' / ' + goal.toLocaleString() + ' words' + (goal > 0 && words >= goal ? ' — goal reached' : '');

  markUnsaved();
  return { words, chars, sentences, paragraphs };
}
// save
function markUnsaved() {
  els.saveStatus.textContent = 'unsaved changes';
  els.saveStatus.classList.remove('saved');
}
// tg
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

function updateTimerDisplay() {
  els.timerDisplay.textContent = formatTime(timerRemaining);
  els.timerCountDisplay.textContent = formatTime(timerCount);
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    els.timerToggle.textContent = 'Start';
  } else {
    timerRunning = true;
    els.timerToggle.textContent = 'Pause';
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        els.timerToggle.textContent = 'Start';
        els.timerDisplay.textContent = "time's up";
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  els.timerToggle.textContent = 'Start';
  timerRemaining = parseInt(els.timerLength.value);
  updateTimerDisplay();
}

function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// --- photos ---

function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function handlePhotoFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  for (const file of files) {
    try {
      const dataUrl = await resizeImageFile(file, 1400, 0.85);
      currentPhotos.push({ id: genId(), name: file.name, dataUrl });
    } catch (e) {
      console.error('Photo failed to load:', file.name, e);
    }
  }
  renderPhotos();
  markUnsaved();
}

function removePhoto(id) {
  currentPhotos = currentPhotos.filter(p => p.id !== id);
  renderPhotos();
  markUnsaved();
}

function renderPhotos() {
  if (currentPhotos.length === 0) {
    els.photosGrid.innerHTML = '<p class="empty-note" id="photos-empty">No photos attached.</p>';
    return;
  }
  els.photosGrid.innerHTML = '';
  currentPhotos.forEach(photo => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.alt = photo.name || 'attached photo';
    img.addEventListener('click', () => openLightbox(photo.dataUrl));
    const removeBtn = document.createElement('button');
    removeBtn.className = 'photo-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove photo';
    removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removePhoto(photo.id); });
    thumb.appendChild(img);
    thumb.appendChild(removeBtn);
    els.photosGrid.appendChild(thumb);
  });
}

function openLightbox(src) {
  els.lightboxImg.src = src;
  els.lightbox.classList.add('open');
}
function closeLightbox() {
  els.lightbox.classList.remove('open');
  els.lightboxImg.src = '';
}

//storage

async function getAllEssayIds() {
  try {
    const result = await window.storage.list('essays:');
    return result ? result.keys : [];
  } catch (e) {
    return [];
  }
}

async function loadHistory() {
  const keys = await getAllEssayIds();
  const items = [];
  for (const key of keys) {
    try {
      const res = await window.storage.get(key);
      if (res && res.value) items.push(JSON.parse(res.value));
    } catch (e) {}
  }
  items.sort((a, b) => b.savedAt - a.savedAt);
  renderHistory(items);
  renderStats(items);
}

function renderHistory(items) {
  if (items.length === 0) {
    els.historyList.innerHTML = '<p class="empty-note">Nothing saved yet.</p>';
    return;
  }
  els.historyList.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const date = new Date(item.savedAt);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const photoCount = (item.photos || []).length;
    const photoBadge = photoCount > 0 ? '<span class="hphoto-badge">📎 ' + photoCount + '</span>' : '';
    div.innerHTML =
      '<div class="htitle">' + escapeHtml(item.title || 'Untitled piece') + '</div>' +
      (item.question ? '<div class="hquestion">' + escapeHtml(item.question) + '</div>' : '') +
      '<div class="hmeta"><span>' + dateStr + '</span><span style="display:flex;gap:0.5rem;align-items:center;">' + photoBadge + '<span>' + item.wordCount + ' words</span></span></div>' +
      '<div class="history-item-actions"><button class="delete-link" data-id="' + item.id + '">delete</button></div>';
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-link')) return;
      loadEssay(item);
    });
    div.querySelector('.delete-link').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete "' + (item.title || 'Untitled piece') + '"? This cannot be undone.')) {
        await deleteEssay(item.id);
      }
    });
    els.historyList.appendChild(div);
  });
}

async function deleteEssay(id) {
  try {
    await window.storage.delete('essays:' + id);
    if (currentEssayId === id) startNewEssay();
    loadHistory();
  } catch (e) {
    console.error('Delete failed', e);
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function renderStats(items) {
  const totalEssays = items.length;
  const totalWords = items.reduce((sum, i) => sum + (i.wordCount || 0), 0);
  const avgWords = totalEssays > 0 ? Math.round(totalWords / totalEssays) : 0;

  const days = new Set(items.map(i => new Date(i.savedAt).toDateString()));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  els.statEssays.textContent = totalEssays.toLocaleString();
  els.statWords.textContent = totalWords.toLocaleString();
  els.statStreak.textContent = streak.toLocaleString();
  els.statAvg.textContent = avgWords.toLocaleString();
}

function loadEssay(item) {
  currentEssayId = item.id;
  els.essayTitle.value = item.title || '';
  els.question.value = item.question || '';
  els.essay.value = item.text || '';
  currentPhotos = (item.photos || []).map(p => ({ ...p }));
  renderPhotos();
  updateMetrics();
  els.saveStatus.textContent = 'loaded';
  els.saveStatus.classList.add('saved');
}

function startNewEssay() {
  currentEssayId = null;
  timerCount = 0;
  els.essayTitle.value = '';
  els.question.value = '';
  els.essay.value = '';
  currentPhotos = [];
  renderPhotos();
  updateMetrics();
  els.saveStatus.textContent = '';
  els.saveStatus.classList.remove('saved');
  els.essay.focus();
}

async function saveEssay() {
  const text = els.essay.value;
  const question = els.question.value;
  if (text.trim().length === 0 && question.trim().length === 0) {
    els.saveStatus.textContent = 'nothing to save';
    els.saveStatus.classList.remove('saved');
    return;
  }
  const metrics = updateMetrics();
  const id = currentEssayId || genId();
  const title = els.essayTitle.value.trim() ||
    (text.trim() ? text.trim().split(/\s+/).slice(0, 6).join(' ') + '…' : 'Untitled piece');
  const record = {
    id: id,
    title: title,
    question: question,
    text: text,
    photos: currentPhotos,
    wordCount: metrics.words,
    savedAt: Date.now()
  };
  try {
    await window.storage.set('essays:' + id, JSON.stringify(record));
    currentEssayId = id;
    els.saveStatus.textContent = 'saved';
    els.saveStatus.classList.add('saved');
    loadHistory();
  } catch (e) {
    els.saveStatus.textContent = 'save failed — try smaller photos';
    els.saveStatus.classList.remove('saved');
  }
}

els.essay.addEventListener('input', updateMetrics);
els.essay.addEventListener('input', () => {  if (els.essay.value == null) {
    running = false;
  } else {
    running = true;
  }
});
els.question.addEventListener('input', markUnsaved);
els.essayTitle.addEventListener('input', markUnsaved);
els.goalInput.addEventListener('input', updateMetrics);
els.saveBtn.addEventListener('click', saveEssay);
els.newEssayBtn.addEventListener('click', startNewEssay);
els.timerToggle.addEventListener('click', toggleTimer);
els.timerReset.addEventListener('click', resetTimer);
els.timerLength.addEventListener('change', resetTimer);

els.addPhotoBtn.addEventListener('click', () => els.photoInput.click());
els.photoInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length) {
    handlePhotoFiles(e.target.files);
  }
  e.target.value = '';
});

els.lightbox.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveEssay();
  }
});

updateMetrics();
updateTimerDisplay();
loadHistory();
updateTimerCount();

//translator


const T_LANGUAGES = [
  { code: 'vi', name: 'Vietnamese' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
];

const tEls = {
  sourceLang: document.getElementById('t-source-lang'),
  targetLang: document.getElementById('t-target-lang'),
  swapBtn: document.getElementById('t-swap-btn'),
  sourceText: document.getElementById('t-source-text'),
  outputBox: document.getElementById('t-output-box'),
  detectedWrap: document.getElementById('t-detected-wrap'),
  charCount: document.getElementById('t-char-count'),
  translateBtn: document.getElementById('t-translate-btn'),
  copyBtn: document.getElementById('t-copy-btn'),
};

function tPopulateLangSelects() {
  if (!tEls.sourceLang || !tEls.targetLang) return;
  const autoOption = '<option value="auto">Detect language</option>';
  const opts = T_LANGUAGES.map(l => '<option value="' + l.code + '">' + l.name + '</option>').join('');
  tEls.sourceLang.innerHTML = autoOption + opts;
  tEls.targetLang.innerHTML = opts;
  tEls.sourceLang.value = 'vi';
  tEls.targetLang.value = 'en';
}

function tLangName(code) {
  if (code === 'auto') return null;
  const found = T_LANGUAGES.find(l => l.code === code);
  return found ? found.name : code;
}

function tUpdateCharCount() {
  if (!tEls.sourceText || !tEls.charCount) return;
  const len = tEls.sourceText.value.length;
  tEls.charCount.textContent = len.toLocaleString() + ' characters';
}

function tSetLoading(isLoading) {
  if (!tEls.translateBtn) return;
  tEls.translateBtn.disabled = isLoading;
  tEls.translateBtn.textContent = isLoading ? 'Translating…' : 'Translate';
}

function tShowOutput(text, { isError = false, isPlaceholder = false } = {}) {
  if (!tEls.outputBox) return;
  tEls.outputBox.textContent = text;
  tEls.outputBox.classList.toggle('error', isError);
  tEls.outputBox.classList.toggle('placeholder', isPlaceholder);
  if (tEls.copyBtn) {
    tEls.copyBtn.disabled = isError || isPlaceholder || !text;
  }
}

function tShowDetectedBadge(name) {
  if (!tEls.detectedWrap) return;
  if (!name) {
    tEls.detectedWrap.innerHTML = '';
    return;
  }
  tEls.detectedWrap.innerHTML =
    '<span class="detected-badge"><span class="dot"></span>detected: ' + name + '</span>';
}

function tExtractJson(raw) {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function tTranslate() {
  if (!tEls.sourceText) return;
  const text = tEls.sourceText.value.trim();
  if (!text) {
    tShowOutput('Write something above first.', { isPlaceholder: true });
    return;
  }

  const sourceCode = tEls.sourceLang.value;
  const targetCode = tEls.targetLang.value;
  const targetName = tLangName(targetCode);
  const sourceName = tLangName(sourceCode); // null if auto

  tSetLoading(true);
  tShowDetectedBadge(null);
  tShowOutput('Translating…', { isPlaceholder: true });

  const instruction = sourceName
    ? 'Translate the text from ' + sourceName + ' into ' + targetName + '.'
    : 'Detect the language of the text, then translate it into ' + targetName + '.';

  const systemPrompt =
    'You are a precise translation engine embedded in an app. ' + instruction +
    ' Preserve the original meaning, tone, and paragraph breaks — do not summarize, ' +
    'add commentary, or explain word choices. Respond with ONLY a raw JSON object ' +
    'in exactly this shape: ' +
    '{"detectedLanguageName": "<name of the source language, in English>", "translation": "<the translated text>"}';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: text }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Request failed: ${response.status} - ${errData.error?.message || ''}`);
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts
      ?.map(block => block.text || '')
      .filter(Boolean)
      .join('\n') || '';

    const parsed = tExtractJson(raw);
    tShowOutput(parsed.translation || '(no translation returned)');
    if (sourceCode === 'auto') {
      tShowDetectedBadge(parsed.detectedLanguageName || null);
    }
  } catch (err) {
    console.error('Translation error:', err);
    tShowOutput('Translation failed — try again in a moment.', { isError: true });
  } finally {
    tSetLoading(false);
  }
}

function tSwapLanguages() {
  if (!tEls.sourceLang || !tEls.targetLang) return;
  const srcVal = tEls.sourceLang.value;
  const tgtVal = tEls.targetLang.value;
  tEls.sourceLang.value = tgtVal;
  tEls.sourceLang.value = srcVal === 'auto' ? tgtVal : srcVal;

  const currentOutput = (tEls.outputBox && (tEls.outputBox.classList.contains('placeholder') || tEls.outputBox.classList.contains('error')))
    ? ''
    : (tEls.outputBox ? tEls.outputBox.textContent : '');

  if (currentOutput && tEls.sourceText) {
    tEls.sourceText.value = currentOutput;
    tUpdateCharCount();
  }
  tShowDetectedBadge(null);
  tShowOutput('Your translation will appear here.', { isPlaceholder: true });
}

async function tCopyTranslation() {
  if (!tEls.outputBox) return;
  const text = tEls.outputBox.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (tEls.copyBtn) {
      tEls.copyBtn.textContent = 'Copied';
      tEls.copyBtn.classList.add('copied');
      setTimeout(() => {
        tEls.copyBtn.textContent = 'Copy';
        tEls.copyBtn.classList.remove('copied');
      }, 1500);
    }
  } catch (e) {
    console.error('Copy failed', e);
  }
}

tEls.sourceText.addEventListener('input', tUpdateCharCount);
tEls.translateBtn.addEventListener('click', tTranslate);
tEls.swapBtn.addEventListener('click', tSwapLanguages);
tEls.copyBtn.addEventListener('click', tCopyTranslation);
tEls.sourceText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      tTranslate();
    }
    });

tPopulateLangSelects();
tUpdateCharCount();
tShowOutput('Your translation will appear here.', { isPlaceholder: true });