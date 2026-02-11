const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/zno/starodavnya_istoriya_ukrayini_73.json','utf8'));
const header = [
  `Предмет: ${data.meta.subject}`,
  `Розділ: ${data.meta.section}`,
  `Тема: ${data.meta.topic}`,
  `Кількість завдань: ${data.meta.count}`,
  ''
].join('\n');
let body='';
for (const t of data.items) {
  body += `${t.number}. ${t.question}\n`;
  for (const a of t.answers) {
    if (a.letter) body += `${a.letter}. ${a.text}\n`;
  }
  body += '\n';
}
fs.writeFileSync('data/zno/starodavnya_istoriya_ukrayini_73_questions_only.txt', header + body, 'utf8');
console.log('written');
