CREATE TABLE IF NOT EXISTS `chat_data`.`AFK` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `User_Alias` INT(10) UNSIGNED NOT NULL COMMENT 'The user who is AFK',
  `Started` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `Ended` DATETIME(3) NULL DEFAULT NULL,
  `Text` VARCHAR(2000) DEFAULT NULL,
  `Status` enum('afk','poop','gn','brb','shower','lurk','food','work','nap','study','ppPoof') NOT NULL DEFAULT 'afk' COMMENT 'So-called "status" of the AFK. Can be tied to multiple actions',
  `Active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether the AFK status is active',
  `Interrupted_ID` INT(10) UNSIGNED DEFAULT NULL COMMENT 'If an AFK has been deactivated, but then re-activated, this is the ID of the original status.',
  `Duration_MS` BIGINT UNSIGNED AS (TIMESTAMPDIFF(MICROSECOND, `Started`, `Ended`) DIV 1000) STORED COMMENT 'Duration of each AFK status, in milliseconds. Used for statistics queries.',
  PRIMARY KEY (`ID`),
  KEY `AFK_FK_User_Alias` (`User_Alias`),
  KEY `AFK_Self_Interrupted` (`Interrupted_ID`),
  KEY `AFK_Active_Lookup` (`Active`),
  KEY `AFK_Longest_User_Duration` (`User_Alias`, `Interrupted_ID`, `Duration_MS`),
  CONSTRAINT `FK_User_Alias` FOREIGN KEY (`User_Alias`) REFERENCES `User_Alias` (`ID`),
  CONSTRAINT `Self_Interrupted` FOREIGN KEY (`Interrupted_ID`) REFERENCES `AFK` (`ID`),
  CONSTRAINT `Check_Ended_After_Started` CHECK (`Ended` IS NULL OR `Ended` >= `Started`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
