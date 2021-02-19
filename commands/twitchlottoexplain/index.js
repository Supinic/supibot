module.exports = {
    Name: "twitchlottoexplain",
    Aliases: ["tle"],
    Author: "supinic",
    Cooldown: 10000,
    Description: "For a given processed TwitchLotto link, creates a version where the detections are marked with boxes.",
    Flags: ["mention","whitelist"],
    Params: null,
    Whitelist_Response: null,
    Static_Data: null,
    Code: (async function twitchLotto (context, inputLink) {
        if (!inputLink) {
            return {
                success: false,
                reply: `No image link provided!`
            };
        }

        const link = sb.Utils.getPathFromURL(inputLink);
        if (!link) {
            return {
                success: false,
                reply: `Invalid image link provided!`
            };
        }

        const linkData = await sb.Query.getRecordset(rs => rs
            .select("Data")
            .from("data", "Twitch_Lotto")
            .where("Link = %s", link)
            .limit(1)
            .single()
        );

        if (!linkData) {
            return {
                success: false,
                reply: `This image does not exist in the TwitchLotto database!`
            };
        }
        else if (!linkData.Data) {
            return {
                success: false,
                reply: `This image link has no data yet!`
            };
        }

        const data = JSON.parse(linkData.Data);
        if (!data.detections || data.detections.length === 0) {
            return {
                success: false,
                reply: `There are no detections on this image!`
            };
        }
        else if (data.explainLink) {
            return {
                reply: data.explainLink
            };
        }

        const { promisify } = require("util");
        const stream = require("stream");
        const pipeline = promisify(stream.pipeline);
        const shell = promisify(require("child_process").exec);
        const fs = require("fs");

        // await shell(`wget https://i.imgur.com/${link} -P /tmp`);

        const downloadStream = sb.Got.stream(`https://i.imgur.com/${link}`);
        const writeStream = fs.createWriteStream(`/tmp/${link}`);
        await pipeline(downloadStream, writeStream);

        const colours = ["#0F0", "#F00", "#00F", "#FF0", "#0FF", "#F0F"];
        const params = data.detections.map((i, ind) => {
            const coords = i.bounding_box;
            return sb.Utils.tag.trim `
                -strokewidth 7
                -stroke '${colours[ind]}'
                -fill 'none' 
                -draw 'rectangle ${coords[0]},${coords[1]},${coords[0] + coords[2]},${coords[1] + coords[3]}'
            `;
        }).join(" ");

        await shell(`convert /tmp/${link} ${params} /tmp/out_${link}`);
        await fs.promises.unlink(`/tmp/${link}`);

        const outputFile = await fs.promises.readFile(`/tmp/out_${link}`);
        const formData = new sb.Got.FormData();

        formData.append("image", outputFile, link); // !!! FILE NAME MUST BE SET, OR THE API DIES !!!
        const { statusCode, body } = await sb.Got({
            url: "https://api.imgur.com/3/image",
            responseType: "json",
            method: "POST",
            throwHttpErrors: false,
            headers: {
                ...formData.getHeaders(),
                Authorization: "Client-ID c898c0bb848ca39"
            },
            body: formData.getBuffer(),
            retry: 0,
            timeout: 10000
        });

        await fs.promises.unlink(`/tmp/out_${link}`);

        if (statusCode !== 200) {
            return {
                success: false,
                reply: `Image upload failed with code ${statusCode}!`
            };
        }

        data.explainLink = body.data.link;
        await sb.Query.getRecordUpdater(ru => ru
            .update("data", "Twitch_Lotto")
            .set("Data", JSON.stringify(data))
            .where("Link = %s", link)
        );

        return {
            reply: body.data.link
        };
    }),
    Dynamic_Description: null
};