CREATE TABLE IF NOT EXISTS `chat_data`.`User_Alias_Data` (
  `User_Alias` INT(10) UNSIGNED NOT NULL,
  PRIMARY KEY (`User_Alias`),
  CONSTRAINT `FK_User_Alias_Data_User_Alias` FOREIGN KEY (`User_Alias`) REFERENCES `User_Alias` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;