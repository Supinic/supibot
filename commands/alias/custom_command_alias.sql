CREATE TABLE IF NOT EXISTS `data`.`Custom_Command_Alias` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`User_Alias` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Channel` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Name` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Command` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Invocation` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Arguments` MEDIUMTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Description` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Parent` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Created` DATETIME(3) NULL DEFAULT current_timestamp(3),
	`Edited` DATETIME(3) NULL DEFAULT NULL ON UPDATE current_timestamp(3),
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `User_Channel_Name` (`User_Alias`, `Channel`, `Name`) USING BTREE,
	INDEX `FK_Custom_Command_Alias_Channel` (`Channel`) USING BTREE,
	INDEX `FK_Custom_Command_Alias_Command` (`Command`) USING BTREE,
	INDEX `FK_Custom_Command_Alias_Custom_Command_Alias` (`Parent`) USING BTREE,
	CONSTRAINT `Custom_Command_Alias_ibfk_1` FOREIGN KEY (`Channel`) REFERENCES `chat_data`.`Channel` (`ID`) ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT `Custom_Command_Alias_ibfk_2` FOREIGN KEY (`Command`) REFERENCES `chat_data`.`Command` (`Name`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `Custom_Command_Alias_ibfk_4` FOREIGN KEY (`User_Alias`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT `FK_Custom_Command_Alias_data.Custom_Command_Alias` FOREIGN KEY (`Parent`) REFERENCES `data`.`Custom_Command_Alias` (`ID`) ON UPDATE CASCADE ON DELETE SET NULL
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
