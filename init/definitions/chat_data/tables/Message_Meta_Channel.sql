CREATE TABLE IF NOT EXISTS `chat_data`.`Message_Meta_Channel` (
  `Timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `Channel` INT(10) UNSIGNED NOT NULL,
  `Amount` INT(10) UNSIGNED DEFAULT NULL,
  `Length` INT(10) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`Timestamp`,`Channel`),
  KEY `Channel_Amount` (`Channel`,`Amount`),
  KEY `Channel_Length` (`Channel`,`Length`),
  CONSTRAINT `FK_Message_Data_Channel` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;