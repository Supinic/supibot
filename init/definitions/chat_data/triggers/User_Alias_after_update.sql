CREATE TRIGGER IF NOT EXISTS `chat_data`.`User_Alias_after_update`
AFTER UPDATE ON `chat_data`.`User_Alias`
FOR EACH ROW 
BEGIN
	IF (OLD.Data IS NULL AND NEW.Data IS NOT NULL) THEN
			INSERT INTO chat_data.User_Alias_Data (User_Alias) 
			VALUES (NEW.ID)
			ON DUPLICATE KEY UPDATE User_Alias = NEW.ID;
	ELSEIF (OLD.Data IS NOT NULL AND NEW.Data IS NULL) THEN
		DELETE FROM chat_data.User_Alias_Data 
		WHERE User_Alias = NEW.ID;
	END IF;
END