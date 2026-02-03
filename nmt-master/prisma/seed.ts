import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create subjects
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { slug: 'ukrainian-language' },
      update: {},
      create: {
        name: 'Ukrainian Language',
        slug: 'ukrainian-language',
        icon: '🇺🇦',
        color: '#0066CC',
      },
    }),
    prisma.subject.upsert({
      where: { slug: 'mathematics' },
      update: {},
      create: {
        name: 'Mathematics',
        slug: 'mathematics',
        icon: '📐',
        color: '#FF6B6B',
      },
    }),
    prisma.subject.upsert({
      where: { slug: 'history-ukraine' },
      update: {},
      create: {
        name: 'History of Ukraine',
        slug: 'history-ukraine',
        icon: '📚',
        color: '#FFD700',
      },
    }),
    prisma.subject.upsert({
      where: { slug: 'english-language' },
      update: {},
      create: {
        name: 'English Language',
        slug: 'english-language',
        icon: '🗣️',
        color: '#00AA44',
      },
    }),
  ]);

  console.log(`Created ${subjects.length} subjects`);

  // Create admin user
  const adminPassword = await hashPassword('0689939242');
  const adminUser = await prisma.user.upsert({
    where: { email: 'www.macs2009@gmail.com' },
    update: {},
    create: {
      email: 'www.macs2009@gmail.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log(`Created admin user: ${adminUser.email}`);

  // Create sample topics for Ukrainian Language
  const ukrainianTopics = await Promise.all([
    prisma.topic.upsert({
      where: { subjectId_slug: { subjectId: subjects[0].id, slug: 'phonetics' } },
      update: {},
      create: {
        subjectId: subjects[0].id,
        name: 'Phonetics',
        slug: 'phonetics',
      },
    }),
    prisma.topic.upsert({
      where: { subjectId_slug: { subjectId: subjects[0].id, slug: 'grammar' } },
      update: {},
      create: {
        subjectId: subjects[0].id,
        name: 'Grammar',
        slug: 'grammar',
      },
    }),
    prisma.topic.upsert({
      where: { subjectId_slug: { subjectId: subjects[0].id, slug: 'vocabulary' } },
      update: {},
      create: {
        subjectId: subjects[0].id,
        name: 'Vocabulary',
        slug: 'vocabulary',
      },
    }),
  ]);

  console.log(`Created ${ukrainianTopics.length} topics for Ukrainian Language`);

  // Create a sample test
  const sampleTest = await prisma.test.create({
    data: {
      subjectId: subjects[0].id,
      topicId: ukrainianTopics[0].id,
      title: 'Ukrainian Language: Phonetics Basics',
      description: 'Test your knowledge of Ukrainian phonetics',
      type: 'topic',
      estimatedTime: 30,
      isPublished: true,
      questions: {
        create: [
          {
            order: 1,
            type: 'single_choice',
            content: 'What is the correct pronunciation of "ж"?',
            points: 1,
            answers: {
              create: [
                { content: '[ʐ] - soft zh sound', order: 1, isCorrect: true },
                { content: '[ʒ] - English zh sound', order: 2, isCorrect: false },
                { content: '[dʐ] - dz sound', order: 3, isCorrect: false },
                { content: '[ʃ] - sh sound', order: 4, isCorrect: false },
              ],
            },
          },
          {
            order: 2,
            type: 'written',
            content: 'Write the Ukrainian word for "cat"',
            points: 1,
            answers: {
              create: [
                { content: 'кіт', order: 1, isCorrect: true },
              ],
            },
          },
          {
            order: 3,
            type: 'single_choice',
            content: 'Which letter is a vowel in Ukrainian?',
            points: 1,
            answers: {
              create: [
                { content: 'А', order: 1, isCorrect: true },
                { content: 'Б', order: 2, isCorrect: false },
                { content: 'В', order: 3, isCorrect: false },
                { content: 'Г', order: 4, isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`Created sample test: ${sampleTest.title}`);

  console.log('✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
