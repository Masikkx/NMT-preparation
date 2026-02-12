'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

type Flashcard = {
  id: string;
  term: string;
  definition: string;
  starred: boolean;
  learned: boolean;
};

type FlashcardSet = {
  id: string;
  title: string;
  description: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  cards: Flashcard[];
};

type DraftCard = {
  id: string;
  term: string;
  definition: string;
};

const STORAGE_KEY = 'nmt-flashcard-sets-v1';

const createDraftCard = (): DraftCard => ({
  id: crypto.randomUUID(),
  term: '',
  definition: '',
});

const shuffleArray = <T,>(arr: T[]): T[] => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

export default function FlashcardsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { lang } = useLanguageStore();
  const isUk = lang === 'uk';

  const [sets, setSets] = useState<FlashcardSet[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FlashcardSet[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [mode, setMode] = useState<'library' | 'edit' | 'study'>('library');

  const [setTitle, setSetTitle] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [setSubject, setSetSubject] = useState('');
  const [draftCards, setDraftCards] = useState<DraftCard[]>([
    createDraftCard(),
    createDraftCard(),
    createDraftCard(),
    createDraftCard(),
  ]);

  const [studyFilter, setStudyFilter] = useState<'all' | 'starred' | 'unlearned'>('all');
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [router, user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  }, [sets]);

  const selectedSet = useMemo(
    () => sets.find((set) => set.id === selectedSetId) || sets[0] || null,
    [selectedSetId, sets],
  );

  const deck = useMemo(() => {
    if (!selectedSet) return [];

    const filtered = selectedSet.cards.filter((card) => {
      if (studyFilter === 'starred') return card.starred;
      if (studyFilter === 'unlearned') return !card.learned;
      return true;
    });

    if (!shuffleEnabled) return filtered;

    void shuffleSeed;
    return shuffleArray(filtered);
  }, [selectedSet, studyFilter, shuffleEnabled, shuffleSeed]);

  const maxDeckIndex = Math.max(0, deck.length - 1);
  const safeCurrentIndex = Math.min(currentIndex, maxDeckIndex);
  const currentCard = deck[safeCurrentIndex] || null;
  const learnedCount = selectedSet?.cards.filter((card) => card.learned).length || 0;
  const starredCount = selectedSet?.cards.filter((card) => card.starred).length || 0;
  const progressRate = selectedSet && selectedSet.cards.length > 0
    ? Math.round((learnedCount / selectedSet.cards.length) * 100)
    : 0;

  const updateSet = useCallback((setId: string, updater: (set: FlashcardSet) => FlashcardSet) => {
    setSets((prev) =>
      prev.map((set) => (
        set.id === setId
          ? { ...updater(set), updatedAt: new Date().toISOString() }
          : set
      )),
    );
  }, []);

  const updateCardFlags = useCallback((cardId: string, patch: Partial<Pick<Flashcard, 'learned' | 'starred'>>) => {
    if (!selectedSet) return;
    updateSet(selectedSet.id, (set) => ({
      ...set,
      cards: set.cards.map((card) => (
        card.id === cardId ? { ...card, ...patch } : card
      )),
    }));
  }, [selectedSet, updateSet]);

  useEffect(() => {
    if (mode !== 'study') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        setShowBack((prev) => !prev);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentIndex((prev) => Math.min(maxDeckIndex, prev + 1));
        setShowBack(false);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        setShowBack(false);
      }
      if (event.key === '1' && currentCard) {
        event.preventDefault();
        updateCardFlags(currentCard.id, { learned: false, starred: true });
      }
      if (event.key === '2' && currentCard) {
        event.preventDefault();
        updateCardFlags(currentCard.id, { learned: true });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, maxDeckIndex, mode, updateCardFlags]);

  const handleCreateSet = () => {
    const cleanedCards = draftCards
      .map((card) => ({ term: card.term.trim(), definition: card.definition.trim() }))
      .filter((card) => card.term && card.definition);

    if (!setTitle.trim() || cleanedCards.length < 2) return;

    const now = new Date().toISOString();
    const nextSet: FlashcardSet = {
      id: crypto.randomUUID(),
      title: setTitle.trim(),
      description: setDescription.trim(),
      subject: setSubject.trim(),
      createdAt: now,
      updatedAt: now,
      cards: cleanedCards.map((card) => ({
        id: crypto.randomUUID(),
        term: card.term,
        definition: card.definition,
        learned: false,
        starred: false,
      })),
    };

    setSets((prev) => [nextSet, ...prev]);
    setSelectedSetId(nextSet.id);
    setMode('edit');
    setSetTitle('');
    setSetDescription('');
    setSetSubject('');
    setDraftCards([createDraftCard(), createDraftCard(), createDraftCard(), createDraftCard()]);
  };

  const handleDeleteSet = (setId: string) => {
    setSets((prev) => prev.filter((set) => set.id !== setId));
    if (selectedSetId === setId) {
      setSelectedSetId(null);
      setMode('library');
    }
  };

  const handleResetProgress = () => {
    if (!selectedSet) return;
    updateSet(selectedSet.id, (set) => ({
      ...set,
      cards: set.cards.map((card) => ({ ...card, learned: false })),
    }));
    setCurrentIndex(0);
    setShowBack(false);
  };

  const goNextCard = () => {
    setCurrentIndex((prev) => Math.min(maxDeckIndex, prev + 1));
    setShowBack(false);
  };

  const goPrevCard = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setShowBack(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">{isUk ? 'Флешкарти' : 'Flashcards'}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              {isUk
                ? 'Створюй сети карток і вчи в режимі, схожому на Quizlet: flip, shuffle, difficult та progress.'
                : 'Create card sets and study in a Quizlet-style mode: flip, shuffle, difficult, and progress.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('library')}
              className={`px-3 py-2 text-sm rounded-lg border ${mode === 'library' ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100' : 'border-slate-300 dark:border-slate-700'}`}
            >
              {isUk ? 'Бібліотека' : 'Library'}
            </button>
            <button
              onClick={() => selectedSet && setMode('edit')}
              className={`px-3 py-2 text-sm rounded-lg border ${mode === 'edit' ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100' : 'border-slate-300 dark:border-slate-700'}`}
            >
              {isUk ? 'Редактор' : 'Editor'}
            </button>
            <button
              onClick={() => selectedSet && setMode('study')}
              className={`px-3 py-2 text-sm rounded-lg border ${mode === 'study' ? 'bg-lime-600 text-white border-lime-600' : 'border-slate-300 dark:border-slate-700'}`}
            >
              {isUk ? 'Навчання' : 'Study'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-xl font-semibold mb-4">{isUk ? 'Новий сет' : 'New set'}</h2>
            <div className="space-y-3">
              <input
                value={setTitle}
                onChange={(e) => setSetTitle(e.target.value)}
                placeholder={isUk ? 'Назва сету (обов`язково)' : 'Set title (required)'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              />
              <input
                value={setSubject}
                onChange={(e) => setSetSubject(e.target.value)}
                placeholder={isUk ? 'Предмет (опціонально)' : 'Subject (optional)'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              />
              <textarea
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                rows={2}
                placeholder={isUk ? 'Опис (опціонально)' : 'Description (optional)'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              />

              <div className="space-y-2">
                {draftCards.map((card, idx) => (
                  <div key={card.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                    <p className="text-xs text-slate-500 mb-2">{isUk ? `Картка ${idx + 1}` : `Card ${idx + 1}`}</p>
                    <input
                      value={card.term}
                      onChange={(e) => setDraftCards((prev) => prev.map((x) => (x.id === card.id ? { ...x, term: e.target.value } : x)))}
                      placeholder={isUk ? 'Термін' : 'Term'}
                      className="mb-2 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={card.definition}
                      onChange={(e) => setDraftCards((prev) => prev.map((x) => (x.id === card.id ? { ...x, definition: e.target.value } : x)))}
                      placeholder={isUk ? 'Визначення' : 'Definition'}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setDraftCards((prev) => [...prev, createDraftCard()])}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 py-2 text-sm"
                >
                  {isUk ? '+ Картка' : '+ Card'}
                </button>
                <button
                  onClick={handleCreateSet}
                  className="flex-1 rounded-lg bg-lime-600 hover:bg-lime-700 text-white py-2 text-sm font-semibold"
                >
                  {isUk ? 'Створити сет' : 'Create set'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {mode === 'library' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                <h2 className="text-xl font-semibold mb-4">{isUk ? 'Мої сети' : 'My sets'}</h2>
                {sets.length === 0 ? (
                  <p className="text-slate-500">{isUk ? 'Поки що немає сетів.' : 'No sets yet.'}</p>
                ) : (
                  <div className="space-y-2">
                    {sets.map((set) => {
                      const learned = set.cards.filter((card) => card.learned).length;
                      const rate = set.cards.length > 0 ? Math.round((learned / set.cards.length) * 100) : 0;
                      return (
                        <div key={set.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{set.title}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {set.subject ? `${set.subject} • ` : ''}{set.cards.length} {isUk ? 'карток' : 'cards'}
                              </p>
                              {set.description ? (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{set.description}</p>
                              ) : null}
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300">
                              {rate}%
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setSelectedSetId(set.id);
                                setMode('study');
                                setCurrentIndex(0);
                                setShowBack(false);
                              }}
                              className="text-xs px-3 py-1.5 rounded bg-lime-600 hover:bg-lime-700 text-white"
                            >
                              {isUk ? 'Вчити' : 'Study'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSetId(set.id);
                                setMode('edit');
                              }}
                              className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600"
                            >
                              {isUk ? 'Редагувати' : 'Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteSet(set.id)}
                              className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white"
                            >
                              {isUk ? 'Видалити' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {mode === 'edit' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                {!selectedSet ? (
                  <p className="text-slate-500">{isUk ? 'Оберіть сет у бібліотеці.' : 'Select a set in library.'}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">{isUk ? 'Редактор сету' : 'Set editor'}: {selectedSet.title}</h2>
                      <button
                        onClick={() => setMode('study')}
                        className="text-sm px-3 py-2 rounded bg-lime-600 hover:bg-lime-700 text-white"
                      >
                        {isUk ? 'До навчання' : 'Start study'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {selectedSet.cards.map((card, idx) => (
                        <div key={card.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                          <p className="text-xs text-slate-500 mb-2">{isUk ? `Картка ${idx + 1}` : `Card ${idx + 1}`}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                            <input
                              value={card.term}
                              onChange={(e) => updateSet(selectedSet.id, (set) => ({
                                ...set,
                                cards: set.cards.map((x) => x.id === card.id ? { ...x, term: e.target.value } : x),
                              }))}
                              placeholder={isUk ? 'Термін' : 'Term'}
                              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                            />
                            <input
                              value={card.definition}
                              onChange={(e) => updateSet(selectedSet.id, (set) => ({
                                ...set,
                                cards: set.cards.map((x) => x.id === card.id ? { ...x, definition: e.target.value } : x),
                              }))}
                              placeholder={isUk ? 'Визначення' : 'Definition'}
                              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCardFlags(card.id, { starred: !card.starred })}
                              className={`text-xs px-2 py-1 rounded ${card.starred ? 'bg-amber-400 text-slate-900' : 'border border-slate-300 dark:border-slate-600'}`}
                            >
                              {isUk ? 'Складна' : 'Difficult'}
                            </button>
                            <button
                              onClick={() => updateCardFlags(card.id, { learned: !card.learned })}
                              className={`text-xs px-2 py-1 rounded ${card.learned ? 'bg-lime-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
                            >
                              {isUk ? 'Вивчена' : 'Learned'}
                            </button>
                            <button
                              onClick={() => updateSet(selectedSet.id, (set) => ({
                                ...set,
                                cards: set.cards.filter((x) => x.id !== card.id),
                              }))}
                              className="text-xs px-2 py-1 rounded bg-red-600 text-white"
                            >
                              {isUk ? 'Видалити' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => updateSet(selectedSet.id, (set) => ({
                        ...set,
                        cards: [
                          ...set.cards,
                          { id: crypto.randomUUID(), term: '', definition: '', starred: false, learned: false },
                        ],
                      }))}
                      className="mt-3 text-sm px-3 py-2 rounded border border-slate-300 dark:border-slate-600"
                    >
                      {isUk ? '+ Додати картку' : '+ Add card'}
                    </button>
                  </>
                )}
              </div>
            )}

            {mode === 'study' && (
              <div className="rounded-2xl border border-indigo-300/30 dark:border-indigo-700/30 bg-gradient-to-b from-[#141251] via-[#1b1764] to-[#120f45] p-4 sm:p-6 shadow-2xl">
                {!selectedSet ? (
                  <p className="text-indigo-100/80">{isUk ? 'Оберіть сет у бібліотеці.' : 'Select a set in library.'}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4 sm:mb-6">
                      <div>
                        <h2 className="text-xl font-semibold text-white">{selectedSet.title}</h2>
                        <p className="text-sm text-indigo-100/80">
                          {selectedSet.cards.length} {isUk ? 'карток' : 'cards'} • {isUk ? 'Вивчено' : 'Learned'} {learnedCount}/{selectedSet.cards.length} • {isUk ? 'Складних' : 'Difficult'} {starredCount}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={studyFilter}
                          onChange={(e) => {
                            setStudyFilter(e.target.value as 'all' | 'starred' | 'unlearned');
                            setCurrentIndex(0);
                            setShowBack(false);
                          }}
                          className="rounded-lg border border-indigo-300/40 bg-[#201b73] text-white px-2 py-2 text-sm"
                        >
                          <option value="all">{isUk ? 'Усі' : 'All'}</option>
                          <option value="starred">{isUk ? 'Лише складні' : 'Only difficult'}</option>
                          <option value="unlearned">{isUk ? 'Лише невивчені' : 'Only unlearned'}</option>
                        </select>
                        <button
                          onClick={() => {
                            setShuffleEnabled((prev) => !prev);
                            setShuffleSeed((prev) => prev + 1);
                            setCurrentIndex(0);
                            setShowBack(false);
                          }}
                          className={`px-3 py-2 text-sm rounded-lg border ${shuffleEnabled ? 'bg-cyan-400 text-slate-900 border-cyan-300 font-semibold' : 'bg-[#201b73] text-white border-indigo-300/40'}`}
                        >
                          {isUk ? 'Shuffle' : 'Shuffle'}
                        </button>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-5">
                      <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progressRate}%` }} />
                    </div>

                    {deck.length === 0 ? (
                      <p className="text-indigo-100/80">{isUk ? 'Немає карток для цього фільтра.' : 'No cards for this filter.'}</p>
                    ) : (
                      <>
                        <div className="mx-auto max-w-4xl [perspective:2200px]">
                          <button
                            onClick={() => setShowBack((prev) => !prev)}
                            className="w-full h-[280px] sm:h-[360px] md:h-[420px] rounded-2xl bg-transparent"
                          >
                            <div
                              className={`relative h-full w-full rounded-2xl [transform-style:preserve-3d] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
                                showBack ? '[transform:rotateX(180deg)]' : ''
                              }`}
                            >
                              <div className="absolute inset-0 rounded-2xl border border-white/15 bg-gradient-to-br from-[#2a2588] to-[#201b73] px-6 py-6 sm:px-10 sm:py-8 text-left [backface-visibility:hidden] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                                <div className="flex items-center justify-between text-indigo-100/70 text-xs sm:text-sm">
                                  <span>{isUk ? 'Термін' : 'Term'}</span>
                                  <span>{safeCurrentIndex + 1}/{deck.length}</span>
                                </div>
                                <div className="h-full flex items-center justify-center">
                                  <p className="text-white text-2xl sm:text-4xl font-semibold text-center leading-tight break-words">
                                    {currentCard?.term}
                                  </p>
                                </div>
                              </div>

                              <div className="absolute inset-0 rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-[#1188c8] to-[#0d5ea6] px-6 py-6 sm:px-10 sm:py-8 text-left [backface-visibility:hidden] [transform:rotateX(180deg)] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                                <div className="flex items-center justify-between text-cyan-100/85 text-xs sm:text-sm">
                                  <span>{isUk ? 'Визначення' : 'Definition'}</span>
                                  <span>{currentCard?.starred ? (isUk ? 'Складна' : 'Difficult') : ''}</span>
                                </div>
                                <div className="h-full flex items-center justify-center">
                                  <p className="text-white text-xl sm:text-3xl font-semibold text-center leading-tight break-words">
                                    {currentCard?.definition}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap text-indigo-100/90">
                          <div className="flex items-center gap-2">
                            <button onClick={goPrevCard} className="px-3 py-2 text-sm rounded-lg border border-indigo-300/40 bg-[#201b73] hover:bg-[#2a2588]">←</button>
                            <span className="text-sm">{safeCurrentIndex + 1}/{deck.length}</span>
                            <button onClick={goNextCard} className="px-3 py-2 text-sm rounded-lg border border-indigo-300/40 bg-[#201b73] hover:bg-[#2a2588]">→</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => currentCard && updateCardFlags(currentCard.id, { starred: !currentCard.starred })}
                              className={`px-3 py-2 text-sm rounded-lg border ${currentCard?.starred ? 'bg-amber-300 text-slate-900 border-amber-200 font-semibold' : 'border-indigo-300/40 bg-[#201b73] hover:bg-[#2a2588] text-white'}`}
                            >
                              {isUk ? 'Складна' : 'Difficult'}
                            </button>
                            <button
                              onClick={() => currentCard && updateCardFlags(currentCard.id, { learned: false, starred: true })}
                              className="px-3 py-2 text-sm rounded-lg bg-[#2f286f] hover:bg-[#3f3690] text-white border border-indigo-300/30"
                            >
                              {isUk ? 'Не знаю' : "Still learning"}
                            </button>
                            <button
                              onClick={() => currentCard && updateCardFlags(currentCard.id, { learned: true })}
                              className="px-3 py-2 text-sm rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold"
                            >
                              {isUk ? 'Знаю' : 'Know it'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                          <button
                            onClick={handleResetProgress}
                            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300/40 bg-[#201b73] hover:bg-[#2a2588] text-white"
                          >
                            {isUk ? 'Скинути прогрес сету' : 'Reset set progress'}
                          </button>
                          <p className="text-xs text-indigo-100/70">
                            {isUk ? 'Натисни картку або Space для Flip' : 'Tap card or Space to flip'} • `←/→`
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-slate-600 dark:text-slate-300 underline">
            {isUk ? 'Повернутись у dashboard' : 'Back to dashboard'}
          </Link>
        </div>
      </div>
    </div>
  );
}
