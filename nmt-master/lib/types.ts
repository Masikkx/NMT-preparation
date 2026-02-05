// Global type definitions

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  bio?: string;
  createdAt: Date;
}

export interface Subject {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  slug: string;
  subject: Subject;
}

export interface Question {
  id: string;
  testId: string;
  type: 'single_choice' | 'matching' | 'written' | 'multiple_answers' | 'select_three';
  content: string;
  imageUrl?: string;
  order: number;
  points: number;
  answers: Answer[];
}

export interface Answer {
  id: string;
  questionId: string;
  type: string;
  content: string;
  isCorrect: boolean;
  order?: number;
  matchingPair?: string;
}

export interface Test {
  id: string;
  subjectId: string;
  topicId?: string;
  title: string;
  description?: string;
  type: 'topic' | 'past_nmt';
  year?: number;
  image?: string;
  estimatedTime: number;
  isPublished: boolean;
  questions: Question[];
  subject: Subject;
  topic?: Topic;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestAttempt {
  id: string;
  userId: string;
  testId: string;
  startedAt: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  completedAt?: Date;
  status: 'in_progress' | 'paused' | 'completed';
  totalTime: number;
  userAnswers: UserAnswer[];
  test: Test;
  user: User;
}

export interface UserAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  answerIds: string;
  answerText?: string;
  isCorrect?: boolean;
  partialCredit: boolean;
  score: number;
}

export interface Result {
  id: string;
  userId: string;
  attemptId: string;
  testId?: string;
  correctAnswers: number;
  totalQuestions: number;
  rawScore: number;
  scaledScore: number;
  percentage: number;
  timeSpent: number;
  attempt?: TestAttempt;
  createdAt: Date;
}

export interface Achievement {
  id: string;
  userId: string;
  type: string;
  name: string;
  description?: string;
  icon?: string;
  unlockedAt: Date;
}

export interface UserStats {
  id: string;
  userId: string;
  totalTests: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  accuracy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaderboardEntry extends UserStats {
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  status?: number;
}
