const channelsPendingAmount = {};
const usersPending = new Set();
const channelThreshold = 3;

const check = (user, channel) => {
	if (usersPending.has(user.ID)) {
		return {
			success: false,
			reply: `You already have a prompt pending!`
		};
	}

	if (channel) {
		channelsPendingAmount[channel.ID] ??= 0;
		if (channelsPendingAmount[channel.ID] >= channelThreshold) {
			return {
				success: false,
				reply: `There are too many prompts pending in this channel!`
			};
		}
	}

	return {
		success: true
	};
};

const set = (user, channel) => {
	usersPending.add(user.ID);

	if (channel) {
		channelsPendingAmount[channel.ID] ??= 0;
		channelsPendingAmount[channel.ID]++;
	}
};

const unset = (user, channel) => {
	usersPending.delete(user.ID);

	if (channel) {
		channelsPendingAmount[channel.ID] ??= 0;
		channelsPendingAmount[channel.ID]--;
	}
};

module.exports = {
	check,
	set,
	unset
};
