const fs = require('fs');

(async () => {
  const url = 'https://zno.osvita.ua/ukraine-history/tag-starodavnya_istoriya_ukrayini/';
  const res = await fetch(url);
  const html = await res.text();

  const marker = '<div class="task-card';
  const starts = [];
  for (let i = 0; i < html.length;) {
    const idx = html.indexOf(marker, i);
    if (idx === -1) break;
    starts.push(idx);
    i = idx + marker.length;
  }
  const blocks = starts.map((start, i) => html.slice(start, i + 1 < starts.length ? starts[i + 1] : html.length));

  const decode = (s) => {
    if (!s) return '';
    return s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&laquo;/g, '«')
      .replace(/&raquo;/g, '»')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&hellip;/g, '…')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  };

  const stripTags = (s) =>
    decode(
      s
        .replace(/<\/?p[^>]*>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
    )
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const tasks = [];
  for (const block of blocks) {
    const counterMatch = block.match(/<div class=\"counter\">\s*Завдання\s+(\d+)\s+з\s+73\s*<\/div>/);
    if (!counterMatch) continue;
    const number = Number(counterMatch[1]);

    const qMatch = block.match(/<div class=\"question\">([\s\S]*?)<\/div>/);
    if (!qMatch) continue;
    let qHtml = qMatch[1];
    qHtml = qHtml.replace(/<img[^>]*src=\"([^\"]+)\"[^>]*>/g, (m, src) => {
      const full = src.startsWith('http') ? src : `https://zno.osvita.ua${src}`;
      return `\n[image: ${full}]\n`;
    });
    const question = stripTags(qHtml);

    const answers = [];
    const answersBlockMatch = block.match(/<div class=\"answers\">([\s\S]*?)<\/div>/);
    if (answersBlockMatch) {
      const answersBlock = answersBlockMatch[1];
      const answerRegex = /<div class=\"answer\">([\s\S]*?)<\/div>/g;
      let m;
      while ((m = answerRegex.exec(answersBlock))) {
        const ansHtml = m[1];
        const markerMatch = ansHtml.match(/<span class=\"marker\">\s*([^<]+)\s*<\/span>/);
        const letter = markerMatch ? stripTags(markerMatch[1]).trim() : '';
        const text = stripTags(ansHtml.replace(/<span class=\"marker\">[\s\S]*?<\/span>/, ''));
        if (letter || text) answers.push({ letter, text });
      }
    }

    let correct = '';
    const correctMatch = block.match(/Правильна відповідь[^<]*<\/strong>\s*<strong>\s*([^<]+)\s*<\/strong>/i);
    if (correctMatch) {
      correct = stripTags(correctMatch[1]).replace(/\.$/, '').trim();
    } else {
      const textBlock = stripTags(block);
      const cm = textBlock.match(/Правильна відповідь\s*[–-]?\s*([A-ZА-ЯІЇЄҐ0-9,\s]+)/i);
      if (cm) correct = cm[1].trim();
    }

    tasks.push({ number, question, answers, correct });
  }

  const sorted = tasks.sort((a, b) => a.number - b.number);

  const header = [
    'Предмет: ІСТОРІЯ УКРАЇНИ ВІД НАЙДАВНІШИХ ЧАСІВ ДО КІНЦЯ ХІХ ст.',
    'Розділ: Найдавніші часи – перша половина ХVІ ст.',
    'Тема: Стародавня історія України',
    `Кількість завдань: ${sorted.length}`,
    ''
  ].join('\n');

  let body = '';
  for (const t of sorted) {
    body += `${t.number}. ${t.question}\n`;
    for (const a of t.answers) {
      if (a.letter) body += `${a.letter}. ${a.text}\n`;
      else body += `${a.text}\n`;
    }
    body += '\n';
  }

  let answerKey = 'ВІДПОВІДІ\n';
  for (const t of sorted) {
    if (t.correct) answerKey += `${t.number}.${t.correct.replace(/\s+/g, '')}\n`;
  }

  const out = header + body + answerKey;

  fs.mkdirSync('data/zno', { recursive: true });
  fs.writeFileSync('data/zno/starodavnya_istoriya_ukrayini_73.txt', out, 'utf8');
  fs.writeFileSync(
    'data/zno/starodavnya_istoriya_ukrayini_73.json',
    JSON.stringify(
      {
        meta: {
          subject: 'ІСТОРІЯ УКРАЇНИ ВІД НАЙДАВНІШИХ ЧАСІВ ДО КІНЦЯ ХІХ ст.',
          section: 'Найдавніші часи – перша половина ХVІ ст.',
          topic: 'Стародавня історія України',
          count: sorted.length,
          source: url,
        },
        items: sorted,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('tasks', sorted.length, 'file written');
})();
