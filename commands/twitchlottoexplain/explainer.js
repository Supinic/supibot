import detectionsData from "../twitchlotto/detections.json" with { type: "json" };
import colours from "./colours.json" with { type: "json" };

const coloursData = Object.values(colours);

// {"detections":[{"confidence":0.97,"bounding_box":[196,483,417,371],"name":"Female Breast - Exposed"},{"confidence":0.97,"bounding_box":[612,479,424,373],"name":"Female Breast - Exposed"}],"nsfw_score":0.9997066855430603,"explainLink":"https://i.imgur.com/Dlvy5dV.jpg"}
const explainDetections = (data) => {
	const result = [];
	for (let i = 0; i < data.detections.length; i++) {
		const item = data.detections[i];
		const detectionType = detectionsData.find(i => i.string === item.name);
		const detectionName = detectionType?.replacement ?? "Unknown";
		const confidence = sb.Utils.round(item.confidence * 100, 0);

		result.push(`${coloursData[i]}: ${confidence}% ${detectionName}`);
	}

	return result;
};

export default {
	explainDetections
};
