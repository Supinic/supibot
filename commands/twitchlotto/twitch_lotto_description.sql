CREATE TABLE `Twitch_Lotto_Description` (
	`Link` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`User_Alias` INT(11) NOT NULL,
	`Channel` INT(11) UNSIGNED NOT NULL,
	`Text` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Created` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
	`Edited` DATETIME(3) NULL DEFAULT NULL ON UPDATE current_timestamp(3),
	PRIMARY KEY (`Link`, `User_Alias`, `Channel`) USING BTREE,
	CONSTRAINT `FK_Twitch_Lotto_Description_Twitch_Lotto` FOREIGN KEY (`Link`) REFERENCES `data`.`Twitch_Lotto` (`Link`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
