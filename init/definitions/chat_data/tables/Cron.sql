CREATE TABLE IF NOT EXISTS `chat_data`.`Cron` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Name` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Expression` VARCHAR(50) NOT NULL COMMENT 'Cron time expression. WARNING! Uses 6 time slots (instead of standard 5) in this order: seconds, minutes, hours, day-of-month, month, day-of-week.' COLLATE 'utf8mb4_general_ci',
	`Description` TEXT(65535) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Defer` TEXT(65535) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Code` TEXT(65535) NOT NULL COMMENT 'Javascript code of given cron job.' COLLATE 'utf8mb4_general_ci',
	`Type` ENUM('All','Website','Bot') NOT NULL COMMENT 'Determines in which project context should the job be executed.' COLLATE 'utf8mb4_general_ci',
	`Active` TINYINT(1) UNSIGNED NOT NULL DEFAULT '1',
	`Last_Edit` DATETIME NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	`Latest_Commit` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `Name` (`Name`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;
