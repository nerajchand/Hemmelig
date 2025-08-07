-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "title" TEXT,
    "maxViews" INTEGER NOT NULL DEFAULT 1,
    "password" TEXT,
    "allowed_ip" TEXT,
    "preventBurn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statistic" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "disable_users" BOOLEAN NOT NULL DEFAULT false,
    "disable_user_account_creation" BOOLEAN NOT NULL DEFAULT false,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "disable_file_upload" BOOLEAN NOT NULL DEFAULT false,
    "hide_allowed_ip_input" BOOLEAN NOT NULL DEFAULT false,
    "restrict_organization_email" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorAnalytics" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "uniqueId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_id_key" ON "File"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_id_key" ON "Secret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorAnalytics_id_key" ON "VisitorAnalytics"("id");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
