const intro=document.getElementById('cinematicIntro');
const cue=(ms,name)=>setTimeout(()=>intro?.classList.add(name),ms);
// Storyboard aprobado: progresión completa 0:00–0:20.
cue(1200,'clouds');       // oscuridad -> nubes
cue(2800,'storm');        // relámpagos dentro de las nubes
cue(5000,'rain');         // comienza lluvia
cue(8200,'strike');       // rayo dorado desciende atravesando nubes
cue(10800,'logo');        // impacto y logo se ilumina
cue(13000,'gold');        // gotas doradas / notas musicales
cue(15400,'stable');      // logo estable, lluvia dorada, destellos suaves
cue(18200,'exit');        // transición suave
setTimeout(()=>{intro?.classList.add('complete');const home=document.getElementById('home');if(home){home.hidden=false;home.setAttribute('aria-hidden','false')}setTimeout(()=>intro?.remove(),1850)},20000);

let adminClicks=[];
document.addEventListener('click',e=>{
 if(e.target?.id!=='adminTrigger') return;
 const now=Date.now(); adminClicks=adminClicks.filter(t=>now-t<1800); adminClicks.push(now);
 if(adminClicks.length>=5){ adminClicks=[]; location.href='/admin/'; }
});

const approvedLabels={inicio:'Inicio',mision:'Misión',vision:'Visión',creencias:'Creencias',radio:'Radio',especial:'Especialmente para ti',media:'Media',recursos:'Recursos',peticiones:'Peticiones de Oración',testimonios:'Testimonios',donaciones:'Donaciones',afiliados:'Afiliados',contacto:'Contacto'};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-section]'); if(!b) return;
 const key=b.dataset.section, panel=document.getElementById('contentPanel'); if(!panel) return;
 if(key==='inicio'){panel.innerHTML='<div class="content-default"><img src="/assets/58795.png" alt="Lluvia de Bendición .Com"><p>Porque queremos que el Señor llueva en ti.</p></div>';return;}
 panel.innerHTML='<div class="section-loading" data-current="'+key+'"><h2>'+approvedLabels[key]+'</h2><p>Contenido aprobado en preparación.</p></div>';
});
