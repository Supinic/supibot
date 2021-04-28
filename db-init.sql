CREATE DATABASE IF NOT EXISTS `data`;
CREATE DATABASE IF NOT EXISTS `chat_data`;
GRANT ALL ON `data`.* TO 'supibot'@'%';
GRANT ALL ON `chat_data`.* TO 'supibot'@'%';
