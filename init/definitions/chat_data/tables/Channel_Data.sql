CREATE TABLE IF NOT EXISTS `chat_data`.`Channel_Data` (
	`Channel` INT(10) UNSIGNED NOT NULL,
	`Property` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Value` MEDIUMTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Created` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
	`Edited` DATETIME(3) NULL DEFAULT NULL ON UPDATE current_timestamp(3),
	PRIMARY KEY (`Channel`, `Property`) USING BTREE,
	INDEX `FK_Channel_Data_Custom_Data_Property` (`Property`) USING BTREE,
	CONSTRAINT `FK_Channel_Data_Channel` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `FK_Channel_Data_Custom_Data_Property` FOREIGN KEY (`Property`) REFERENCES `Custom_Data_Property` (`Name`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
