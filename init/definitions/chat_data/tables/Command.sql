CREATE TABLE IF NOT EXISTS `chat_data`.`Command` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `Name` VARCHAR(50) NOT NULL,
  `Aliases` text DEFAULT NULL COMMENT 'JSON array of strings that will be this command\'s aliases.',
  `Flags` SET('archived','block','opt-out','owner-override','ping','pipe','read-only','rollback','skip-banphrase','system','whitelist') DEFAULT NULL,
  `Description` VARCHAR(300) DEFAULT NULL,
  `Cooldown` INT(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Command cooldown given in milliseconds', 
  `Whitelist_Response` varchar(300) DEFAULT NULL COMMENT 'If the command is Whitelisted, this is the reply that will be sent to non-whitelisted users trying to invoke it.',
  `Static_Data` MEDIUMTEXT DEFAULT NULL COMMENT 'Persistent data stored as a Javascript object or function which returns an object.',
  `Code` TEXT NOT NULL COMMENT 'Javascript command code. Must be a function, ideally async function if async operations are expected. First argument is context, the rest is rest-arguments from the user, split by space.',
  `Dynamic_Description` TEXT DEFAULT NULL COMMENT 'Javascript function that returns command\'s description on website. Usually async function. First argument = command prefix (string).',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;