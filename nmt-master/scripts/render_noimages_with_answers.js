const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/zno/starodavnya_istoriya_ukrayini_73.json','utf8'));
const stripUrls = (s) => s.replace(/https?:\/\/\S+/gi, '').replace(/\[image:[^\]]+\]/gi, '').replace(/\s{2,}/g,' ').trim();
const header = [
  `Предмет: ${data.meta.subject}`,
  `Розділ: ${data.meta.section}`,
  `Тема: ${data.meta.topic}`,
  `Кількість завдань: ${data.meta.count}`,
  ''
].join('\n');
let body='';
for (const t of data.items) {
  const q = stripUrls(t.question || '');
  body += `${t.number}. ${q}\n`;
  const answers = Array.isArray(t.answers) ? t.answers : [];
  for (const a of answers) {
    const letter = (a.letter || '').trim();
    const text = stripUrls(a.text || '');
    if (letter) {
      body += `${letter}. ${text}`.trimEnd() + '\n';
    }
  }
  body += '\n';
}
let answerKey = 'ВІДПОВІДІ\n';
for (const t of data.items) {
  const c = (t.correct || '').replace(/\s+/g,'');
  if (c) answerKey += `${t.number}.${c}\n`;
}
fs.writeFileSync('data/zno/starodavnya_istoriya_ukrayini_73_questions_noimages.txt', header + body + answerKey, 'utf8');
console.log('written');
