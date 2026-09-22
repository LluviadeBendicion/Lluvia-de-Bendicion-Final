const intro=document.getElementById('cinematicIntro');
const cue=(ms,name)=>setTimeout(()=>intro?.classList.add(name),ms);
// Storyboard aprobado: progresión completa 0:00–0:20.
cue(900,'clouds');
cue(2600,'storm');
cue(5000,'rain');
cue(8000,'strike');
cue(10200,'impact');
cue(10800,'logo');
cue(13000,'gold');
cue(15400,'stable');
cue(18200,'exit');
setTimeout(()=>{intro?.classList.add('complete');const home=document.getElementById('home');if(home){home.hidden=false;home.setAttribute('aria-hidden','false')}setTimeout(()=>intro?.remove(),1850)},20000);

let adminClicks=[];
document.addEventListener('click',e=>{
 if(e.target?.id!=='adminTrigger') return;
 const now=Date.now(); adminClicks=adminClicks.filter(t=>now-t<1800); adminClicks.push(now);
 if(adminClicks.length>=5){ adminClicks=[]; location.href='/admin/'; }
});

const approvedLabels={inicio:'Inicio',mision:'Misión',vision:'Visión',creencias:'Creencias',radio:'Radio',especial:'Especialmente para ti',media:'Media',recursos:'Recursos',peticiones:'Peticiones de Oración',testimonios:'Testimonios',donaciones:'Donaciones',afiliados:'Afiliados',contacto:'Contacto'};
const radioMarkup=`<div class="radio-room" data-current="radio"><div class="radio-title-row"><h2>Radio</h2><button class="radio-exit" aria-label="Salir de Radio" title="Salir de Radio">×</button></div><div class="radio-layout"><aside class="radio-legend" aria-label="Estados de Radio"><strong>Radio Interactiva</strong><span><i class="led live"></i> En vivo</span><span><i class="led program"></i> Programación / Música</span><span><i class="led off"></i> Fuera del aire</span><small>Para salir, usa la X o toca una bocina.</small></aside><div class="retro-radio"><div class="radio-handle"></div><div class="radio-antenna"></div><div class="radio-body"><button class="speaker speaker-left" aria-label="Salir de Radio"><span>LLDB</span></button><div class="radio-center"><div class="cassette-window"><small>Lo que viene</small><strong id="radioNext">Programación</strong></div><div class="radio-dial"><span class="music-note">♪</span><strong id="radioNow">Lluvia de Bendición .Com</strong><span class="dial-live"><i class="led program"></i></span></div><div class="radio-controls"><button class="tuner" aria-label="Sintonizador">◉</button><button class="side-control" aria-label="Control de radio"></button></div></div><button class="speaker speaker-right" aria-label="Salir de Radio"><span>LLDB</span></button></div><button class="radio-home-link">Lluvia de Bendición</button></div></div></div>`;
function openSection(key){
 const panel=document.getElementById('contentPanel'); if(!panel) return;
 if(key==='inicio'){panel.innerHTML='<div class="content-default"><img src="/assets/58795.png" alt="Lluvia de Bendición .Com"><p>Porque queremos que el Señor llueva en ti.</p></div>';return;}
 if(key==='radio'){panel.innerHTML=radioMarkup;return;}
 panel.innerHTML='<div class="section-loading" data-current="'+key+'"><h2>'+approvedLabels[key]+'</h2><p>Contenido aprobado en preparación.</p></div>';
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-section]'); if(b){openSection(b.dataset.section);return;}
 if(e.target.closest('.radio-shortcut')){openSection('radio');return;}
 if(e.target.closest('.radio-exit,.speaker,.radio-home-link')){openSection('inicio');}
});
