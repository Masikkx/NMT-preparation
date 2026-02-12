-- CreateTable
CREATE TABLE "daily_plan_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_plan_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "studiedDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewPlanItemId" TEXT NOT NULL,
    "reviewDate" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_plan_tasks_userId_date_idx" ON "daily_plan_tasks"("userId", "date");

-- CreateIndex
CREATE INDEX "review_plan_items_userId_studiedDate_idx" ON "review_plan_items"("userId", "studiedDate");

-- CreateIndex
CREATE UNIQUE INDEX "review_completions_userId_reviewPlanItemId_reviewDate_intervalDays_key" ON "review_completions"("userId", "reviewPlanItemId", "reviewDate", "intervalDays");

-- CreateIndex
CREATE INDEX "review_completions_userId_reviewDate_idx" ON "review_completions"("userId", "reviewDate");

-- AddForeignKey
ALTER TABLE "daily_plan_tasks" ADD CONSTRAINT "daily_plan_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_plan_items" ADD CONSTRAINT "review_plan_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_completions" ADD CONSTRAINT "review_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_completions" ADD CONSTRAINT "review_completions_reviewPlanItemId_fkey" FOREIGN KEY ("reviewPlanItemId") REFERENCES "review_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
