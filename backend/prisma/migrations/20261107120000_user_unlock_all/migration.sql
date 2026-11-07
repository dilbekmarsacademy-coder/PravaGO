-- Admin alohida o'quvchiga hamma narsani ochib qo'yishi mumkin (standart — o'chiq, mavjud foydalanuvchilar o'zgarmaydi).
ALTER TABLE "User" ADD COLUMN "unlockAll" BOOLEAN NOT NULL DEFAULT false;
