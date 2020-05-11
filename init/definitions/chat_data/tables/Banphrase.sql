CREATE TABLE IF NOT EXISTS `chat_data`.`Banphrase` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `Code` TEXT NOT NULL COMMENT 'Javascript code of a banphrase. Must be a function that takes one argument (the message) and returns a replacement (Replacement), different message altogether (API response, Custom response) or Boolean (Denial)',
  `Type` ENUM('Denial','API response','Custom response','Replacement','Inactive') NOT NULL DEFAULT 'Custom response' COMMENT 'API response - triggered when an external banphrase API is hit, will return a pretty string. E.g.: API result = "ResidentSleeper", banphrase returns "zzz"\r\nCustom response - will reply with a completely different message altogether\r\nReplacement - will replace parts of the original message with something more appropriate\r\nDenial - based on the result, the bot will not reply at all\r\nInactive - banphrase not taken into account',
  `Platform` INT(10) UNSIGNED DEFAULT NULL COMMENT 'If both this field and Channel are NULL, the banphrase is considered as global everywhere (!)',
  `Channel` INT(10) UNSIGNED DEFAULT NULL COMMENT 'If Platform is NOT NULL and this field is NULL, the banphrase will be global for that Platform.',
  `Priority` TINYINT(4) NOT NULL DEFAULT 0 COMMENT 'Determines the priority of a banphrase. Higher number = higher priority',
  `Description` TEXT DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_Banphrase_Emote_chat_data.Channel` (`Channel`),
  KEY `FK_Banphrase_Platform` (`Platform`),
  CONSTRAINT `FK_Banphrase_Emote_chat_data.Channel` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Banphrase_Platform` FOREIGN KEY (`Platform`) REFERENCES `Platform` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;