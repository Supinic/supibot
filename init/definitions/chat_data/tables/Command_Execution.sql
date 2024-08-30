CREATE TABLE IF NOT EXISTS `chat_data`.`Command_Execution` (
  `Executed` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `User_Alias` INT(10) UNSIGNED NOT NULL,
  `Command` VARCHAR(50) NOT NULL,
  `Platform` INT(10) UNSIGNED NOT NULL,
  `Channel` INT(10) UNSIGNED NULL DEFAULT NULL,
  `Execution_Time` DECIMAL(10,3) UNSIGNED NULL DEFAULT NULL,
  `Success` TINYINT(1) UNSIGNED NOT NULL,
  `Invocation` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
  `Arguments` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
  `Result` VARCHAR(300) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
  PRIMARY KEY (`User_Alias`, `Command`, `Executed`, `Platform`) USING BTREE,
  INDEX `Command_Execution_Platform` (`Platform`) USING BTREE,
  INDEX `Command_Execution_Command` (`Command`) USING BTREE,
  INDEX `FK_Command_Execution_Channel` (`Channel`) USING BTREE,
  INDEX `Executed` (`Executed`) USING BTREE,
  CONSTRAINT `FK_Command_Execution_Channel` FOREIGN KEY (`Channel`) REFERENCES `chat_data`.`Channel` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `FK_Command_Execution_User_Alias` FOREIGN KEY (`User_Alias`) REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
