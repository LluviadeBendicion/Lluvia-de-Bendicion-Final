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
cue(20000,'complete');
