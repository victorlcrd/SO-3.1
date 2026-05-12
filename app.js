const PAGE_SIZE = 1024;
const VIRTUAL_PAGES = 4;
const RAM_FRAMES = [...Array(16).keys()];
const DATA_FRAMES = RAM_FRAMES.filter(f => f >= 2);
const SWAP_FRAMES = [...Array(8).keys()].map(i => i + 16);

const initialPTBR = { P1: 0x0000, P2: 0x0100, P3: 0x0200 };
const varsByPage = ['A', 'B', 'C', 'D'];

const state = {
  active: 'P1',
  tables: {
    P1: Array.from({ length: 4 }, (_, p) => ({ page: p, state: 'INV', loc: null })),
    P2: Array.from({ length: 4 }, (_, p) => ({ page: p, state: 'INV', loc: null })),
    P3: Array.from({ length: 4 }, (_, p) => ({ page: p, state: 'INV', loc: null })),
  },
  ram: Object.fromEntries(RAM_FRAMES.map(f => [f, { kind: f === 0 ? 'pt' : f === 1 ? 'kernel' : 'free', owner: null, page: null }])),
  swap: Object.fromEntries(SWAP_FRAMES.map(f => [f, null]))
};

const el = id => document.getElementById(id);

function ownerClass(owner, kind) {
  if (kind === 'pt' || kind === 'kernel') return 'sysbg';
  if (kind === 'free') return 'freebg';
  return owner === 'P1' ? 'p1bg' : owner === 'P2' ? 'p2bg' : 'p3bg';
}

function render() {
  el('processSelect').innerHTML = ['P1', 'P2', 'P3'].map(p => `<option ${p===state.active?'selected':''}>${p}</option>`).join('');
  el('tcbInfo').innerHTML = `PTBR offset: <b>0x${initialPTBR[state.active].toString(16).padStart(4,'0')}</b>`;
  el('vars').innerHTML = varsByPage.map((v,p) => `<button data-page="${p}">${v} (pág ${p})</button>`).join('');
  el('frames').innerHTML = RAM_FRAMES.map(f => {
    const r = state.ram[f];
    const label = r.kind === 'alloc' ? `${r.owner}-p${r.page}` : r.kind;
    return `<div class="frame ${ownerClass(r.owner, r.kind)}" id="frame-${f}"><b>Q${f}</b> [0x${(f*PAGE_SIZE).toString(16).padStart(4,'0')}..0x${((f+1)*PAGE_SIZE-1).toString(16).padStart(4,'0')}]<br/>${label}</div>`;
  }).join('');
  el('swap').innerHTML = SWAP_FRAMES.map(f => {
    const s = state.swap[f];
    return `<div class="frame"><b>S${f}</b><br/>${s ? `${s.owner}-p${s.page}` : 'livre'}</div>`;
  }).join('');
}

function log(msg) { el('eventLog').insertAdjacentHTML('afterbegin', `<p>${new Date().toLocaleTimeString()} - ${msg}</p>`); }
function steps(items){ el('mmuSteps').innerHTML = items.map(i=>`<li>${i}</li>`).join(''); }
function flash(frame){ const node = el(`frame-${frame}`); if(node){ node.classList.add('flash'); setTimeout(()=>node.classList.remove('flash'),800);} }

function freeDataFrames(){ return DATA_FRAMES.filter(f => state.ram[f].kind === 'free'); }
function allocateSwap(owner,page){ const sf = SWAP_FRAMES.find(f => !state.swap[f]); if(sf==null) return null; state.swap[sf]={owner,page}; return sf; }

async function handleAccess(page, offset=0){
  const p = state.active;
  const entry = state.tables[p][page];
  const logical = page * PAGE_SIZE + offset;
  steps([`Endereço lógico ${logical} => página ${page}, deslocamento ${offset}`, `Consulta PT em ${p}`, `Estado da página: ${entry.state}`]);

  if(entry.state === 'RAM'){
    const phys = entry.loc * PAGE_SIZE + offset;
    steps([...el('mmuSteps').querySelectorAll('li')].map(li=>li.textContent).concat([`Quadro ${entry.loc}`, `Endereço físico = ${entry.loc}*1024+${offset} = ${phys}`]));
    flash(entry.loc); log(`Tradução normal (${p}, pág ${page}) -> quadro ${entry.loc}.`); return;
  }

  const free = freeDataFrames();
  const choices = free.length ? free : DATA_FRAMES;
  const title = entry.state === 'INV' ? 'Page Fault - página inválida' : 'Page Fault - página em swap';
  const msg = free.length ? 'Escolha um quadro livre:' : 'Sem quadro livre. Escolha a vítima para substituir:';
  const chosen = await chooseFrame(title,msg,choices);
  if(chosen == null) { log('Operação cancelada.'); return; }
  if(chosen === 1) { log('Violação de proteção: frame 1 (kernel).'); return; }

  const victim = state.ram[chosen];
  if(victim.kind === 'alloc'){
    const s = allocateSwap(victim.owner, victim.page);
    if(s == null){ log('Erro: swap lotada.'); return; }
    const vEntry = state.tables[victim.owner][victim.page];
    vEntry.state = 'SWAP'; vEntry.loc = s;
    log(`Substituição: ${victim.owner}-p${victim.page} -> swap S${s}.`);
  }

  if(entry.state === 'SWAP') state.swap[entry.loc] = null;
  state.ram[chosen] = { kind:'alloc', owner:p, page };
  entry.state = 'RAM'; entry.loc = chosen;
  flash(chosen);
  log(`${title}: ${p}-p${page} carregada no quadro ${chosen}.`);
  render();
}

function chooseFrame(title,msg,options){
  return new Promise(resolve => {
    el('faultTitle').textContent = title;
    el('faultMessage').textContent = msg;
    el('frameChoice').innerHTML = options.map(f=>`<option value="${f}">${f}</option>`).join('');
    const d = el('faultDialog');
    d.showModal();
    const btn = el('confirmFault');
    const close = () => { d.close(); btn.removeEventListener('click', onOk); d.removeEventListener('close', onClose); };
    const onOk = (e) => { e.preventDefault(); const v = Number(el('frameChoice').value); close(); resolve(v); };
    const onClose = () => { resolve(null); };
    btn.addEventListener('click', onOk, { once:true });
    d.addEventListener('close', onClose, { once:true });
  });
}

document.addEventListener('click', (e)=>{
  if(e.target.matches('#vars button')) handleAccess(Number(e.target.dataset.page), 0);
});
el('processSelect').addEventListener('change', e => { state.active = e.target.value; render(); log(`Processo ativo: ${state.active}`); });
el('translateBtn').addEventListener('click', () => {
  const addr = Number(el('logicalAddress').value);
  if(Number.isNaN(addr) || addr < 0 || addr >= 4096){ log('Endereço inválido (0..4095).'); return; }
  handleAccess(Math.floor(addr / PAGE_SIZE), addr % PAGE_SIZE);
});

render();
log('Simulador iniciado.');
