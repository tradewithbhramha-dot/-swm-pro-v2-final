CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entity` varchar(100) NOT NULL,
	`entityId` int,
	`oldValues` json,
	`newValues` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collection_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wardId` int NOT NULL,
	`pointName` varchar(255),
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(11,8) NOT NULL,
	`qrId` varchar(100) NOT NULL,
	`qrCodeData` text,
	`registeredByUserId` int,
	`isPermanent` boolean DEFAULT true,
	`lastImei` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_points_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_points_qrId_unique` UNIQUE(`qrId`)
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`photoMandatory` boolean DEFAULT false,
	`antiSpoofingEnabled` boolean DEFAULT true,
	`mockLocationBlockerEnabled` boolean DEFAULT true,
	`gpsRadiusMeters` int DEFAULT 10,
	`drainageOverlapThreshold` decimal(5,2) DEFAULT '90.00',
	`depotDwellThresholdMinutes` int DEFAULT 5,
	`dailyResetHour` int DEFAULT 17,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `countries_id` PRIMARY KEY(`id`),
	CONSTRAINT `countries_name_unique` UNIQUE(`name`),
	CONSTRAINT `countries_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `daily_point_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointId` int NOT NULL,
	`statusDate` timestamp NOT NULL,
	`status` enum('RED','GREEN') NOT NULL DEFAULT 'RED',
	`collectedByUserId` int,
	`collectedAt` timestamp,
	`scannedAt` timestamp,
	`photoUrl` text,
	`imei` varchar(50),
	`imeiVerified` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_point_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_daily_status_point_date` UNIQUE(`pointId`,`statusDate`)
);
--> statement-breakpoint
CREATE TABLE `depots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wardId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(11,8) NOT NULL,
	`radiusMeters` int DEFAULT 50,
	`tripCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `depots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `districts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stateId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `districts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drainage_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wardId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`lineGeoJson` json NOT NULL,
	`length` decimal(12,2),
	`priority` enum('high','medium','low') DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drainage_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geofence_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depotId` int NOT NULL,
	`userId` int NOT NULL,
	`eventType` enum('entry','exit','dwell') NOT NULL,
	`eventTime` timestamp NOT NULL,
	`dwellDuration` int,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`tripIncremented` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geofence_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `villages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`talukaId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`boundaryGeoJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `villages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qr_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointId` int NOT NULL,
	`userId` int NOT NULL,
	`scannedAt` timestamp NOT NULL,
	`scanStatus` enum('success','failed','out_of_range','spoofed') NOT NULL,
	`workerLatitude` decimal(10,8) NOT NULL,
	`workerLongitude` decimal(11,8) NOT NULL,
	`distanceFromPoint` decimal(10,2),
	`isWithinRadius` boolean NOT NULL,
	`imei` varchar(50),
	`imeiMatches` boolean DEFAULT false,
	`isMockLocation` boolean DEFAULT false,
	`accuracy` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qr_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generatedByUserId` int NOT NULL,
	`reportType` enum('daily_collection','weekly_performance','monthly_summary','worker_performance','drainage_coverage','depot_trips') NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`pdfUrl` text,
	`excelUrl` text,
	`status` enum('pending','generated','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reset_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resetDate` timestamp NOT NULL,
	`resetTime` timestamp NOT NULL,
	`pointsResetCount` int,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reset_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `reset_logs_resetDate_unique` UNIQUE(`resetDate`)
);
--> statement-breakpoint
CREATE TABLE `states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countryId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `states_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_states_name_country` UNIQUE(`countryId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `talukas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`districtId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `talukas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`villageId` int NOT NULL,
	`wardNumber` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`boundaryGeoJson` json NOT NULL,
	`centerLatitude` decimal(10,8),
	`centerLongitude` decimal(11,8),
	`isAutoGenerated` boolean DEFAULT false,
	`generatedAt` timestamp,
	`qrId` varchar(100),
	`qrCodeData` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wards_id` PRIMARY KEY(`id`),
	CONSTRAINT `wards_qrId_unique` UNIQUE(`qrId`),
	CONSTRAINT `idx_wards_number_village` UNIQUE(`villageId`,`wardNumber`)
);
--> statement-breakpoint
CREATE TABLE `work_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wardId` int NOT NULL,
	`moduleType` enum('door_to_door','road_sweeping','drainage','depot_geofencing') NOT NULL,
	`status` enum('pending','in_progress','completed','rejected') NOT NULL DEFAULT 'pending',
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`gpsTrailGeoJson` json,
	`totalDistance` decimal(12,2),
	`qrScansCount` int DEFAULT 0,
	`pointsCollected` int DEFAULT 0,
	`moduleData` json,
	`photoUrl` text,
	`photoRequired` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `worker_trails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workLogId` int NOT NULL,
	`userId` int NOT NULL,
	`trailGeoJson` json NOT NULL,
	`drainageLineId` int,
	`overlapPercentage` decimal(5,2),
	`isAutoCompleted` boolean DEFAULT false,
	`swarmGroupId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worker_trails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','worker','supervisor') NOT NULL DEFAULT 'worker';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `otpSecret` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `pin` varchar(4);--> statement-breakpoint
ALTER TABLE `users` ADD `pinAttempts` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `pinLockedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `locationId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `wardId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `depotId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `lastLocationUpdate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `lastLatitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `users` ADD `lastLongitude` decimal(11,8);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phone_unique` UNIQUE(`phone`);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_points` ADD CONSTRAINT `collection_points_wardId_wards_id_fk` FOREIGN KEY (`wardId`) REFERENCES `wards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_points` ADD CONSTRAINT `collection_points_registeredByUserId_users_id_fk` FOREIGN KEY (`registeredByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_point_status` ADD CONSTRAINT `daily_point_status_pointId_collection_points_id_fk` FOREIGN KEY (`pointId`) REFERENCES `collection_points`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_point_status` ADD CONSTRAINT `daily_point_status_collectedByUserId_users_id_fk` FOREIGN KEY (`collectedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `depots` ADD CONSTRAINT `depots_wardId_wards_id_fk` FOREIGN KEY (`wardId`) REFERENCES `wards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `districts` ADD CONSTRAINT `districts_stateId_states_id_fk` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drainage_lines` ADD CONSTRAINT `drainage_lines_wardId_wards_id_fk` FOREIGN KEY (`wardId`) REFERENCES `wards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `geofence_events` ADD CONSTRAINT `geofence_events_depotId_depots_id_fk` FOREIGN KEY (`depotId`) REFERENCES `depots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `geofence_events` ADD CONSTRAINT `geofence_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `villages` ADD CONSTRAINT `villages_talukaId_talukas_id_fk` FOREIGN KEY (`talukaId`) REFERENCES `talukas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qr_scans` ADD CONSTRAINT `qr_scans_pointId_collection_points_id_fk` FOREIGN KEY (`pointId`) REFERENCES `collection_points`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qr_scans` ADD CONSTRAINT `qr_scans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_generatedByUserId_users_id_fk` FOREIGN KEY (`generatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `states` ADD CONSTRAINT `states_countryId_countries_id_fk` FOREIGN KEY (`countryId`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `talukas` ADD CONSTRAINT `talukas_districtId_districts_id_fk` FOREIGN KEY (`districtId`) REFERENCES `districts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wards` ADD CONSTRAINT `wards_villageId_villages_id_fk` FOREIGN KEY (`villageId`) REFERENCES `villages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_logs` ADD CONSTRAINT `work_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_logs` ADD CONSTRAINT `work_logs_wardId_wards_id_fk` FOREIGN KEY (`wardId`) REFERENCES `wards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_trails` ADD CONSTRAINT `worker_trails_workLogId_work_logs_id_fk` FOREIGN KEY (`workLogId`) REFERENCES `work_logs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_trails` ADD CONSTRAINT `worker_trails_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_trails` ADD CONSTRAINT `worker_trails_drainageLineId_drainage_lines_id_fk` FOREIGN KEY (`drainageLineId`) REFERENCES `drainage_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity`,`entityId`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_date` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_collection_points_ward` ON `collection_points` (`wardId`);--> statement-breakpoint
CREATE INDEX `idx_collection_points_qr` ON `collection_points` (`qrId`);--> statement-breakpoint
CREATE INDEX `idx_collection_points_coords` ON `collection_points` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_daily_status_date` ON `daily_point_status` (`statusDate`);--> statement-breakpoint
CREATE INDEX `idx_daily_status_user` ON `daily_point_status` (`collectedByUserId`);--> statement-breakpoint
CREATE INDEX `idx_depots_ward` ON `depots` (`wardId`);--> statement-breakpoint
CREATE INDEX `idx_districts_state` ON `districts` (`stateId`);--> statement-breakpoint
CREATE INDEX `idx_drainage_lines_ward` ON `drainage_lines` (`wardId`);--> statement-breakpoint
CREATE INDEX `idx_geofence_events_depot` ON `geofence_events` (`depotId`);--> statement-breakpoint
CREATE INDEX `idx_geofence_events_user` ON `geofence_events` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_geofence_events_time` ON `geofence_events` (`eventTime`);--> statement-breakpoint
CREATE INDEX `idx_villages_taluka` ON `villages` (`talukaId`);--> statement-breakpoint
CREATE INDEX `idx_qr_scans_point` ON `qr_scans` (`pointId`);--> statement-breakpoint
CREATE INDEX `idx_qr_scans_user` ON `qr_scans` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_qr_scans_timestamp` ON `qr_scans` (`scannedAt`);--> statement-breakpoint
CREATE INDEX `idx_reports_user` ON `reports` (`generatedByUserId`);--> statement-breakpoint
CREATE INDEX `idx_reports_type` ON `reports` (`reportType`);--> statement-breakpoint
CREATE INDEX `idx_reset_logs_date` ON `reset_logs` (`resetDate`);--> statement-breakpoint
CREATE INDEX `idx_states_country` ON `states` (`countryId`);--> statement-breakpoint
CREATE INDEX `idx_talukas_district` ON `talukas` (`districtId`);--> statement-breakpoint
CREATE INDEX `idx_wards_village` ON `wards` (`villageId`);--> statement-breakpoint
CREATE INDEX `idx_wards_qr` ON `wards` (`qrId`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_user` ON `work_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_ward` ON `work_logs` (`wardId`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_module` ON `work_logs` (`moduleType`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_date` ON `work_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_worker_trails_worklog` ON `worker_trails` (`workLogId`);--> statement-breakpoint
CREATE INDEX `idx_worker_trails_user` ON `worker_trails` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_worker_trails_drainage` ON `worker_trails` (`drainageLineId`);--> statement-breakpoint
CREATE INDEX `idx_worker_trails_swarm` ON `worker_trails` (`swarmGroupId`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_ward` ON `users` (`wardId`);