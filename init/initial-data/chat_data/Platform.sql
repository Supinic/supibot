INSERT INTO `chat_data`.`Platform`
(`Name`, `Host`)
VALUES
('Twitch',NULL),
('Discord',NULL),
('Cytube','https://cytu.be');

ON DUPLICATE KEY UPDATE ID = ID;
