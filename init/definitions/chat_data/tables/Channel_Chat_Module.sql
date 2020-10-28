CREATE TABLE IF NOT EXISTS `chat_data`.`Channel_Chat_Module` (
	`Channel` INT(10) UNSIGNED NOT NULL,
	`Chat_Module` INT(10) UNSIGNED NOT NULL,
	`Specific_Arguments` TEXT(65535) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Notes` TEXT(65535) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Created` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
	`Last_Edit` DATETIME(3) NULL DEFAULT NULL ON UPDATE current_timestamp(3),
	PRIMARY KEY (`Channel`, `Chat_Module`) USING BTREE,
	INDEX `FK_Channel_Chat_Module_Chat_Module` (`Chat_Module`) USING BTREE,
	CONSTRAINT `FK_Channel_Chat_Module_Channel` FOREIGN KEY (`Channel`) REFERENCES `chat_data`.`Channel` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `FK_Channel_Chat_Module_Chat_Module` FOREIGN KEY (`Chat_Module`) REFERENCES `chat_data`.`Chat_Module` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB;
