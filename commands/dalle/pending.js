const channelsPendingAmount = {};
const usersPending = new Set();
const channelThreshold = 3;

let overloadedTimestamp = 0;
const overloadTimeout = 300_000;

const setOverloaded = () => {
	overloadedTimestamp = sb.Date.now() + overloadTimeout;
};

const check = (user, channel) => {
	if (overloadedTimestamp > sb.Date.now()) {
		const skippedTimePeriod = sb.Utils.timeDelta(overloadedTimestamp, true);
		return {
			success: false,
			reply: `The API is currently overloaded! No requests will be attempted for ${skippedTimePeriod}.`
		};
	}

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
	setOverloaded,
	check,
	set,
	unset
};
