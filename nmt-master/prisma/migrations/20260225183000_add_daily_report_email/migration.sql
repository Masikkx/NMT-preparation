-- CreateTable
CREATE TABLE "daily_report_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sendHour" INTEGER NOT NULL DEFAULT 20,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    "lastSentDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_report_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_settings_userId_key" ON "daily_report_settings"("userId");

-- CreateIndex
CREATE INDEX "daily_report_logs_userId_reportDate_idx" ON "daily_report_logs"("userId", "reportDate");

-- AddForeignKey
ALTER TABLE "daily_report_settings" ADD CONSTRAINT "daily_report_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_logs" ADD CONSTRAINT "daily_report_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
