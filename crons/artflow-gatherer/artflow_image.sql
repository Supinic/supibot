CREATE TABLE `Artflow_Image` (
	`Filename` VARCHAR(32) NOT NULL COLLATE 'utf8mb4_general_ci',
	`ID` VARCHAR(10) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Prompt` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Upload_Link` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`Filename`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
