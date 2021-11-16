INSERT INTO `chat_data`.`Platform`
(`Name`, `Host`, `Message_Limit`, `Self_Name`, `Logging`, `Defaults`)
VALUES
('Twitch',NULL,500,NULL,'{
	"bans": false,
	"bits": false,
	"channelJoins": false,
	"clearchat": false,
	"giftSubs": false,
	"messages": false,
	"subs": false,
	"timeouts": false,
	"whispers": false
}','{
	"modes": {
		"Moderator": {
			"queueSize": 1e6,
			"cooldown": 50
		},
		"VIP": {
			"queueSize": 50,
			"cooldown": 150
		},
		"Write": {
			"queueSize": 5,
			"cooldown": 1250
		}
	},
	"subscriptionPlans": {
	    "1000": "$5",
	    "2000": "$10",
	    "3000": "$25",
	    "Prime": "Prime"
	},
	"partChannelsOnPermaban": false,
	"clearRecentBansTimer": 60000,
	"recentBanThreshold": null,
	"updateAvailableBotEmotes": false,
	"ignoredUserNotices": [],
	"sameMessageEvasionCharacter": "󠀀",
	"rateLimits": "default",
	"reconnectAnnouncement": {}
}'),
('Discord',NULL,2000,NULL,NULL,NULL),
('Cytube','https://cytu.be',600,NULL,'{
    "videoRequests": false,
    "whispers": false
}',NULL)

ON DUPLICATE KEY UPDATE ID = ID;
