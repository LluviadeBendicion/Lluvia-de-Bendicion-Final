const CONFIG=window.LLDB_CONFIG||{};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const intro=$("#intro"); function closeIntro(){intro.classList.add("hide");document.body.classList.remove("intro-lock")}
setTimeout(closeIntro,5200); $("#skipIntro").onclick=closeIntro;

const menu=$("#menuButton"), nav=$("#mainNav");
menu.onclick=()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",open)};
$$("nav a").forEach(a=>a.onclick=()=>nav.classList.remove("open"));

const audio=$("#radioAudio"), play=$("#playButton"), msg=$("#playerMessage");
audio.src=CONFIG.radioStreamUrl||"";
$("#volume").oninput=e=>audio.volume=e.target.value;
play.onclick=async()=>{if(!audio.src||audio.src===location.href){msg.textContent="Añade la URL HTTPS de ZaraRadio o de tu proveedor en config.js.";return}
try{if(audio.paused){await audio.play();play.textContent="❚❚";msg.textContent="Estás escuchando Lluvia de Bendición .Com."}else{audio.pause();play.textContent="▶";msg.textContent="Transmisión en pausa."}}catch(e){msg.textContent="No fue posible iniciar la transmisión. Verifica la URL HTTPS del stream."}};
audio.onplaying=()=>setRadioState(CONFIG.isLive?"live":"program");
audio.onerror=()=>setRadioState("off");
function setRadioState(state){const light=$("#statusLight"),label=$("#radioStatus");light.className="led "+(state==="live"?"green":state==="program"?"yellow":"off");label.textContent=state==="live"?"EN VIVO":state==="program"?"PROGRAMACIÓN":"FUERA DEL AIRE";$("#nextLabel").textContent=state==="live"?"TRANSMISIÓN":"LO QUE VIENE";if(state==="live")$("#nextPlaying").textContent="En vivo";}
$("#nowPlaying").textContent=CONFIG.nowPlaying||"Programación de Lluvia de Bendición";
$("#nextPlaying").textContent=CONFIG.nextPlaying||"Mensaje de esperanza";

const content={
verse:{title:"Versículo del día",body:"“Este es el día que hizo el Señor; nos gozaremos y alegraremos en él.”",ref:"Salmo 118:24"},
prayer:{title:"Oración del día",body:"Señor, gracias por este nuevo día. Dirige mis pasos, fortalece mi fe y úsame para bendecir a quienes encuentre. Guarda a mi familia y permite que tu paz gobierne mi corazón. Amén.",ref:""},
memory:{title:"Versículo para memorizar",body:"“Confía en el Señor con todo tu corazón, y no te apoyes en tu propia prudencia.”",ref:"Proverbios 3:5"},
devotional:{title:"Devocional de la semana",body:"Dios también trabaja en los procesos que todavía no comprendemos. Esta semana, en lugar de medir su fidelidad por la rapidez de la respuesta, decide caminar en obediencia, oración y confianza. Medita en este mensaje durante toda la semana y toma cada día un paso de fe.",ref:"Santiago 1:2–4"}
};
function showContent(key){const c=content[key];$("#dailyContent").innerHTML=`<h3>${c.title}</h3><p>${c.body}</p>${c.ref?`<b>${c.ref}</b>`:""}`;$$(".content-tab").forEach(b=>b.classList.toggle("active",b.dataset.panel===key))}
$$(".content-tab").forEach(b=>b.onclick=()=>showContent(b.dataset.panel)); showContent("verse");

const sermons={sermon1:["Fe en medio de la prueba","La fe no niega la dificultad; aprende a confiar mientras Dios forma paciencia, carácter y esperanza en nosotros."],sermon2:["La dirección de Dios","Dios dirige mediante su Palabra, la oración, la sabiduría y una obediencia que no depende solamente de emociones."],sermon3:["Una vida que produce fruto","El fruto espiritual se reconoce en el amor, el dominio propio, la paciencia y una vida que refleja el carácter de Cristo."]};
$$("[data-open]").forEach(b=>b.onclick=()=>{const s=sermons[b.dataset.open];const v=$("#sermonViewer");v.innerHTML=`<h3>${s[0]}</h3><p>${s[1]}</p><button class="secondary" onclick="document.querySelector('#sermonViewer').classList.add('hidden')">Cerrar</button>`;v.classList.remove("hidden");v.scrollIntoView({behavior:"smooth",block:"center"})});

$("#prayerForm").onsubmit=e=>{e.preventDefault();$("#formMessage").textContent="Tu petición quedó preparada. Conecta el endpoint en /api/prayer.js para recibirla.";e.target.reset()};

const testimonies=[["“La radio me acompañó en una noche difícil y me recordó que Dios no me había abandonado.”","— Oyente de la comunidad"],["“El estudio bíblico me ayudó a comprender que la prueba también puede producir crecimiento.”","— Participante del ministerio"],["“Encontré palabras de ánimo justo cuando más las necesitaba.”","— Testimonio recibido"]];
let ti=0;$("#nextTestimonial").onclick=()=>{ti=(ti+1)%testimonies.length;$("#testimonialText").textContent=testimonies[ti][0];$("#testimonialAuthor").textContent=testimonies[ti][1]};

$$("[data-wallpaper]").forEach(b=>b.onclick=()=>{$("#wallpaperLarge").src=b.dataset.wallpaper;$("#downloadWallpaper").href=b.dataset.wallpaper;$("#wallpaperViewer").classList.remove("hidden")});
$("#closeWallpaper").onclick=()=>$("#wallpaperViewer").classList.add("hidden");

$$("[data-donation]").forEach(b=>b.onclick=()=>{const m=b.dataset.donation,c=CONFIG.donations?.[m]||{};let html="";
if(m==="zelle")html="<h3>Donar con Zelle</h3><p>Abre la aplicación de tu banco y utiliza el destinatario configurado de forma privada. No publicamos el correo o teléfono en esta página.</p>";
else if(c.url)html=`<h3>Donar con ${m==="cashapp"?"Cash App":m==="venmo"?"Venmo":"PayPal"}</h3><p>La plataforma de pago mostrará el destinatario antes de confirmar.</p><a class="primary" target="_blank" rel="noopener" href="${c.url}">Continuar de forma segura</a>`;
else html="<h3>Método pendiente</h3><p>Añade el enlace aprobado en config.js antes de publicar.</p>";
$("#donationPanel").innerHTML=html;$("#donationPanel").scrollIntoView({behavior:"smooth",block:"center"})});

$("#videoLink").href=CONFIG.videoChannelUrl||"#";$("#facebookLink").href=CONFIG.facebookUrl||"#";$("#youtubeLink").href=CONFIG.videoChannelUrl||"#";$("#emailLink").href=CONFIG.contactEmail?`mailto:${CONFIG.contactEmail}`:"#";
$("#year").textContent=new Date().getFullYear();

let taps=0,tapTimer;$("#hiddenAdmin").onclick=()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,1800);if(taps>=5){$("#adminDialog").showModal();taps=0}};$("#closeAdmin").onclick=()=>$("#adminDialog").close();

let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installButton").classList.remove("hidden")});$("#installButton").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installButton").classList.add("hidden")};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"));