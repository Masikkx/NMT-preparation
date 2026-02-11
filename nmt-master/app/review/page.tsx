'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

type StudyItem = {
  id: string;
  subject: string;
  topic: string;
  studiedDate: string; // YYYY-MM-DD
  createdAt: string;
};

type ReviewEvent = {
  itemId: string;
  subject: string;
  topic: string;
  reviewDate: string; // YYYY-MM-DD
  intervalDays: number;
};

const STORAGE_KEY = 'nmt-review-plan-v1';
const REVIEW_INTERVALS = [1, 3, 7, 14, 28] as const;

const SUBJECTS = [
  'Українська мова',
  'Математика',
  'Історія України',
  'Англійська мова',
  'Біологія',
  'Хімія',
  'Фізика',
  'Географія',
];

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYmdLocal = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const addDaysYmd = (value: string, days: number): string => {
  const date = parseYmdLocal(value);
  date.setDate(date.getDate() + days);
  return toYmd(date);
};

const getIntervalLabel = (days: number, lang: 'uk' | 'en') => {
  if (lang === 'uk') {
    if (days === 1) return 'Повтор через 1 день';
    return `Повтор через ${days} днів`;
  }
  if (days === 1) return 'Review after 1 day';
  return `Review after ${days} days`;
};

export default function ReviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { lang } = useLanguageStore();
  const isUk = lang === 'uk';

  const [items, setItems] = useState<StudyItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StudyItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [topic, setTopic] = useState('');
  const [studiedDate, setStudiedDate] = useState(toYmd(new Date()));
  const [selectedDate, setSelectedDate] = useState(toYmd(new Date()));
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [router, user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const reviewEvents = useMemo<ReviewEvent[]>(() => {
    return items.flatMap((item) =>
      REVIEW_INTERVALS.map((intervalDays) => ({
        itemId: item.id,
        subject: item.subject,
        topic: item.topic,
        reviewDate: addDaysYmd(item.studiedDate, intervalDays),
        intervalDays,
      })),
    );
  }, [items]);

  const today = toYmd(new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ReviewEvent[]>();
    reviewEvents.forEach((event) => {
      const list = map.get(event.reviewDate) || [];
      list.push(event);
      map.set(event.reviewDate, list);
    });
    return map;
  }, [reviewEvents]);

  const todayEvents = eventsByDate.get(today) || [];
  const selectedDateEvents = eventsByDate.get(selectedDate) || [];

  const handleAdd = () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    const next: StudyItem = {
      id: crypto.randomUUID(),
      subject,
      topic: trimmedTopic,
      studiedDate,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [next, ...prev]);
    setTopic('');
    setSelectedDate(addDaysYmd(studiedDate, 1));
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const monthYearLabel = calendarCursor.toLocaleDateString(isUk ? 'uk-UA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  const calendarDays = useMemo(() => {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const startMondayIndex = (first.getDay() + 6) % 7;
    const cells: Array<{ date: string; inMonth: boolean }> = [];

    for (let i = 0; i < startMondayIndex; i++) {
      const d = new Date(year, month, 1 - (startMondayIndex - i));
      cells.push({ date: toYmd(d), inMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ date: toYmd(d), inMonth: true });
    }

    let extraDay = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month + 1, extraDay);
      cells.push({ date: toYmd(d), inMonth: false });
      extraDay += 1;
    }

    return cells;
  }, [calendarCursor]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {isUk ? 'План повторень' : 'Review Planner'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {isUk
              ? 'Додавай тему, а система автоматично поставить повторення на 1, 3, 7, 14 і 28 день.'
              : 'Add a topic and get automatic reviews for day 1, 3, 7, 14, and 28.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">
              {isUk ? 'Додати тему' : 'Add Topic'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  {isUk ? 'Предмет' : 'Subject'}
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                >
                  {SUBJECTS.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  {isUk ? 'Тема' : 'Topic'}
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={isUk ? 'Напр.: Історія, тема 29' : 'e.g. History, Topic 29'}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  {isUk ? 'Дата вивчення' : 'Study Date'}
                </label>
                <input
                  type="date"
                  value={studiedDate}
                  onChange={(e) => setStudiedDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <button
                onClick={handleAdd}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-semibold"
              >
                {isUk ? 'Додати в план' : 'Add to Plan'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <h2 className="text-xl font-semibold mb-3">
                {isUk ? 'Що повторити сьогодні' : 'Today Reviews'}
              </h2>
              {todayEvents.length === 0 ? (
                <p className="text-slate-500">{isUk ? 'На сьогодні повторень немає.' : 'No reviews for today.'}</p>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((event, idx) => (
                    <div
                      key={`${event.itemId}-${event.intervalDays}-${idx}`}
                      className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium">{event.subject}: {event.topic}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {getIntervalLabel(event.intervalDays, lang)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{isUk ? 'Календар повторень' : 'Review Calendar'}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const prev = new Date(calendarCursor);
                      prev.setMonth(prev.getMonth() - 1);
                      setCalendarCursor(prev);
                    }}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                  >
                    ←
                  </button>
                  <p className="text-sm font-medium min-w-[150px] text-center capitalize">{monthYearLabel}</p>
                  <button
                    onClick={() => {
                      const next = new Date(calendarCursor);
                      next.setMonth(next.getMonth() + 1);
                      setCalendarCursor(next);
                    }}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
                {(isUk ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell) => {
                  const eventsCount = (eventsByDate.get(cell.date) || []).length;
                  const isSelected = cell.date === selectedDate;
                  const isToday = cell.date === today;
                  return (
                    <button
                      key={cell.date}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`min-h-[64px] rounded-lg border p-1 text-left transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      } ${cell.inMonth ? '' : 'opacity-40'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isToday ? 'font-bold text-blue-600' : ''}`}>
                          {Number(cell.date.slice(8, 10))}
                        </span>
                        {eventsCount > 0 && (
                          <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5">
                            {eventsCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <h2 className="text-xl font-semibold mb-3">
                {isUk ? 'Повторення на обрану дату' : 'Reviews for Selected Date'}
              </h2>
              <p className="text-sm text-slate-500 mb-3">{selectedDate}</p>
              {selectedDateEvents.length === 0 ? (
                <p className="text-slate-500">{isUk ? 'Немає запланованих повторень.' : 'No planned reviews.'}</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map((event, idx) => (
                    <div
                      key={`${event.itemId}-${event.intervalDays}-${idx}`}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                    >
                      <p className="font-medium">{event.subject}: {event.topic}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {getIntervalLabel(event.intervalDays, lang)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">
            {isUk ? 'Додані теми' : 'Added Topics'}
          </h2>
          {items.length === 0 ? (
            <p className="text-slate-500">{isUk ? 'Поки що нічого не додано.' : 'Nothing added yet.'}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">{item.subject}: {item.topic}</p>
                    <p className="text-xs text-slate-500">
                      {isUk ? 'Вивчено:' : 'Studied:'} {item.studiedDate}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-sm px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isUk ? 'Видалити' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
