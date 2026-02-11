-- CreateTable
CREATE TABLE `attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `module` ENUM('QUALITY', 'PROJECTS', 'TAGS', 'OPERATIONS', 'MANAGEMENT', 'COMERCIAL') NOT NULL,
    `entityType` VARCHAR(100) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `fileKey` VARCHAR(500) NOT NULL,
    `fileName` VARCHAR(300) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,

    INDEX `attachments_module_entityType_entityId_idx`(`module`, `entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
