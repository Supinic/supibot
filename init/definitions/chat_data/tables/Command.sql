CREATE TABLE IF NOT EXISTS `chat_data`.`Command` (
	`ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Name` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
	`Aliases` TEXT(65535) NULL DEFAULT NULL COMMENT 'JSON array of strings that will be this command\'s aliases.' COLLATE 'utf8mb4_general_ci',
	`Flags` SET('archived','block','developer','link-only','mention','opt-out','owner-override','ping','pipe','read-only','rollback','skip-banphrase','system','use-params','whitelist') NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
    `Params` TEXT NULL DEFAULT NULL COMMENT 'JSON object with the definition of the command\'s parameters.' COLLATE 'utf8mb4_general_ci',
	`Description` VARCHAR(300) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Cooldown` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Command cooldown given in milliseconds',
	`Whitelist_Response` VARCHAR(300) NULL DEFAULT NULL COMMENT 'If the command is Whietlisted, this is the reply that will be sent to non-whitelisted users trying to invoke it.' COLLATE 'utf8mb4_general_ci',
	`Static_Data` MEDIUMTEXT NULL DEFAULT NULL COMMENT 'Persistent data stored as a Javascript object.' COLLATE 'utf8mb4_general_ci',
	`Code` TEXT(65535) NOT NULL COMMENT 'Javascript command code. Must be a function, ideally async function if async operations are expected. First argument is context, the rest is rest-arguments from the user, split by space.' COLLATE 'utf8mb4_general_ci',
	`Dynamic_Description` TEXT(65535) NULL DEFAULT NULL COMMENT 'Javascript function that returns command\'s description on website. Usually async function. First argument = command prefix (string).' COLLATE 'utf8mb4_general_ci',
	`Author` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	`Last_Edit` DATETIME NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	`Latest_Commit` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
	PRIMARY KEY (`ID`) USING BTREE,
	UNIQUE INDEX `Name` (`Name`) USING BTREE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4;;
