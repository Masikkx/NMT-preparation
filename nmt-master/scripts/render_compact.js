const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/zno/starodavnya_istoriya_ukrayini_73.json','utf8'));
const strip = (s) => s
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/\[image:[^\]]+\]/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

let out = '';
for (const t of data.items) {
  out += `Завдання ${t.number} з ${data.meta.count}\n\n`;
  out += `${strip(t.question || '')}\n\n`;
  for (const a of t.answers || []) {
    const letter = (a.letter || '').trim();
    const text = strip(a.text || '');
    if (letter) out += `${letter}${text}`; // no dot, matches example
  }
  out += '\n\n';
}
// append answers list
out += 'ВІДПОВІДІ\n';
for (const t of data.items) {
  const c = (t.correct || '').replace(/\s+/g, '');
  if (c) out += `${t.number}.${c}\n`;
}
fs.writeFileSync('data/zno/starodavnya_istoriya_ukrayini_73_compact.txt', out, 'utf8');
console.log('written');
