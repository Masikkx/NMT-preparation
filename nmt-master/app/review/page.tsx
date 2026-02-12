'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

type ReviewStatusMap = Record<string, boolean>;

type SubjectStats = {
  subject: string;
  planned: number;
  completed: number;
  completionRate: number;
  topTopic: string;
  topTopicCompletedCount: number;
  streakDays: number;
};

const STORAGE_KEY = 'nmt-review-plan-v1';
const STATUS_STORAGE_KEY = 'nmt-review-status-v1';
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

const getWeekStartYmd = (value: string): string => {
  const date = parseYmdLocal(value);
  const mondayIndex = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayIndex);
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

const getEventKey = (event: Pick<ReviewEvent, 'itemId' | 'reviewDate' | 'intervalDays'>): string =>
  `${event.itemId}__${event.reviewDate}__${event.intervalDays}`;

const getCurrentStreakDays = (dates: string[]): number => {
  if (dates.length === 0) return 0;
  const uniqueSorted = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  const cursor = parseYmdLocal(toYmd(new Date()));

  for (const day of uniqueSorted) {
    if (toYmd(cursor) !== day) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
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
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusMap>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STATUS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ReviewStatusMap;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [router, user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(reviewStatus));
  }, [reviewStatus]);

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

  const subjectStats = useMemo<SubjectStats[]>(() => {
    if (reviewEvents.length === 0) return [];

    type Acc = {
      planned: number;
      completed: number;
      topicCompleted: Map<string, number>;
      completedDates: string[];
    };

    const bySubject = new Map<string, Acc>();

    for (const event of reviewEvents) {
      if (!bySubject.has(event.subject)) {
        bySubject.set(event.subject, {
          planned: 0,
          completed: 0,
          topicCompleted: new Map<string, number>(),
          completedDates: [],
        });
      }

      const bucket = bySubject.get(event.subject)!;
      bucket.planned += 1;

      const eventKey = getEventKey(event);
      if (reviewStatus[eventKey]) {
        bucket.completed += 1;
        bucket.completedDates.push(event.reviewDate);
        bucket.topicCompleted.set(event.topic, (bucket.topicCompleted.get(event.topic) || 0) + 1);
      }
    }

    return Array.from(bySubject.entries())
      .map(([subjectName, bucket]) => {
        let topTopic = isUk ? 'Поки без повторів' : 'No completed topics yet';
        let topTopicCompletedCount = 0;

        for (const [topicName, count] of bucket.topicCompleted.entries()) {
          if (count > topTopicCompletedCount) {
            topTopicCompletedCount = count;
            topTopic = topicName;
          }
        }

        return {
          subject: subjectName,
          planned: bucket.planned,
          completed: bucket.completed,
          completionRate: bucket.planned > 0 ? Math.round((bucket.completed / bucket.planned) * 100) : 0,
          topTopic,
          topTopicCompletedCount,
          streakDays: getCurrentStreakDays(bucket.completedDates),
        };
      })
      .sort((a, b) => {
        if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
        return b.completed - a.completed;
      });
  }, [reviewEvents, reviewStatus, isUk]);

  const dashboardMetrics = useMemo(() => {
    const completed = reviewEvents.reduce((acc, event) => (
      reviewStatus[getEventKey(event)] ? acc + 1 : acc
    ), 0);
    const planned = reviewEvents.length;
    const completionRate = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    const longestStreak = subjectStats.reduce((max, stat) => Math.max(max, stat.streakDays), 0);
    const activeSubjects = new Set(items.map((item) => item.subject)).size;

    return {
      planned,
      completed,
      pending: Math.max(0, planned - completed),
      completionRate,
      longestStreak,
      activeSubjects,
    };
  }, [items, reviewEvents, reviewStatus, subjectStats]);

  const completionPieData = useMemo(
    () => [
      { name: isUk ? 'Виконано' : 'Completed', value: dashboardMetrics.completed, color: '#65a30d' },
      { name: isUk ? 'Залишилось' : 'Pending', value: dashboardMetrics.pending, color: '#cbd5e1' },
    ],
    [dashboardMetrics.completed, dashboardMetrics.pending, isUk],
  );

  const subjectChartData = useMemo(
    () =>
      subjectStats.slice(0, 8).map((stat) => ({
        subject: stat.subject.length > 14 ? `${stat.subject.slice(0, 14)}...` : stat.subject,
        completionRate: stat.completionRate,
        planned: stat.planned,
        completed: stat.completed,
      })),
    [subjectStats],
  );

  const dailyTrendData = useMemo(() => {
    const days = 30;
    const output: Array<{ day: string; planned: number; completed: number; rate: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysYmd(today, -i);
      const dayEvents = eventsByDate.get(date) || [];
      const planned = dayEvents.length;
      const completed = dayEvents.reduce((acc, event) => (
        reviewStatus[getEventKey(event)] ? acc + 1 : acc
      ), 0);

      output.push({
        day: date.slice(5),
        planned,
        completed,
        rate: planned > 0 ? Math.round((completed / planned) * 100) : 0,
      });
    }

    return output;
  }, [eventsByDate, reviewStatus, today]);

  const weekdayPerformance = useMemo(() => {
    const labels = isUk ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets = labels.map((label) => ({ day: label, planned: 0, completed: 0, rate: 0 }));

    reviewEvents.forEach((event) => {
      const date = parseYmdLocal(event.reviewDate);
      const idx = (date.getDay() + 6) % 7;
      buckets[idx].planned += 1;
      if (reviewStatus[getEventKey(event)]) {
        buckets[idx].completed += 1;
      }
    });

    return buckets.map((bucket) => ({
      ...bucket,
      rate: bucket.planned > 0 ? Math.round((bucket.completed / bucket.planned) * 100) : 0,
    }));
  }, [isUk, reviewEvents, reviewStatus]);

  const intervalMastery = useMemo(() => {
    const buckets = new Map<number, { planned: number; completed: number }>();
    REVIEW_INTERVALS.forEach((interval) => buckets.set(interval, { planned: 0, completed: 0 }));

    reviewEvents.forEach((event) => {
      const bucket = buckets.get(event.intervalDays);
      if (!bucket) return;
      bucket.planned += 1;
      if (reviewStatus[getEventKey(event)]) bucket.completed += 1;
    });

    return REVIEW_INTERVALS.map((interval) => {
      const bucket = buckets.get(interval)!;
      return {
        interval: `${interval}d`,
        score: bucket.planned > 0 ? Math.round((bucket.completed / bucket.planned) * 100) : 0,
      };
    });
  }, [reviewEvents, reviewStatus]);

  const weeklyMomentum = useMemo(() => {
    const weeks = 8;
    const now = parseYmdLocal(today);
    const mondayOffset = (now.getDay() + 6) % 7;
    now.setDate(now.getDate() - mondayOffset);
    const currentWeekStart = toYmd(now);

    const aggregate = new Map<string, { planned: number; completed: number }>();
    reviewEvents.forEach((event) => {
      const weekStart = getWeekStartYmd(event.reviewDate);
      if (!aggregate.has(weekStart)) {
        aggregate.set(weekStart, { planned: 0, completed: 0 });
      }
      const bucket = aggregate.get(weekStart)!;
      bucket.planned += 1;
      if (reviewStatus[getEventKey(event)]) bucket.completed += 1;
    });

    const chartData: Array<{ week: string; planned: number; completed: number; rate: number }> = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = addDaysYmd(currentWeekStart, -i * 7);
      const bucket = aggregate.get(weekStart) || { planned: 0, completed: 0 };
      chartData.push({
        week: weekStart.slice(5),
        planned: bucket.planned,
        completed: bucket.completed,
        rate: bucket.planned > 0 ? Math.round((bucket.completed / bucket.planned) * 100) : 0,
      });
    }
    return chartData;
  }, [reviewEvents, reviewStatus, today]);

  const toggleReviewed = (event: ReviewEvent) => {
    const key = getEventKey(event);
    setReviewStatus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
                      <button
                        onClick={() => toggleReviewed(event)}
                        className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                          reviewStatus[getEventKey(event)]
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100'
                        }`}
                      >
                        {reviewStatus[getEventKey(event)]
                          ? (isUk ? 'Повторено' : 'Reviewed')
                          : (isUk ? 'Відмітити як повторено' : 'Mark as reviewed')}
                      </button>
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
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium">{event.subject}: {event.topic}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {getIntervalLabel(event.intervalDays, lang)}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleReviewed(event)}
                        className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                          reviewStatus[getEventKey(event)]
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100'
                        }`}
                      >
                        {reviewStatus[getEventKey(event)]
                          ? (isUk ? 'Повторено' : 'Reviewed')
                          : (isUk ? 'Відмітити як повторено' : 'Mark as reviewed')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-lime-200/70 dark:border-lime-900/50 bg-gradient-to-br from-lime-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isUk ? 'Momentum Dashboard' : 'Momentum Dashboard'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {isUk
                  ? 'Твоя динаміка повторень: виконання, стабільність і темп за останні тижні.'
                  : 'Your review momentum: completion, consistency, and pace over recent weeks.'}
              </p>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 rounded-lg bg-white/80 dark:bg-slate-800/60 px-3 py-2 border border-slate-200 dark:border-slate-700">
              {isUk ? 'Оновлено:' : 'Updated:'} <strong>{today}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Загальний прогрес' : 'Overall progress'}</p>
              <p className="text-2xl font-bold text-lime-700 dark:text-lime-400">{dashboardMetrics.completionRate}%</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Виконано повторів' : 'Completed reviews'}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboardMetrics.completed}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Макс. серія' : 'Longest streak'}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboardMetrics.longestStreak}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Активні предмети' : 'Active subjects'}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{dashboardMetrics.activeSubjects}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-3">{isUk ? 'Виконано vs залишилось' : 'Completed vs pending'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={95}
                      strokeWidth={0}
                      paddingAngle={3}
                    >
                      {completionPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-3">{isUk ? 'Ефективність по днях тижня' : 'Weekday efficiency'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" name={isUk ? 'Виконано' : 'Completed'} fill="#65a30d" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="planned" name={isUk ? 'Заплановано' : 'Planned'} fill="#94a3b8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-3">{isUk ? 'Тренд за 30 днів' : '30-day trend'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" minTickGap={24} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="planned" name={isUk ? 'Заплановано' : 'Planned'} fill="#cbd5e1" />
                    <Line type="monotone" dataKey="completed" name={isUk ? 'Виконано' : 'Completed'} stroke="#16a34a" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-3">{isUk ? 'Майстерність інтервалів' : 'Interval mastery'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={intervalMastery}>
                    <PolarAngleAxis dataKey="interval" />
                    <Tooltip />
                    <Radar dataKey="score" fill="#84cc16" fillOpacity={0.45} stroke="#65a30d" strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-3">{isUk ? 'Прогрес по предметах' : 'Subject progress'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectChartData} layout="vertical" margin={{ left: 14, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="subject" width={130} />
                    <Tooltip />
                    <Bar dataKey="completionRate" name={isUk ? 'Виконання %' : 'Completion %'} fill="#22c55e" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-3">{isUk ? 'Тижневий momentum (8 тижнів)' : 'Weekly momentum (8 weeks)'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyMomentum}>
                    <defs>
                      <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#65a30d" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#65a30d" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="completed" name={isUk ? 'Виконано' : 'Completed'} stroke="#65a30d" fill="url(#momentumFill)" />
                    <Line type="monotone" dataKey="rate" name={isUk ? 'Рейт %' : 'Rate %'} stroke="#0f172a" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
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

        <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">
            {isUk ? 'Статистика по предметах' : 'Subject Statistics'}
          </h2>
          {subjectStats.length === 0 ? (
            <p className="text-slate-500">{isUk ? 'Поки що немає даних для статистики.' : 'No data for statistics yet.'}</p>
          ) : (
            <div className="space-y-3">
              {subjectStats.map((stat) => (
                <div
                  key={stat.subject}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-semibold">{stat.subject}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {isUk ? 'Виконання' : 'Completion'}: {stat.completionRate}%
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                    <p>
                      {isUk ? 'Заплановано повторів:' : 'Planned reviews:'} <strong>{stat.planned}</strong>
                    </p>
                    <p>
                      {isUk ? 'Виконано повторів:' : 'Completed reviews:'} <strong>{stat.completed}</strong>
                    </p>
                    <p>
                      {isUk ? 'Поточна серія днів:' : 'Current streak days:'} <strong>{stat.streakDays}</strong>
                    </p>
                    <p>
                      {isUk ? 'Топ-тема:' : 'Top topic:'}{' '}
                      <strong>
                        {stat.topTopic}
                        {stat.topTopicCompletedCount > 0 ? ` (${stat.topTopicCompletedCount})` : ''}
                      </strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
