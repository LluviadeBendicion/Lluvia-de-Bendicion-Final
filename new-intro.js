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
