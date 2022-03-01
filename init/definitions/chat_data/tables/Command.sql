CREATE TABLE IF NOT EXISTS `chat_data`.`Command` (
	`Name` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Aliases` TEXT(65535) NULL DEFAULT NULL COMMENT 'JSON array of strings that will be this command\'s aliases.' COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY `Name` (`Name`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4;;
