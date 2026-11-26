const calendar = require('../api/resources-calendar.json');
const DAY = 86400000;
const mod = (value, length) => ((value % length) + length) % length;
function scheduledContent(config, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: calendar.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / DAY);
  const anchor = Math.floor(Date.parse(calendar.anchorDate + 'T00:00:00Z') / DAY);
  const elapsed = day - anchor;
  const week = Math.floor(elapsed / 7);
  const memoryPeriod = Math.floor(elapsed / 2);
  const daily = calendar.themes[mod(elapsed, calendar.themes.length)];
  const weekly = calendar.themes[mod(week, calendar.themes.length)];
  const memory = calendar.themes[mod(memoryPeriod, calendar.themes.length)];
  const generated = {
    dailyPrayer: { title: 'Oración del día: ' + daily.theme, text: daily.prayer },
    dailyVerse: { reference: daily.memoryReference, note: daily.question },
    memoryVerse: { reference: memory.memoryReference, note: 'Practica este pasaje durante dos días: léelo, repítelo, intenta recordarlo y comprueba las palabras con la NVI.' },
    weeklyDevotional: { title: 'Devocional del día: ' + daily.theme, reference: daily.reference, text: daily.devotional.replace('Lectura de la semana:', 'Lectura del día:') },
    weeklySermons: { title: 'Sermón de la semana: ' + weekly.theme, reference: weekly.reference, text: weekly.sermon },
    studies: { title: 'Estudio bíblico: ' + weekly.theme, reference: weekly.reference, text: weekly.study }
  };
  const result = { ...config };
  for (const [key, entry] of Object.entries(generated)) {
    if (config[key]?.automatic === false) continue;
    const period = key === 'memoryVerse' ? memoryPeriod : (key.startsWith('daily') || key === 'weeklyDevotional') ? elapsed : week;
    result[key] = { enabled: config[key]?.enabled !== false, automatic: true, ...entry,
      periodId: key + ':' + period };
  }
  result.resourcesSchedule = { timeZone: calendar.timeZone, date,
    daily: 'daily', devotional: 'daily', memoryVerse: 'every-2-days', weekly: 'monday',
    periodId: date + ':' + memoryPeriod + ':' + week };
  return result;
}
module.exports = { scheduledContent };
