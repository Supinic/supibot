CREATE TABLE IF NOT EXISTS `chat_data`.`Log` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `Tag` ENUM('Command','Message','Twitch','Discord','Cytube','Module','System') NOT NULL DEFAULT 'System',
  `Subtag` ENUM('Request','Fail','Warning','Success','Shadowban','Ban','Clearchat','Sub','Giftsub','Host','Error','Timeout','Restart','Other','Ritual') DEFAULT NULL,
  `Description` TEXT DEFAULT NULL,
  `Channel` INT(10) UNSIGNED DEFAULT NULL,
  `User_Alias` INT(10) UNSIGNED DEFAULT NULL,
  `Timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`ID`),
  KEY `FK_Log_Channel` (`Channel`),
  KEY `FK_Log_User_Alias` (`User_Alias`),
  CONSTRAINT `FK_Log_Channel` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_Log_User_Alias` FOREIGN KEY (`User_Alias`) REFERENCES `User_Alias` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
