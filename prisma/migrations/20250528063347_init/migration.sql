-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otpExpires" TIMESTAMP(3),
ADD COLUMN     "resetExpires" TIMESTAMP(3),
ADD COLUMN     "resetOtp" TEXT;
