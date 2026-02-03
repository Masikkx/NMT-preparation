/**
 * Test scoring and conversion utilities
 */

/**
 * Convert test score (number of correct answers) to official NMT 200-point scale
 * Based on provided conversion tables per subject.
 */
export function convertToNMTScale(testScore: number, subjectSlug?: string): number {
  const tables: Record<string, Record<number, number>> = {
    'ukrainian-language': {
      8: 100, 9: 105, 10: 110, 11: 120, 12: 125, 13: 130, 14: 134, 15: 136,
      16: 138, 17: 140, 18: 142, 19: 143, 20: 144, 21: 145, 22: 146, 23: 148,
      24: 149, 25: 150, 26: 152, 27: 154, 28: 156, 29: 157, 30: 159, 31: 160,
      32: 162, 33: 163, 34: 165, 35: 167, 36: 170, 37: 172, 38: 175, 39: 177,
      40: 180, 41: 183, 42: 186, 43: 191, 44: 195, 45: 200,
    },
    mathematics: {
      5: 100, 6: 108, 7: 115, 8: 123, 9: 131, 10: 134, 11: 137, 12: 140,
      13: 143, 14: 145, 15: 147, 16: 148, 17: 149, 18: 150, 19: 151, 20: 152,
      21: 155, 22: 159, 23: 163, 24: 167, 25: 170, 26: 173, 27: 176, 28: 180,
      29: 184, 30: 189, 31: 194, 32: 200,
    },
    'history-ukraine': {
      9: 100, 10: 105, 11: 110, 12: 115, 13: 120, 14: 125, 15: 130, 16: 132,
      17: 134, 18: 136, 19: 138, 20: 140, 21: 141, 22: 142, 23: 143, 24: 144,
      25: 145, 26: 146, 27: 147, 28: 148, 29: 149, 30: 150, 31: 151, 32: 152,
      33: 154, 34: 156, 35: 158, 36: 160, 37: 163, 38: 166, 39: 168, 40: 169,
      41: 170, 42: 172, 43: 173, 44: 175, 45: 177, 46: 179, 47: 181, 48: 183,
      49: 185, 50: 188, 51: 191, 52: 194, 53: 197, 54: 200,
    },
    'english-language': {
      5: 100, 6: 109, 7: 118, 8: 125, 9: 131, 10: 134, 11: 137, 12: 140,
      13: 143, 14: 145, 15: 147, 16: 148, 17: 149, 18: 150, 19: 151, 20: 152,
      21: 153, 22: 155, 23: 157, 24: 159, 25: 162, 26: 166, 27: 169, 28: 173,
      29: 179, 30: 185, 31: 191, 32: 200,
    },
  };

  if (subjectSlug && tables[subjectSlug]) {
    const table = tables[subjectSlug];
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    const min = keys[0];
    if (testScore < min) return 0;
    if (table[testScore] !== undefined) return table[testScore];
    // Fallback to nearest lower score
    for (let i = keys.length - 1; i >= 0; i--) {
      if (testScore >= keys[i]) return table[keys[i]];
    }
  }

  // Fallback: rough linear scale from 0-100 to 0-200
  const clamped = Math.max(0, Math.min(100, testScore));
  return Math.round((clamped / 100) * 200);
}

/**
 * Calculate raw score percentage
 */
export function calculatePercentage(
  correct: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Format time (seconds to MM:SS or HH:MM:SS)
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Determine if answer is correct based on question type
 */
export function checkAnswer(
  questionType: string,
  userAnswer: string | string[],
  correctAnswers: string[]
): { isCorrect: boolean; partialCredit: boolean } {
  switch (questionType) {
    case 'single_choice':
      return {
        isCorrect: userAnswer === correctAnswers[0],
        partialCredit: false,
      };

    case 'written':
      if (!correctAnswers[0]) {
        return { isCorrect: false, partialCredit: false };
      }
      // Case-insensitive exact match
      return {
        isCorrect:
          String(userAnswer).toLowerCase().trim() ===
          correctAnswers[0].toLowerCase().trim(),
        partialCredit: false,
      };

    case 'multiple_answers': {
      const userAnswerArray = Array.isArray(userAnswer)
        ? userAnswer
        : [userAnswer];
      const userSet = new Set(userAnswerArray.sort());
      const correctSet = new Set(correctAnswers.sort());

      const isCorrect =
        userSet.size === correctSet.size &&
        Array.from(userSet).every((ans) => correctSet.has(ans));

      const correctCount = Array.from(userSet).filter((ans) =>
        correctSet.has(ans)
      ).length;
      const partialCredit = correctCount > 0 && !isCorrect;

      return { isCorrect, partialCredit };
    }

    case 'select_three': {
      const userAnswerArray = Array.isArray(userAnswer)
        ? userAnswer
        : [userAnswer];
      const userSet = new Set(userAnswerArray.sort());
      const correctSet = new Set(correctAnswers.sort());

      const isCorrect =
        userSet.size === correctSet.size &&
        Array.from(userSet).every((ans) => correctSet.has(ans));

      const correctCount = Array.from(userSet).filter((ans) =>
        correctSet.has(ans)
      ).length;
      const partialCredit = correctCount > 0 && !isCorrect;

      return { isCorrect, partialCredit };
    }

    case 'matching': {
      const userArray = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      const correctArray = correctAnswers;
      const length = Math.max(userArray.length, correctArray.length);
      let correctCount = 0;

      for (let i = 0; i < length; i++) {
        if (userArray[i] && correctArray[i] && userArray[i] === correctArray[i]) {
          correctCount += 1;
        }
      }

      const isCorrect = correctCount === correctArray.length;
      const partialCredit = correctCount > 0 && !isCorrect;

      return { isCorrect, partialCredit };
    }

    default:
      return { isCorrect: false, partialCredit: false };
  }
}

/**
 * Calculate points for partial credit
 */
export function calculatePoints(
  isCorrect: boolean,
  partialCredit: boolean,
  totalPoints: number,
  correctCount?: number,
  totalAnswers?: number
): number {
  if (isCorrect) return totalPoints;
  if (partialCredit && correctCount && totalAnswers) {
    const percentage = correctCount / totalAnswers;
    return Math.round(totalPoints * percentage);
  }
  return 0;
}

/**
 * Generate achievement based on score
 */
export function generateAchievements(
  score: number,
  percentage: number,
  testCount: number
): string[] {
  const achievements: string[] = [];

  if (testCount === 1) achievements.push('first_test');
  if (percentage === 100) achievements.push('perfect_score');
  if (score >= 180) achievements.push('high_score');
  if (percentage >= 90) achievements.push('excellent');

  return achievements;
}
