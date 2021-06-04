CREATE TABLE IF NOT EXISTS `data`.`Twitch_Lotto` (
	`Link` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Channel` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Score` DECIMAL(18,17) NULL DEFAULT NULL,
	`Available` TINYINT(1) UNSIGNED NULL DEFAULT NULL,
	`Data` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Adult_Flags` SET('Anime','Animal','Body-fluids','Disfigured','Disturbing','Drawn','Furry','Gore','Hentai','Human','Language','None','Porn','Scat','Softcore') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`Link`, `Channel`) USING BTREE,
	INDEX `FK_Twitch_Lotto_Twitch_Lotto_Channel` (`Channel`) USING BTREE,
	INDEX `Available` (`Available`) USING BTREE,
	CONSTRAINT `FK_Twitch_Lotto_Twitch_Lotto_Channel` FOREIGN KEY (`Channel`) REFERENCES `data`.`Twitch_Lotto_Channel` (`Name`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;
