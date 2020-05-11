CREATE TABLE IF NOT EXISTS `chat_data`.`Message_Meta_User_Alias` (
  `User_Alias` INT(10) UNSIGNED NOT NULL,
  `Channel` INT(10) UNSIGNED NOT NULL,
  `Message_Count` INT(10) UNSIGNED NOT NULL DEFAULT 1,
  `Last_Message_Text` VARCHAR(2000) DEFAULT NULL,
  `Last_Message_Posted` DATETIME(3) NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`User_Alias`,`Channel`),
  KEY `Last_Seen_Lookup` (`User_Alias`,`Last_Message_Posted`),
  KEY `Top_Chatters_in_Channel_Lookup` (`Channel`,`Message_Count`),
  CONSTRAINT `FK_User_Message_Meta_Channel` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_User_Message_Meta_User_Alias` FOREIGN KEY (`User_Alias`) REFERENCES `User_Alias` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;