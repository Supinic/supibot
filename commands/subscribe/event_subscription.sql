CREATE TABLE IF NOT EXISTS `data`.`Event_Subscription` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`User_Alias` INT(11) NOT NULL,
	`Channel` INT(10) UNSIGNED NULL DEFAULT NULL,
	`Platform` INT(11) UNSIGNED NOT NULL,
	`Type` ENUM('Gachi','Node.js updates','Suggestion','GGG tracker','Channel live','Changelog','Runelite','OSRS','Rust') NOT NULL COLLATE 'utf8mb4_general_ci',
	`Data` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_bin',
	`Active` TINYINT(1) UNSIGNED NOT NULL DEFAULT '1',
	`Created` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
	`Last_Edit` DATETIME(3) NULL DEFAULT NULL ON UPDATE current_timestamp(3),
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `User_Alias_Event` (`User_Alias`, `Type`) USING BTREE,
	INDEX `FK_Event_Subscription_Channel` (`Channel`) USING BTREE,
	INDEX `FK_Event_Subscription_chat_data.Platform` (`Platform`) USING BTREE,
	CONSTRAINT `Event_Subscription_ibfk_1` FOREIGN KEY (`Channel`) REFERENCES `chat_data`.`Channel` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `Event_Subscription_ibfk_2` FOREIGN KEY (`User_Alias`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `Event_Subscription_ibfk_3` FOREIGN KEY (`Platform`) REFERENCES `chat_data`.`Platform` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
CHARSET=utf8mb4
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;
