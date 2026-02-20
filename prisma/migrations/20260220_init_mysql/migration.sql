-- CreateTable
CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `district` VARCHAR(191) NULL,
  `thana` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `passwordHash` VARCHAR(191) NULL,
  `provider` ENUM('LOCAL', 'GOOGLE') NOT NULL DEFAULT 'LOCAL',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_phone_idx`(`phone`),
  INDEX `User_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
  `id` VARCHAR(191) NOT NULL,
  `orderNumber` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NOT NULL,
  `district` VARCHAR(191) NOT NULL,
  `thana` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NOT NULL,
  `productUrl` VARCHAR(191) NULL,
  `imageUrl` VARCHAR(191) NULL,
  `quantity` INTEGER NOT NULL,
  `unitPrice` DECIMAL(12, 2) NULL,
  `subtotal` DECIMAL(12, 2) NULL,
  `shipping` DECIMAL(12, 2) NULL,
  `discount` DECIMAL(12, 2) NULL,
  `total` DECIMAL(12, 2) NULL,
  `notes` TEXT NULL,
  `status` ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Order_orderNumber_key`(`orderNumber`),
  UNIQUE INDEX `Order_orderId_key`(`orderId`),
  INDEX `Order_email_idx`(`email`),
  INDEX `Order_phone_idx`(`phone`),
  INDEX `Order_status_idx`(`status`),
  INDEX `Order_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `consent` BOOLEAN NOT NULL DEFAULT false,
  `source` VARCHAR(191) NOT NULL DEFAULT 'footer',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Subscription_email_key`(`email`),
  INDEX `Subscription_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Order`
ADD CONSTRAINT `Order_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE SET NULL
ON UPDATE CASCADE;
