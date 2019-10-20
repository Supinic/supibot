/**
 * Extended and simpler-to-use version of native Date
 * @memberof sb
 * @namespace Date
 */
module.exports = class Date extends global.Date {
	/**
	 * Pads a number with specified number of zeroes.
	 * @private
	 * @param {number} number
	 * @param {number} padding
	 * @returns {string}
	 */
	static zf(number, padding) {
		return ("0".repeat(padding) + number).slice(-padding);
	}

	/**
	 * Compares two instances for their equality
	 * @param {sb.Date} from
	 * @param {sb.Date} to
	 * @returns {boolean}
	 */
	static equals(from, to) {
		return from.valueOf() === to.valueOf();
	}

	/**
	 * Creates the instance. Uses the same constructor as native Date does.
	 * @param {*} args
	 */
	constructor(...args) {
		super(...args);
	}

	/**
	 * Formats the instance into specified format.
	 * @param {string} formatString
	 * @returns {string}
	 */
	format(formatString) {
		const year = this.year, month = this.month, day = this.day, hours = this.hours, minutes = this.minutes,
			seconds = this.seconds, milli = this.milliseconds;

		let value = "";
		for (const char of formatString) {
			switch (char) {
				case "l":
					value += this.dayOfTheWeek;
					break;
				case "D":
					value += this.dayOfTheWeek.slice(0, 3);
					break;

				case "d":
					value += Date.zf(day, 2);
					break;
				case "j":
					value += day;
					break;
				case "m":
					value += Date.zf(month, 2);
					break;
				case "n":
					value += month;
					break;
				case "Y":
					value += year;
					break;

				case "G":
					value += hours;
					break;
				case "H":
					value += Date.zf(hours, 2);
					break;
				case "i":
					value += Date.zf(minutes, 2);
					break;
				case "s":
					value += Date.zf(seconds, 2);
					break;
				case "v":
					value += Date.zf(milli, 3);
					break;

				default:
					value += char;
			}
		}
		return value;
	}

	simpleDate() {
		return this.format("j.n.Y");
	}

	simpleDateTime() {
		return this.format("j.n.Y H:i:s");
	}

	fullDateTime() {
		return this.format("j.n.Y H:i:s.v");
	}

	sqlDate() {
		return this.format("Y-m-d");
	}

	sqlTime() {
		return this.format("H:i:s.v");
	}

	sqlDateTime() {
		return this.format("Y-m-d H:i:s.v");
	}

	/**
	 * @param {number} offset
	 * @returns {sb.Date}
	 */
	setTimezoneOffset(offset) {
		offset = Number(offset);
		if (Number.isNaN(offset)) throw new Error("Invalid offset");

		const dayUTC = this.getUTCDate();
		this.setHours(this.getUTCHours() + offset);

		if (dayUTC > this.getDate()) {
			this.addDays(1);
		}
		else if (dayUtc < this.getDate()) {
			this.addDays(-1);
		}

		return this;
	}

	/**
	 * Sets the provided time units to zero.
	 * @param {...<"h"|"m"|"s"|"ms">} units
	 * @returns {sb.Date}
	 */
	discardTimeUnits(...units) {
		for (const unit of units) {
			switch (unit) {
				case "h":
					this.setHours(0);
					break;
				case "m":
					this.setMinutes(0);
					break;
				case "s":
					this.setSeconds(0);
					break;
				case "ms":
					this.setMilliseconds(0);
					break;
				default:
					throw new Error("Unrecognized time unit " + unit);
			}
		}
		return this;
	}

	clone () {
		return new this.constructor(this);
	}

	addYears(y) {
		this.year += y;
		return this;
	}

	addMonths(m) {
		this.month += m;
		return this;
	}

	addDays(d) {
		this.day += d;
		return this;
	}

	addHours(h) {
		this.hours += h;
		return this;
	}

	addMinutes(m) {
		this.minutes += m;
		return this;
	}

	addSeconds(s) {
		this.seconds += s;
		return this;
	}

	addMilliseconds(ms) {
		this.milliseconds += ms;
		return this;
	}

	get dayOfTheWeek () {
		switch (super.getDay()) {
			case 0: return "Sunday";
			case 1: return "Monday";
			case 2: return "Tuesday";
			case 3: return "Wednesday";
			case 4: return "Thursday";
			case 5: return "Friday";
			case 6: return "Saturday";
			default: throw new RangeError("Day of the week is out of the range 0-6. Has the definition of a week changed since 2019?");
		}
	}

	get milliseconds() {
		return super.getMilliseconds();
	}

	set milliseconds(ms) {
		super.setMilliseconds(ms);
	}

	get seconds() {
		return super.getSeconds();
	}

	set seconds(s) {
		super.setSeconds(s);
	}

	get minutes() {
		return this.getMinutes();
	}

	set minutes(m) {
		super.setMinutes(m);
	}

	get hours() {
		return super.getHours();
	}

	set hours(h) {
		super.setHours(h);
	}

	get day() {
		return super.getDate();
	}

	set day(d) {
		super.setDate(d);
	}

	get month() {
		return super.getMonth() + 1;
	}

	set month(m) {
		super.setMonth(m - 1);
	}

	get year() {
		return super.getFullYear();
	}

	set year(y) {
		super.setFullYear(y);
	}
};