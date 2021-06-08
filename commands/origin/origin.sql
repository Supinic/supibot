CREATE TABLE IF NOT EXISTS `data`.`Origin` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Emote_ID` VARCHAR(64) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Name` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Text` VARCHAR(500) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Tier` ENUM('1','2','3','1000','5000','10000','25000','50000') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
    `Type` ENUM('7TV - Channel','7TV - Global','BTTV - Channel','BTTV - Global','Discord','FFZ - Channel','FFZ - Global','Other','Twitch - Bits','Twitch - Follower','Twitch - Global','Twitch - Sub') NULL DEFAULT 'Twitch - Global' COLLATE 'utf8mb4_general_ci',
	`Raffle` DATE NULL DEFAULT NULL,
	`Raffle_Winner` INT(11) NULL DEFAULT NULL,
	`User_Alias` INT(11) NOT NULL DEFAULT '1',
	`Author` INT(11) NULL DEFAULT NULL,
	`Todo` TINYINT(1) NOT NULL DEFAULT '0',
	`Replaced` TINYINT(1) NOT NULL DEFAULT '0',
	`Emote_Added` DATE NULL DEFAULT NULL,
	`Record_Added` DATETIME NULL DEFAULT current_timestamp(),
	`Notes` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Available` ENUM('Backup','Local','None','Original') NULL DEFAULT 'Original' COLLATE 'utf8mb4_general_ci',
	`Backup_Link` VARCHAR(300) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `Emote_ID` (`Emote_ID`) USING BTREE,
	INDEX `fk_user_alias_origin` (`User_Alias`) USING BTREE,
	INDEX `FK_Origin_chat_data.User_Alias` (`Raffle_Winner`) USING BTREE,
	INDEX `FK_Origin_chat_data.User_Alias_2` (`Author`) USING BTREE,
	CONSTRAINT `FK_Origin_chat_data.User_Alias` FOREIGN KEY (`Raffle_Winner`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT `FK_Origin_chat_data.User_Alias_2` FOREIGN KEY (`Author`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT `fk_user_alias_origin` FOREIGN KEY (`User_Alias`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
