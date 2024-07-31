DELIMITER //

CREATE TRIGGER `add_missing_first_channel_command_after_insert`
BEFORE INSERT ON `chat_data`.`Meta_Channel_Command`
FOR EACH ROW
BEGIN
	IF (
    		NEW.First_Command_Executed IS NULL
    		AND NEW.First_Command_Posted IS NULL
    		AND NEW.First_Command_Result IS NULL
    		AND NEW.Last_Command_Executed IS NOT NULL
    		AND NEW.Last_Command_Posted IS NOT NULL
    		AND NEW.Last_Command_Result IS NOT NULL
    	) THEN
    			SET NEW.First_Command_Executed = NEW.Last_Command_Executed;
    			SET NEW.First_Command_Posted = NEW.Last_Command_Posted;
    			SET NEW.First_Command_Result = NEW.Last_Command_Result;
    	END IF;
END //

DELIMITER ;
