CREATE TABLE IF NOT EXISTS `chat_data`.`User_Alias_Data` (
	`User_Alias` INT(10) UNSIGNED NOT NULL,
	`Property` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Value` MEDIUMTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`User_Alias`, `Property`) USING BTREE,
	INDEX `FK_User_Data_User_Data_Property` (`Property`) USING BTREE,
	CONSTRAINT `FK_User_Data_User_Alias` FOREIGN KEY (`User_Alias`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `FK_User_Data_User_Data_Property` FOREIGN KEY (`Property`) REFERENCES `chat_data`.`Custom_Data_Property` (`Name`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
