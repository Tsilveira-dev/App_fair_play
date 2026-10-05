/* Fair Play — protótipo acadêmico (HTML + CSS + JavaScript puro).
   Dados simulados, salvos no localStorage. Única API externa: Genderize.io (saudação pelo nome). */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEY = 'fairplay-v3', C = 2 * Math.PI * 54;
const DAYS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const today = () => (new Date().getDay() + 6) % 7;                 // 0 = segunda ... 6 = domingo
const monday = () => { const d = new Date(); d.setDate(d.getDate() - today()); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/* ---------- Dados ---------- */
const QUESTIONS = [
  { q:'Quanto tempo você costuma jogar por dia?', o:['Menos de 1 hora','1 a 3 horas','3 a 5 horas','Mais de 5 horas'] },
  { q:'Você consegue parar de jogar quando precisa?', o:['Sim','Às vezes','Tenho dificuldade'] },
  { q:'Você costuma deixar de fazer outras atividades para jogar?', o:['Nunca','Às vezes','Frequentemente'] }
];
const RESULTS = {
  baixo:{ n:1, label:'Baixo', emoji:'🟢', color:'#22C55E', title:'Bom equilíbrio nos seus hábitos',
    text:'Suas respostas mostram uma boa relação entre jogos e outras atividades. Continue observando sua rotina para manter esse equilíbrio.',
    rec:'Mantenha o que já funciona: combine horários de jogo com estudos, descanso e tempo com a família.', tip:null },
  mod:{ n:2, label:'Moderado', emoji:'🟡', color:'#FACC15', title:'Atenção aos seus hábitos',
    text:'Algumas das suas respostas indicam que pode ser interessante observar melhor seu tempo de jogo e buscar um equilíbrio maior com outras atividades.',
    rec:'Experimente estabelecer um período para estudar ou realizar outra atividade antes de começar a jogar.',
    tip:'Combine com sua família um horário fixo para jogar e outro para estudar. Ter horários definidos ajuda a respeitar os limites.' },
  alto:{ n:3, label:'Alto', emoji:'🟠', color:'#F97316', title:'Hora de ajustar a rotina',
    text:'Suas respostas sugerem que os jogos podem estar ocupando bastante espaço no seu dia. Pequenos passos podem ajudar a reorganizar a rotina.',
    rec:'Converse com alguém de confiança e combine pausas entre as partidas, começando por uma atividade fora das telas.',
    tip:'Prefira partidas curtas. Ao terminar cada uma, levante, beba água e faça uma pausa antes de começar outra.' }
};
const ACT = { study:' Estudar ', sport:' Fazer atividade física ', draw:' Desenhar ', read:' Ler ', family:' Fazer algo com a família ', rest:' Descansar ' };
const CH = {   // desafio escolhido pelo nível do check-in
  baixo:{ tag:'Missão de manutenção', title:'20 minutos de pausa ativa', min:20, pts:30,
    text:'Seu equilíbrio está bom! Para mantê-lo, depois de uma sessão de jogo faça uma pausa de 20 minutos com uma atividade fora das telas.', list:['sport','read','draw','family','rest'] },
  mod:{ tag:'Missão de organização da rotina', title:'30 minutos antes do jogo', min:30, pts:50,
    text:'Antes de iniciar sua próxima sessão de jogo, escolha uma atividade fora das telas durante 30 minutos e organize o horário do seu dia.', list:['study','sport','draw','read','family'] },
  alto:{ tag:'Missão Offline', title:'45 minutos sem telas', min:45, pts:70,
    text:'Reduza o tempo de tela hoje: fique 45 minutos sem telas antes de jogar de novo. Comece por algo de que você goste.', list:['study','sport','draw','read','family'] }
};

/* ---------- Estado salvo (localStorage) ---------- */
const SEED = [{a:1,c:1},{a:1,c:1},{a:1,c:0},{a:2,c:2},{a:1,c:1},{a:1,c:1},{a:1,c:1}];   // histórico simulado
const fresh = () => ({ name:'', ans:[null,null,null], level:null, pts:250, done:5, acc:5, streak:3, accepted:false, chLevel:null, rem:null,
  days:SEED.map((d, i) => i < today() ? { ...d } : { a:0, c:0 }), weekKey:monday() });
let S;
try { S = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { S = fresh(); }
if (S.weekKey !== monday()) { S.days = DAYS.map(() => ({ a:0, c:0 })); S.weekKey = monday(); }   // nova semana
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
let iv = null, running = false;
const level = () => S.accepted ? S.chLevel : (S.level || 'mod');
/* Percentual do dia: aceitou = 30%; concluiu = 70%; cada desafio extra concluído = +15% (máx. 100%) */
const pct = d => d.c > 0 ? Math.min(100, 70 + (d.c - 1) * 15) : d.a > 0 ? 30 : 0;

/* ---------- Navegação ---------- */
function go(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  const el = $('#' + id);
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === (id === 'result' ? 'checkin' : id)));
  if (id === 'checkin') renderQuiz();
  if (id === 'result') showResult();
  if (id === 'challenge') renderChallenge();
  if (id === 'progress') renderProgress();
  window.scrollTo({ top:0, behavior:'smooth' });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

/* SAUDACAO PELA API (Genderize.io) OU PLANO B (sem internet) */
const MASC_EM_A = ['luca', 'joshua', 'noah', 'jonata', 'mica', 'costa', 'barnabe'];
const FEM_SEM_A = ['ester', 'isabel', 'raquel', 'rachel', 'beatriz', 'iris', 'ingrid', 'carmem', 'miriam', 'alice', 'aline', 'nicole',
                   'michele', 'daniele', 'rute', 'abigail', 'ruth', 'lis', 'jaqueline'];
function ehFeminino(nome) {                                          // plano B (sem internet)
  const n = nome.trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (MASC_EM_A.includes(n)) return false;
  if (FEM_SEM_A.includes(n)) return true;
  return n.endsWith('a') || /(line|ane|ice|elle|ette)$/.test(n);
}
async function generoPelaAPI(nome) {                                 // true = feminino, false = masculino, null = sem resposta
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`https://api.genderize.io?name=${encodeURIComponent(nome.trim().split(/\s+/)[0])}&country_id=BR`, { signal:ctrl.signal });
    if (!r.ok) throw new Error('API indisponível');
    const d = await r.json();                                        // ex.: { gender:"female", probability:0.98 }
    if (d.gender && d.probability >= 0.6) return d.gender === 'female';
  } catch (e) { /* sem internet ou limite diário: usa o plano B */ }
  finally { clearTimeout(timer); }
  return null;
}
async function saudacao(nome) {
  let feminino = await generoPelaAPI(nome);
  if (feminino === null) feminino = ehFeminino(nome);
  if (feminino) {
    return 'Seja Bem-vinda';
  } else {
    return 'Seja Bem-vindo';
  }
}

/* ---------- Abertura ---------- */
// 1) transição rápida com o nome da startup
[...'Fair Play'].forEach((ch, i) => {
  const l = document.createElement('span');
  l.className = 'brand-letter'; l.style.animationDelay = (0.2 + i * 0.09) + 's';
  l.innerHTML = ch === ' ' ? '&nbsp;' : ch;
  $('#brandWord').appendChild(l);
});
setTimeout(() => $('#brandStep').classList.add('out'), 2500);
setTimeout(() => {                                                   // 2) pergunta o nome
  $('#brandStep').classList.add('hidden');
  $('#nameStep').classList.remove('hidden'); $('#nameStep').classList.add('fade-in');
}, 2900);

$('#nameInput').value = S.name;
$('#nameStep').addEventListener('submit', async e => {               // 3) boas-vindas com o nome
  e.preventDefault();
  const name = $('#nameInput').value.trim();
  if (!name) { $('#nameErr').textContent = 'Digite seu nome para continuar.'; return; }
  S.name = name; save();
  const btn = $('#nameStep button'); btn.disabled = true; btn.textContent = 'ENTRANDO...';
  $('#hello').textContent = await saudacao(name);
  $('#whoName').textContent = name; $('#sideName').textContent = name;
  $('#greet').textContent = `Olá, ${name}`;
  $('#nameStep').classList.add('hidden'); $('#welcomeStep').classList.remove('hidden');
  setTimeout(() => $('#intro').classList.add('leave'), 3400);
  setTimeout(() => { $('#intro').classList.add('hidden'); $('#app').classList.remove('hidden'); go('home'); }, 4100);
});

/* ---------- Check-in ---------- */
function renderQuiz() {
  $('#quizErr').textContent = '';
  $('#quiz').innerHTML = QUESTIONS.map((q, i) => `<div class="q" data-q="${i}">
    <h2 class="qt font-display font-bold text-lg mb-3">${i + 1}. ${q.q}</h2>
    <div class="space-y-2">${q.o.map((t, j) => `<button class="opt${S.ans[i] === j ? ' sel' : ''}" data-q="${i}" data-v="${j}">${t}</button>`).join('')}</div></div>`).join('');
}
$('#quiz').addEventListener('click', e => {
  const b = e.target.closest('.opt'); if (!b) return;
  const i = +b.dataset.q;
  S.ans[i] = +b.dataset.v; save();
  $$(`.opt[data-q="${i}"]`).forEach(o => o.classList.toggle('sel', o === b));
  $(`.q[data-q="${i}"]`).classList.remove('missing');
  $('#quizErr').textContent = '';
});
$('#seeResult').addEventListener('click', () => {
  const miss = S.ans.map((a, i) => a === null ? i : -1).filter(i => i > -1);
  if (miss.length) {
    miss.forEach(i => $(`.q[data-q="${i}"]`).classList.add('missing'));
    $('#quizErr').textContent = 'Responda todas as perguntas para ver seu resultado.';
    $(`.q[data-q="${miss[0]}"]`).scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  go('result');
});

/* ---------- Resultado (recalculado a cada visita) ---------- */
function showResult() {
  if (S.ans.includes(null)) { go('checkin'); return; }
  const score = S.ans.reduce((a, b) => a + b, 0);                    // 0 a 7
  S.level = score <= 2 ? 'baixo' : score <= 4 ? 'mod' : 'alto'; save();
  const r = RESULTS[S.level];
  $('#resEmoji').textContent = r.emoji; $('#resTitle').textContent = r.title; $('#resText').textContent = r.text; $('#resRec').textContent = r.rec;
  $('#resTipCard').classList.toggle('hidden', !r.tip); $('#resTip').textContent = r.tip || '';
  $('#lvlLabel').textContent = r.label;
  $('#lvlLabel').style.color = r.color === '#FACC15' ? '#a16207' : r.color;
  const segs = $$('#gauge .seg');
  segs.forEach(s => s.style.background = '');
  setTimeout(() => segs.forEach((s, i) => { if (i < r.n) s.style.background = r.color; }), 150);
}

/* ---------- Desafio + cronômetro ---------- */
function renderChallenge() {
  const c = CH[level()];
  $('#chTag').textContent = c.tag; $('#chTitle').textContent = c.title; $('#chText').textContent = c.text;
  $('#chPts').textContent = `+${c.pts} pontos `;
  $('#chList').innerHTML = c.list.map(k => `<li class="chip">${ACT[k]}</li>`).join('');
  $('#chNote').classList.toggle('hidden', !!S.level || S.accepted);
  const b = $('#accept');
  b.textContent = S.accepted ? '✓ DESAFIO ACEITO' : 'ACEITAR DESAFIO';
  b.classList.toggle('done', S.accepted); b.disabled = S.accepted;   // não aceita o mesmo desafio várias vezes
  $('#acceptMsg').classList.toggle('hidden', !S.accepted);
  $('#timerBox').classList.toggle('hidden', !S.accepted);
  if (S.accepted) draw();
}
function draw() {
  const total = CH[S.chLevel || level()].min * 60, rem = S.rem ?? total;
  $('#clock').textContent = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`;
  $('#ring').style.strokeDasharray = C;
  $('#ring').style.strokeDashoffset = C * (1 - rem / total);
}
function startTimer() {
  clearInterval(iv); running = true; $('#pause').textContent = 'PAUSAR';
  iv = setInterval(() => { S.rem--; save(); draw(); if (S.rem <= 0) complete(); }, 1000);
}
function pauseTimer() { clearInterval(iv); running = false; $('#pause').textContent = 'RETOMAR'; }
$('#accept').addEventListener('click', () => {
  if (S.accepted) return;
  const lv = level();
  S.accepted = true; S.chLevel = lv; S.rem = CH[lv].min * 60;
  S.acc++; S.days[today()].a++; save();                              // entra no progresso (dia = 30%)
  renderChallenge(); startTimer();
});
$('#pause').addEventListener('click', () => running ? pauseTimer() : startTimer());
$('#finish').addEventListener('click', complete);
function complete() {
  if (!S.accepted) return;
  clearInterval(iv); running = false;
  const c = CH[S.chLevel], d = S.days[today()];
  if (d.c === 0) S.streak++;                                         // primeiro desafio concluído do dia
  d.c++; S.pts += c.pts; S.done++; S.accepted = false; S.rem = null; save();
  renderChallenge();
  toast((S.done - 5) % 3 === 0 ? ` Desafio concluído! +${c.pts} pontos e nova medalha!` : ` Desafio concluído! +${c.pts} pontos`);
  setTimeout(() => go('progress'), 1600);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.style.opacity = 1;
  setTimeout(() => t.style.opacity = 0, 2400);
}

/* ---------- Progresso ---------- */
function renderProgress() {
  const t = today();
  $('#stPts').textContent = S.pts; $('#stAcc').textContent = S.acc; $('#stDone').textContent = S.done; $('#stStreak').textContent = S.streak;
  $('#week').innerHTML = DAYS.map((n, i) => {
    const p = pct(S.days[i]);
    return `<div class="flex items-center gap-3 rounded-xl px-2 py-1 ${i === t ? 'bg-brand/5' : ''} ${i > t ? 'opacity-50' : ''}">
      <span class="w-20 text-sm ${i === t ? 'font-extrabold text-brand' : 'font-semibold'}">${n}</span>
      <div class="bar flex-1"><div class="fill bg-go" data-w="${p}"></div></div>
      <span class="w-10 text-right text-sm font-bold">${p}%</span></div>`;
  }).join('');
  const vals = S.days.slice(0, t + 1).map(pct);
  $('#weekPct').textContent = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) + '%';
  const need = 3 - ((S.done - 5) % 3);
  $('#nextText').textContent = `Complete mais ${need} ${need === 1 ? 'desafio' : 'desafios'} para desbloquear uma nova medalha.`;
  $('#nextBar').style.width = '0';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('#week .fill').forEach(f => f.style.width = f.dataset.w + '%');
    $('#nextBar').style.width = ((3 - need) / 3 * 100) + '%';
  }));
}
if (S.accepted) $('#pause').textContent = 'RETOMAR';                // timer salvo volta pausado