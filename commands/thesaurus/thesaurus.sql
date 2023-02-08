CREATE TABLE IF NOT EXISTS `data`.`Thesaurus` (
	`Word` VARCHAR(200) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Result` LONGTEXT NOT NULL DEFAULT '' COLLATE 'utf8mb4_bin',
	PRIMARY KEY (`Word`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;