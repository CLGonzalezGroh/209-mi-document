-- CreateTable
CREATE TABLE `document_classes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `updatedById` INTEGER NOT NULL DEFAULT 1,
    `terminatedAt` DATETIME(3) NULL,
    `isSys` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `module` ENUM('QUALITY', 'PROJECTS', 'TAGS', 'OPERATIONS', 'MANAGEMENT', 'COMERCIAL') NULL,
    `description` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `document_classes_name_module_key`(`name`, `module`),
    UNIQUE INDEX `document_classes_code_module_key`(`code`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `updatedById` INTEGER NOT NULL DEFAULT 1,
    `terminatedAt` DATETIME(3) NULL,
    `isSys` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `module` ENUM('QUALITY', 'PROJECTS', 'TAGS', 'OPERATIONS', 'MANAGEMENT', 'COMERCIAL') NULL,
    `classId` INTEGER NULL,
    `description` VARCHAR(191) NULL,
    `requiresWorkflow` BOOLEAN NOT NULL DEFAULT false,

    INDEX `document_types_classId_idx`(`classId`),
    UNIQUE INDEX `document_types_name_classId_module_key`(`name`, `classId`, `module`),
    UNIQUE INDEX `document_types_code_classId_module_key`(`code`, `classId`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedById` INTEGER NOT NULL DEFAULT 1,
    `terminatedAt` DATETIME(3) NULL,
    `isSys` BOOLEAN NOT NULL DEFAULT false,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `module` ENUM('QUALITY', 'PROJECTS', 'TAGS', 'OPERATIONS', 'MANAGEMENT', 'COMERCIAL') NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` INTEGER NULL,
    `documentTypeId` INTEGER NOT NULL,

    UNIQUE INDEX `documents_code_key`(`code`),
    INDEX `documents_module_entityType_entityId_idx`(`module`, `entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NULL,
    `updatedById` INTEGER NOT NULL DEFAULT 1,
    `documentId` INTEGER NOT NULL,
    `revisionCode` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED', 'OBSOLETE') NOT NULL DEFAULT 'DRAFT',
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `document_revisions_documentId_revisionCode_key`(`documentId`, `revisionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `revisionId` INTEGER NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `fileKey` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `comment` VARCHAR(191) NULL,

    UNIQUE INDEX `document_versions_revisionId_versionNumber_key`(`revisionId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_workflows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revisionId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `initiatedById` INTEGER NOT NULL,
    `initiatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `review_workflows_revisionId_key`(`revisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `workflowId` INTEGER NOT NULL,
    `stepOrder` INTEGER NOT NULL,
    `stepType` ENUM('REVIEW', 'APPROVE', 'ACKNOWLEDGE') NOT NULL,
    `assignedToId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `comments` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `signatureHash` VARCHAR(191) NULL,

    UNIQUE INDEX `review_steps_workflowId_stepOrder_key`(`workflowId`, `stepOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transmittals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `updatedById` INTEGER NOT NULL DEFAULT 1,
    `code` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'RESPONDED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `issuedTo` VARCHAR(191) NOT NULL,
    `issuedById` INTEGER NOT NULL,
    `issuedAt` DATETIME(3) NULL,
    `responseAt` DATETIME(3) NULL,
    `responseComments` VARCHAR(191) NULL,

    UNIQUE INDEX `transmittals_code_key`(`code`),
    INDEX `transmittals_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transmittal_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transmittalId` INTEGER NOT NULL,
    `documentRevisionId` INTEGER NOT NULL,
    `purposeCode` ENUM('FOR_APPROVAL', 'FOR_INFORMATION', 'FOR_CONSTRUCTION', 'FOR_REVIEW', 'AS_BUILT') NOT NULL,
    `clientStatus` ENUM('APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED', 'REVIEWED_NO_EXCEPTION') NULL,
    `clientComments` VARCHAR(191) NULL,

    UNIQUE INDEX `transmittal_items_transmittalId_documentRevisionId_key`(`transmittalId`, `documentRevisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `scanned_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` INTEGER NOT NULL DEFAULT 1,
    `projectId` INTEGER NOT NULL,
    `documentTypeId` INTEGER NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `originalReference` VARCHAR(255) NULL,
    `physicalLocation` VARCHAR(500) NULL,
    `fileKey` VARCHAR(500) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `digitalDisposition` ENUM('PENDING', 'ACCEPTED', 'UPLOADED', 'DISCARDED') NOT NULL DEFAULT 'PENDING',
    `physicalDisposition` ENUM('PENDING', 'DESTROY', 'DESTROYED', 'ARCHIVE', 'ARCHIVED') NOT NULL DEFAULT 'PENDING',
    `externalReference` VARCHAR(500) NULL,
    `discardReason` TEXT NULL,
    `classificationNotes` TEXT NULL,
    `classifiedById` INTEGER NULL,
    `classifiedAt` DATETIME(3) NULL,
    `physicalConfirmedById` INTEGER NULL,
    `physicalConfirmedAt` DATETIME(3) NULL,
    `terminatedAt` DATETIME(3) NULL,

    INDEX `scanned_files_projectId_idx`(`projectId`),
    INDEX `scanned_files_digitalDisposition_idx`(`digitalDisposition`),
    INDEX `scanned_files_physicalDisposition_idx`(`physicalDisposition`),
    INDEX `scanned_files_projectId_digitalDisposition_idx`(`projectId`, `digitalDisposition`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_sys_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `level` ENUM('INFO', 'WARNING', 'ERROR') NOT NULL,
    `name` VARCHAR(200) NULL,
    `message` VARCHAR(2048) NOT NULL,
    `meta` TEXT NULL,

    INDEX `document_sys_logs_userId_level_createdAt_idx`(`userId`, `level`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_sys_logs_archive` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,
    `level` ENUM('INFO', 'WARNING', 'ERROR') NOT NULL,
    `name` VARCHAR(200) NULL,
    `message` VARCHAR(2048) NOT NULL,
    `meta` TEXT NULL,

    INDEX `document_sys_logs_archive_userId_level_createdAt_idx`(`userId`, `level`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document_types` ADD CONSTRAINT `document_types_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `document_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_revisions` ADD CONSTRAINT `document_revisions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_revisionId_fkey` FOREIGN KEY (`revisionId`) REFERENCES `document_revisions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_workflows` ADD CONSTRAINT `review_workflows_revisionId_fkey` FOREIGN KEY (`revisionId`) REFERENCES `document_revisions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_steps` ADD CONSTRAINT `review_steps_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `review_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transmittal_items` ADD CONSTRAINT `transmittal_items_transmittalId_fkey` FOREIGN KEY (`transmittalId`) REFERENCES `transmittals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transmittal_items` ADD CONSTRAINT `transmittal_items_documentRevisionId_fkey` FOREIGN KEY (`documentRevisionId`) REFERENCES `document_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scanned_files` ADD CONSTRAINT `scanned_files_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
