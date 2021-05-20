CREATE TABLE IF NOT EXISTS `data`.`Suggestion` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`User_Alias` INT(11) NULL DEFAULT NULL COMMENT 'Author of the suggestion',
	`Text` TEXT NOT NULL COLLATE 'utf8mb4_general_ci' COMMENT 'Suggestion body',
	`Date` DATETIME NOT NULL DEFAULT current_timestamp() COMMENT 'Suggestion\'s creation datetime',
	`Category` ENUM('Bot','Bot addition','Data','Legacy','Other','Other - code','SPM','Supi-core','Void','Website') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Status` ENUM('Approved','Blocked','Completed','Moved to Github','Denied','Dismissed','Dismissed by author','Duplicate','Outsourced','Quarantined') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Priority` SMALLINT(5) UNSIGNED NULL DEFAULT NULL,
	`Notes` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Last_Update` DATETIME NULL DEFAULT NULL ON UPDATE current_timestamp(),
	`Github_Link` VARCHAR(200) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci' COMMENT 'If the suggestion has a reference to an external site, this its link. Omits "https:"',
	PRIMARY KEY (`ID`) USING BTREE,
	INDEX `fk_suggestion_user_alias` (`User_Alias`) USING BTREE,
	CONSTRAINT `fk_suggestion_user_alias` FOREIGN KEY (`User_Alias`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
CHARSET=utf8mb4
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;