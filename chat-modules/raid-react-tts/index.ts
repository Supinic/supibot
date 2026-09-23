import { getConfig } from "../../config.js";
import { defineChatModule } from "../../classes/chat-module.js";

const { local = {} } = getConfig();

export default defineChatModule({
	name: "raid-react-tts",
	description: "Reacts to Twitch raids with a TTS message",
	platform: ["twitch"],
	scope: "channel",
	handlers: {
		async raid (context) {
			const { listenerAddress, listenerPort } = local;
			if (!listenerAddress || !listenerPort) {
				return;
			}

			const { channel, username, data } = context;
			const amount = (data.viewers > 1000)
				? (`${String(core.Utils.round(data.viewers / 1000, 1)).replace(".", " point ")} billion`)
				: (`${data.viewers} million`);

			const message = `FeelsGoodMan Clap ${username} just raided the stream with ${amount} viewers!`;
			await channel.send(message);

			await core.Got.get("GenericAPI")({
				url: `${listenerAddress}:${listenerPort}`,
				responseType: "text",
				searchParams: new URLSearchParams({
					tts: JSON.stringify([{
						locale: "en-us",
						text: message
					}])
				})
			});
		}
	}
});
