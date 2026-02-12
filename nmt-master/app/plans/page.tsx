'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

type DailyPlanItem = {
  id: string;
  title: string;
  note: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  createdAt: string;
};

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

export default function PlansPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { lang } = useLanguageStore();
  const isUk = lang === 'uk';
  const today = toYmd(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<DailyPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [router, user]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plans', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (error) {
      console.error('Load plans error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPlans().catch(() => {});
  }, [loadPlans, user]);

  const selectedItems = useMemo(
    () => items.filter((item) => item.date === selectedDate),
    [items, selectedDate],
  );

  const selectedDone = selectedItems.filter((item) => item.done).length;
  const selectedRate = selectedItems.length > 0 ? Math.round((selectedDone / selectedItems.length) * 100) : 0;

  const weekData = useMemo(() => {
    const weekStart = getWeekStartYmd(selectedDate);
    const locale = isUk ? 'uk-UA' : 'en-US';
    const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    return Array.from({ length: 7 }).map((_, idx) => {
      const date = addDaysYmd(weekStart, idx);
      const dayItems = items.filter((item) => item.date === date);
      const total = dayItems.length;
      const done = dayItems.filter((item) => item.done).length;
      return {
        key: date,
        label: weekdayFmt.format(parseYmdLocal(date)),
        total,
        done,
        rate: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
  }, [isUk, items, selectedDate]);

  const weeklyRate = useMemo(() => {
    const total = weekData.reduce((acc, day) => acc + day.total, 0);
    const done = weekData.reduce((acc, day) => acc + day.done, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [weekData]);

  const currentStreak = useMemo(() => {
    const byDate = new Map<string, { total: number; done: number }>();
    items.forEach((item) => {
      if (!byDate.has(item.date)) byDate.set(item.date, { total: 0, done: 0 });
      const bucket = byDate.get(item.date)!;
      bucket.total += 1;
      if (item.done) bucket.done += 1;
    });

    let streak = 0;
    let cursor = today;
    while (true) {
      const day = byDate.get(cursor);
      if (!day || day.total === 0 || day.done < day.total) break;
      streak += 1;
      cursor = addDaysYmd(cursor, -1);
    }
    return streak;
  }, [items, today]);

  const addPlan = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          title: trimmed,
          note: note.trim(),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.task) {
        setItems((prev) => [data.task, ...prev]);
      }
      setTitle('');
      setNote('');
    } catch (error) {
      console.error('Add plan error:', error);
    }
  };

  const toggleDone = async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    const nextDone = !target.done;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: nextDone } : item)));
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: nextDone }),
      });
      if (!res.ok) {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: target.done } : item)));
      }
    } catch {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: target.done } : item)));
    }
  };

  const removePlan = async (id: string) => {
    const prev = items;
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      const res = await fetch(`/api/plans/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setItems(prev);
      }
    } catch {
      setItems(prev);
    }
  };

  const copyUndoneFromYesterday = async () => {
    const yesterday = addDaysYmd(selectedDate, -1);
    try {
      const res = await fetch('/api/plans/copy-undone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: yesterday,
          toDate: selectedDate,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        setItems((prev) => [...data.tasks, ...prev]);
      }
    } catch (error) {
      console.error('Copy undone error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">{isUk ? 'Плани дня' : 'Daily Plans'}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              {isUk
                ? 'Став задачі на день, відмічай виконані, і дивись прогрес у Dashboard.'
                : 'Set daily plans, mark completed tasks, and see progress on Dashboard.'}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← {isUk ? 'До dashboard' : 'Back to dashboard'}
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'На обраний день' : 'Selected day'}</p>
            <p className="text-2xl font-bold">{selectedRate}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Виконано сьогодні' : 'Done today'}</p>
            <p className="text-2xl font-bold">{selectedDone}/{selectedItems.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Тижневий рейт' : 'Weekly rate'}</p>
            <p className="text-2xl font-bold">{weeklyRate}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{isUk ? 'Серія ідеальних днів' : 'Perfect-day streak'}</p>
            <p className="text-2xl font-bold">{currentStreak}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-xl font-semibold mb-4">{isUk ? 'Додати задачу' : 'Add task'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">{isUk ? 'Дата' : 'Date'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDate((prev) => addDaysYmd(prev, -1))}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                  >
                    ←
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                  />
                  <button
                    onClick={() => setSelectedDate((prev) => addDaysYmd(prev, 1))}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                  >
                    →
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">{isUk ? 'Що зробити' : 'What to do'}</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isUk ? 'Напр.: Повторити теореми 7-10' : 'e.g. Review theorems 7-10'}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">{isUk ? 'Нотатка (опц.)' : 'Note (optional)'}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={addPlan}
                  className="bg-lime-600 hover:bg-lime-700 text-white rounded-lg py-2 font-semibold"
                >
                  {isUk ? 'Додати в план' : 'Add to plan'}
                </button>
                <button
                  onClick={copyUndoneFromYesterday}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 rounded-lg py-2 font-semibold"
                >
                  {isUk ? 'Перекинути незроблене' : 'Copy undone'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-xl font-semibold">
                  {isUk ? 'План на дату' : 'Plan for date'}: {selectedDate}
                </h2>
                <span className="text-xs px-2 py-1 rounded-full bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300">
                  {isUk ? 'Прогрес' : 'Progress'}: {selectedRate}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 mb-4 overflow-hidden">
                <div className="h-full bg-lime-500 transition-all" style={{ width: `${selectedRate}%` }} />
              </div>
              {loading ? (
                <p className="text-slate-500">{isUk ? 'Завантаження...' : 'Loading...'}</p>
              ) : selectedItems.length === 0 ? (
                <p className="text-slate-500">{isUk ? 'На цей день задач ще немає.' : 'No tasks for this date yet.'}</p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border px-3 py-2 flex items-start justify-between gap-3 ${
                        item.done
                          ? 'border-lime-300 dark:border-lime-700 bg-lime-50 dark:bg-lime-900/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleDone(item.id)}
                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center text-xs ${
                            item.done
                              ? 'bg-lime-600 border-lime-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {item.done ? '✓' : ''}
                        </button>
                        <div>
                          <p className={`font-medium ${item.done ? 'line-through text-slate-500' : ''}`}>{item.title}</p>
                          {item.note ? <p className="text-xs text-slate-500 mt-1">{item.note}</p> : null}
                        </div>
                      </div>
                      <button
                        onClick={() => removePlan(item.id)}
                        className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isUk ? 'Видалити' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-xl font-semibold mb-4">{isUk ? 'Цей тиждень' : 'This week'}</h2>
              <div className="grid grid-cols-7 gap-2">
                {weekData.map((day) => (
                  <button
                    key={day.key}
                    onClick={() => setSelectedDate(day.key)}
                    className={`rounded-lg border p-2 text-center ${
                      day.key === selectedDate
                        ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <p className="text-xs text-slate-500 mb-2">{day.label}</p>
                    <div className="mx-auto h-14 w-6 rounded bg-slate-100 dark:bg-slate-700 p-0.5 flex items-end">
                      <div
                        className={`w-full rounded-sm ${day.rate >= 80 ? 'bg-lime-500' : day.rate >= 40 ? 'bg-amber-400' : 'bg-slate-400'}`}
                        style={{ height: `${Math.max(8, day.rate)}%` }}
                      />
                    </div>
                    <p className="text-[11px] mt-2 font-semibold">{day.done}/{day.total}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
