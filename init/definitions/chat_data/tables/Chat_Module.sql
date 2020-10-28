CREATE TABLE IF NOT EXISTS `chat_data`.`Chat_Module` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Name` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Events` TEXT(65535) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Description` TEXT(65535) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Active` TINYINT(1) UNSIGNED NOT NULL DEFAULT '1',
	`Global` TINYINT(1) UNSIGNED NOT NULL DEFAULT '0',
	`Platform` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Code` TEXT(65535) NOT NULL DEFAULT '' COLLATE 'utf8mb4_general_ci',
	`Author` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Created` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
	`Last_Edit` DATETIME(3) NULL DEFAULT NULL ON UPDATE current_timestamp(3),
	`Latest_Commit` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `Name` (`Name`) USING BTREE,
	INDEX `FK_Chat_Module_Platform` (`Platform`) USING BTREE,
	CONSTRAINT `FK_Chat_Module_Platform` FOREIGN KEY (`Platform`) REFERENCES `chat_data`.`Platform` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;
