-- Admin alohida o'quvchiga barcha videodarslarni ochadi. Standart — o'chiq (mavjud foydalanuvchilarga ta'sir yo'q).
ALTER TABLE "User" ADD COLUMN "videosUnlocked" BOOLEAN NOT NULL DEFAULT false;
