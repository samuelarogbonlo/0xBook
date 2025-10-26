/*
  Warnings:

  - You are about to drop the column `userId` on the `Action` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Position` table. All the data in the column will be lost.
  - Added the required column `userAddress` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userAddress` to the `Position` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceChain" TEXT,
    "destChain" TEXT,
    "amount" TEXT NOT NULL,
    "costPYUSD" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "transferId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Action_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Action" ("amount", "completedAt", "costPYUSD", "createdAt", "destChain", "errorMessage", "id", "sourceChain", "status", "transferId", "txHash", "type") SELECT "amount", "completedAt", "costPYUSD", "createdAt", "destChain", "errorMessage", "id", "sourceChain", "status", "transferId", "txHash", "type" FROM "Action";
DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";
CREATE INDEX "Action_userAddress_idx" ON "Action"("userAddress");
CREATE INDEX "Action_status_idx" ON "Action"("status");
CREATE INDEX "Action_createdAt_idx" ON "Action"("createdAt");
CREATE TABLE "new_Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAddress" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "collateralToken" TEXT NOT NULL,
    "collateralAmount" TEXT NOT NULL,
    "collateralValueUSD" REAL NOT NULL,
    "debtToken" TEXT NOT NULL,
    "debtAmount" TEXT NOT NULL,
    "debtValueUSD" REAL NOT NULL,
    "healthFactor" REAL NOT NULL,
    "liquidationThreshold" REAL NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Position_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Position" ("chain", "collateralAmount", "collateralToken", "collateralValueUSD", "debtAmount", "debtToken", "debtValueUSD", "healthFactor", "id", "lastUpdated", "liquidationThreshold", "protocol") SELECT "chain", "collateralAmount", "collateralToken", "collateralValueUSD", "debtAmount", "debtToken", "debtValueUSD", "healthFactor", "id", "lastUpdated", "liquidationThreshold", "protocol" FROM "Position";
DROP TABLE "Position";
ALTER TABLE "new_Position" RENAME TO "Position";
CREATE INDEX "Position_userAddress_idx" ON "Position"("userAddress");
CREATE INDEX "Position_chain_idx" ON "Position"("chain");
CREATE INDEX "Position_healthFactor_idx" ON "Position"("healthFactor");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
