CREATE TABLE IF NOT EXISTS `chat_data`.`Banphrase_API_Denial_Log` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Message` MEDIUMTEXT NOT NULL COLLATE 'utf8mb4_general_ci',
	`Response` MEDIUMTEXT NOT NULL COLLATE 'utf8mb4_general_ci',
	`Channel` INT(10) UNSIGNED NOT NULL,
	`Platform` INT(10) UNSIGNED NOT NULL,
	`API` VARCHAR(128) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Timestamp` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `FK_Banphrase_API_Denial_Log_Channel` (`Channel`) USING BTREE,
	INDEX `FK_Banphrase_API_Denial_Log_Platform` (`Platform`) USING BTREE,
	CONSTRAINT `FK_Banphrase_API_Denial_Log_Channel` FOREIGN KEY (`Channel`) REFERENCES `chat_data`.`Channel` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `FK_Banphrase_API_Denial_Log_Platform` FOREIGN KEY (`Platform`) REFERENCES `chat_data`.`Platform` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;
