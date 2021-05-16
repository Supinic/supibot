CREATE TABLE IF NOT EXISTS `data`.`Bad_Apple` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Link` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Device` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Status` ENUM('Approved','Denied','Pending approval') NOT NULL COLLATE 'utf8mb4_general_ci',
	`Type` ENUM('Calculator','Computer','Console','IRL','Meme','Meta','Software','Technology') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Published` DATE NULL DEFAULT NULL,
	`Width` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Height` INT(10) UNSIGNED NULL DEFAULT NULL,
	`FPS` DECIMAL(5,2) UNSIGNED NULL DEFAULT NULL,
	`Timestamp` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Reuploads` MEDIUMTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Notes` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `Link` (`Link`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
