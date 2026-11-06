const progressKey = 'forge-completed-v2';
const state = {
  content: null,
  completed: new Set(JSON.parse(localStorage.getItem(progressKey) || '[]')),
  accountType: sessionStorage.getItem('forge-account-type') === 'admin' ? 'admin' : 'user',
  activeModuleId: null,
  activeLessonId: null
};
const checkMark = '<span class="tick">âœ“</span>';

async function init() {
  try {
    const response = await fetch('content.json');
    state.content = await response.json();
  } catch {
    state.content = JSON.parse(document.querySelector('#local-course-data').textContent);
  }
  render();
}

function lessonList(module) {
  return (module.sections || []).flatMap(section => section.lessons || []);
}

function allLessons() {
  return state.content.modules.flatMap(module => lessonList(module));
}

function canAccessModule(module) {
  const modules = state.content.modules;
  const index = modules.findIndex(item => item.id === module.id);
  if (index < 0 || lessonList(module).length === 0) return false;
  if (state.accountType === 'admin' || sessionStorage.getItem('forge-account-type') === 'admin') return true;
  if (module.status === 'locked') return false;
  return modules.slice(0, index).every(previous => {
    const lessons = lessonList(previous);
    return lessons.length > 0 && lessons.every(lesson => state.completed.has(lesson.id));
  });
}

function render() {
  const modules = state.content.modules;
  const lessons = allLessons();
  const completedIds = lessons.filter(lesson => state.completed.has(lesson.id)).map(lesson => lesson.id);
  state.completed = new Set(completedIds);
  localStorage.setItem(progressKey, JSON.stringify(completedIds));
  const count = completedIds.length;
  const pct = lessons.length ? Math.round(count / lessons.length * 100) : 0;
  document.querySelector('#progress-percent').textContent = `${pct}%`;
  document.querySelector('#progress-bar').style.width = `${pct}%`;
  document.querySelector('#done-count').textContent = count;
  document.querySelector('#admin-access-note').hidden = state.accountType !== 'admin';
  document.querySelector('.progress-foot').innerHTML = `<span><b>${count}</b> of ${lessons.length} lessons complete</span><span>Next up: <b>${escapeHtml(nextLessonTitle())}</b> <span class="arrow">â†—</span></span>`;

  document.querySelector('#journey').innerHTML = modules.map((module, index) => {
    const moduleLessons = lessonList(module);
    const finished = moduleLessons.length > 0 && moduleLessons.every(lesson => state.completed.has(lesson.id));
    const active = state.activeModuleId === module.id || (!state.activeModuleId && module.status === 'current');
    const accessible = canAccessModule(module);
    return `<a class="journey-item ${active ? 'active' : ''} ${finished ? 'complete' : ''} ${accessible ? '' : 'locked'}" data-module="${escapeHtml(module.id)}"><span class="journey-num">${finished ? checkMark : String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(module.title)}</span></a>`;
  }).join('');

  document.querySelector('#modules').innerHTML = modules.map(module => {
    const moduleLessons = lessonList(module);
    const moduleDone = moduleLessons.filter(lesson => state.completed.has(lesson.id)).length;
    const locked = !canAccessModule(module);
    const current = module.status === 'current' && moduleDone < moduleLessons.length;
    const progress = moduleLessons.length ? Math.round(moduleDone / moduleLessons.length * 100) : 0;
    return `<article class="module-card ${moduleDone === moduleLessons.length && moduleLessons.length ? 'done' : ''} ${locked ? 'locked' : ''} ${current ? 'current' : ''}" id="module-${escapeHtml(module.id)}">
      <div class="module-icon" style="background:${escapeHtml(module.tone)}">${escapeHtml(module.icon)}</div><div class="module-info"><div class="module-top"><h3>${escapeHtml(module.title)}</h3><span class="module-tag">${locked ? (module.status === 'locked' ? 'COMING SOON' : 'COMPLETE PREVIOUS LEVEL') : moduleDone === moduleLessons.length && moduleLessons.length ? 'COMPLETED' : escapeHtml(module.tag)}</span></div><div class="module-desc">${escapeHtml(module.description)}</div><div class="module-meta">${moduleLessons.length ? `${moduleLessons.length} lessons` : 'More content coming'} <span>Â·</span> ${escapeHtml(module.time)}</div></div>
      <div class="module-action"><div class="module-progress"><i style="width:${progress}%"></i></div><span class="module-progress-label">${moduleLessons.length ? `${moduleDone}/${moduleLessons.length}` : ''}</span><button class="module-open" data-action="${locked || !moduleLessons.length ? 'locked' : 'open'}" data-id="${escapeHtml(module.id)}" aria-label="${locked ? 'Locked' : 'Open'} ${escapeHtml(module.title)}">${locked ? 'âŒ‘' : 'â†—'}</button></div>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-action="open"]').forEach(button => button.addEventListener('click', () => openLesson(button.dataset.id)));
  document.querySelectorAll('[data-action="locked"]').forEach(button => button.addEventListener('click', () => toast('This level is on the roadmap.')));
  document.querySelectorAll('.journey-item[data-module]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const module = state.content.modules.find(item => item.id === link.dataset.module);
    if (module && lessonList(module).length && canAccessModule(module)) openLesson(module.id);
    else toast(module?.status === 'locked' ? 'This level is on the roadmap.' : 'Complete the previous level to unlock this one.');
  }));
}

function nextLessonTitle() {
  const next = allLessons().find(lesson => !state.completed.has(lesson.id));
  return next ? next.title : 'All three levels complete!';
}

function openLesson(moduleId, lessonId) {
  const module = state.content.modules.find(item => item.id === moduleId);
  if (!module || !canAccessModule(module)) {
    toast(state.accountType === 'admin' ? 'This level does not have lesson content yet.' : 'Complete the previous level to unlock this one.');
    return;
  }
  const sections = module?.sections || [];
  const lessons = lessonList(module);
  if (!lessons.length) return;
  state.activeModuleId = moduleId;
  state.activeLessonId = lessonId || lessons.find(lesson => !state.completed.has(lesson.id))?.id || lessons[0].id;
  document.querySelector('#lesson-overlay').classList.add('open');
  document.querySelector('#lesson-overlay').setAttribute('aria-hidden', 'false');
  renderLesson(module, sections, lessons);
}

function renderLesson(module, sections, lessons) {
  const lesson = lessons.find(item => item.id === state.activeLessonId) || lessons[0];
  const sectionList = sections.map(section => `<div class="lesson-section-label">${escapeHtml(section.title)}</div>${section.lessons.map(item => `<button class="lesson-nav-item ${item.id === lesson.id ? 'selected' : ''} ${state.completed.has(item.id) ? 'finished' : ''}" data-lesson="${escapeHtml(item.id)}"><span>${state.completed.has(item.id) ? 'âœ“' : 'â—‹'}</span>${escapeHtml(item.title)}</button>`).join('')}`).join('');
  const steps = (lesson.steps || []).map(step => `<li>${linkify(step)}</li>`).join('');
  const isComplete = state.completed.has(lesson.id);
  const currentIndex = lessons.findIndex(item => item.id === lesson.id);
  const next = lessons[currentIndex + 1];
  document.querySelector('#lesson-content').innerHTML = `<div class="lesson-layout"><aside class="lesson-rail"><div class="lesson-kicker">${escapeHtml(module.title)}</div>${sectionList}</aside><article class="lesson-body"><div class="lesson-kicker">LESSON ${String(currentIndex + 1).padStart(2, '0')} OF ${String(lessons.length).padStart(2, '0')}</div><h2>${escapeHtml(lesson.title)}</h2><p class="lesson-intro">${linkify(lesson.intro)}</p><div class="lesson-concept"><b>THE IDEA</b><br>${linkify(lesson.concept)}</div><h3>Do this</h3><ol class="lesson-steps">${steps}</ol><h3>Code to try</h3><div class="code-wrap"><button class="copy-button" id="copy-code">Copy code</button><code>${escapeHtml(lesson.code)}</code></div><h3>Expected result</h3><div class="expected">${linkify(lesson.expected)}</div><p class="lesson-intro"><b>Hint:</b> ${linkify(lesson.hint)}</p><div class="lesson-footer"><span>${escapeHtml(lesson.time)} Â· ${isComplete ? 'Completed' : 'Mark complete when you have tried it.'}</span><button class="complete-button" id="complete-lesson">${isComplete ? 'Completed âœ“' : 'Mark complete'}${next && !isComplete ? ' â†’' : ''}</button></div>${next ? `<button class="next-lesson-button" id="next-lesson">Next lesson: ${escapeHtml(next.title)} â†’</button>` : ''}</article></div>`;
  document.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click', () => {
    state.activeLessonId = button.dataset.lesson;
    renderLesson(module, sections, lessons);
  }));
  document.querySelector('#copy-code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(lesson.code); document.querySelector('#copy-code').textContent = 'Copied!'; }
    catch { toast('Clipboard access is unavailable here. Select and copy the code.'); }
  });
  document.querySelector('#complete-lesson').addEventListener('click', () => {
    state.completed.add(lesson.id);
    localStorage.setItem(progressKey, JSON.stringify([...state.completed]));
    if (next) state.activeLessonId = next.id;
    render();
    renderLesson(module, sections, lessons);
  });
  document.querySelector('#next-lesson')?.addEventListener('click', () => {
    state.activeLessonId = next.id;
    renderLesson(module, sections, lessons);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function linkify(value) {
  return escapeHtml(value).replace(/(https?:\/\/[^\s<>]+|(?:www\.)?[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+(?:\/[^\s<>]*)?)/gi, match => {
    let label = match;
    let suffix = '';
    while (/[.,;:!?)]$/.test(label)) {
      suffix = label.slice(-1) + suffix;
      label = label.slice(0, -1);
    }
    const href = /^https?:\/\//i.test(label) ? label : `https://${label}`;
    return `<a class="lesson-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>${suffix}`;
  });
}
function closeLesson() {
  document.querySelector('#lesson-overlay').classList.remove('open');
  document.querySelector('#lesson-overlay').setAttribute('aria-hidden', 'true');
  state.activeModuleId = null;
  render();
}
function toast(message) {
  const item = document.createElement('div');
  item.textContent = message;
  Object.assign(item.style, {position:'fixed',bottom:'22px',left:'50%',transform:'translateX(-50%)',padding:'11px 15px',background:'#213a2d',color:'#fff',borderRadius:'8px',zIndex:10,fontSize:'11px',boxShadow:'0 5px 20px #17292130'});
  document.body.append(item);
  setTimeout(() => item.remove(), 2300);
}

document.querySelector('#close-modal').addEventListener('click', closeLesson);
document.querySelector('#lesson-overlay').addEventListener('click', event => { if (event.target.id === 'lesson-overlay') closeLesson(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLesson(); });
const loginScreen = document.querySelector('#login-screen');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');

function enterPortal(username) {
  const isAdmin = username.toLowerCase() === 'admin';
  state.accountType = isAdmin ? 'admin' : 'user';
  sessionStorage.setItem('forge-account-type', state.accountType);
  document.body.classList.add('authenticated');
  loginScreen.hidden = true;
  document.querySelector('#profile-name').textContent = isAdmin ? 'Admin' : 'Learner';
  document.querySelector('#profile-avatar').textContent = isAdmin ? 'A' : 'U';
  document.querySelector('#profile-role').textContent = isAdmin ? 'Administrator' : 'Learner account';
  if (state.content) render();
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const username = document.querySelector('#login-username').value.trim().toLowerCase();
  const password = document.querySelector('#login-password').value;
  if ((username === 'admin' || username === 'user') && password === '12345') {
    loginError.textContent = '';
    enterPortal(username);
    return;
  }
  loginError.textContent = 'That username and password do not match the demo accounts.';
});

document.querySelector('#signout-button').addEventListener('click', () => {
  state.accountType = 'user';
  sessionStorage.removeItem('forge-account-type');
  document.body.classList.remove('authenticated');
  loginScreen.hidden = false;
  loginForm.reset();
  loginError.textContent = '';
  render();
  document.querySelector('#login-username').focus();
});

const rememberedRole = sessionStorage.getItem('forge-account-type');
if (rememberedRole === 'admin' || rememberedRole === 'user') enterPortal(rememberedRole);

init().catch(error => {
  document.querySelector('#modules').innerHTML = '<p>Could not load course content. Open this page through a local web server or GitHub Pages.</p>';
  console.error(error);
});

