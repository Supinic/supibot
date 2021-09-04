CREATE TABLE IF NOT EXISTS `chat_data`.`Custom_Data_Property` (
	`Name` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Type` ENUM('array','boolean','date','function','number','object','regex','string') NOT NULL COLLATE 'utf8mb4_general_ci',
	`Target` SET('Channel','User') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`Name`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
