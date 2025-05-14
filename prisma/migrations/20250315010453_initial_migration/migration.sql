/*
  Warnings:

  - You are about to drop the column `age` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "age",
ADD COLUMN     "birth_date" TIMESTAMP(3);
