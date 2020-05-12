CREATE TABLE IF NOT EXISTS `chat_data`.`AFK` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `User_Alias` INT(10) UNSIGNED NOT NULL COMMENT 'The user who\'s AFK status is being tracked',
  `Started` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `Ended` DATETIME(3) NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  `Text` VARCHAR(2000) DEFAULT NULL,
  `Status` enum('afk','poop','gn','brb','shower','lurk','food','work','ppPoof','study') DEFAULT NULL COMMENT 'So-called "status" of the AFK. Can be tied to multiple actions',
  `Active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether ot not is the AFK status still active',
  `Silent` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'If an AFK status is silent, this means its deactivation whill not be announced in chat. Usually set by external means.',
  `Interrupted_ID` INT(10) UNSIGNED DEFAULT NULL COMMENT 'If an AFK has been deactivated, but then re-activated, this is the ID of the original status.',
  PRIMARY KEY (`ID`),
  KEY `AFK_ibfk_1` (`User_Alias`),
  KEY `FK_AFK_AFK` (`Interrupted_ID`),
  KEY `Active_Lookup` (`Active`),
  CONSTRAINT `AFK_ibfk_1` FOREIGN KEY (`User_Alias`) REFERENCES `User_Alias` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_AFK_AFK` FOREIGN KEY (`Interrupted_ID`) REFERENCES `AFK` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;