import { vsprintf }  from 'sprintf-js';
import ParseInterval from 'math-interval-parser';
import MakePlural    from 'make-plural/make-plural';
import Plurals       from 'make-plural/data/plurals.json';
import MessageFormat from 'messageformat';
import Mustache      from 'mustache';
import Url           from 'url';

MakePlural.load(Plurals);

let localeChangeListener = () => {},
	defaultLocale  = 'en',
	locales        = {},
	fallbacks      = {},
	cookiename     = null,
	objectNotation = false;

const MessageFormatInstanceForLocale = {},
	PluralsForLocale = {};

// Silent configure if I18N object is exist.
if (typeof global.I18N == 'object') {
	configure(global.I18N);
}

/**
 * Configure i18n with given options.
 *
 * @param  {Object} options
 */
export function configure(options) {

	// read languages locales
	if (typeof options.locales == 'object') {
		locales = options.locales;
	}

	// sets a custom cookie name to parse locale settings from
	if (typeof options.cookie == 'string') {
		cookiename = options.cookie;
	}

	// setting defaultLocale
	if (typeof options.defaultLocale == 'string') {
		defaultLocale = options.defaultLocale;
	}

	// enable object notation?
	if (typeof options.objectNotation != 'undefined') {
		objectNotation = options.objectNotation;
	}

	if (objectNotation === true) {
		objectNotation = '.';
	}

	// read language fallback map
	if (typeof options.fallbacks == 'object') {
		fallbacks = options.fallbacks;
	}

	// globalize
	if (options.globalize === true) {
		globalize();
	}

	defaultLocale = getCookie(cookiename) || defaultLocale;

	// get default locale from url
	const typeofQueryParameter = typeof options.queryParameter;

	if (typeofQueryParameter != 'undefined' && typeof location != 'undefined') {

		const queryParameter = typeofQueryParameter == 'string'
			? options.queryParameter
			: 'locale';

		const localeFromQuery = Url(location.href).query[queryParameter];

		if (typeof localeFromQuery == 'string') {
			defaultLocale = localeFromQuery;
		}
	}
}

/**
 * Inject `__`, `__n` and other functions to global scope.
 *
 */
export function globalize() {
	global.__ = applyAPItoObject(__);
	global.__n = applyAPItoObject(__n);
	global.__l = applyAPItoObject(__l);
	global.__h = applyAPItoObject(__h);
	global.__mf = applyAPItoObject(__mf);
}

/**
 * Translates a single phrase and adds it to locales if unknown.
 * Returns translated parsed and substituted string.
 *
 * @param  {String}    phrase
 * @param  {...Object} params
 * @return {String}    translate
 */
export function __(_phrase, ...params) {

	const phrase = preProcess(_phrase);

	let translated  = null,
		namedValues = null;

	// Accept an object with named values as the last parameter
	if (typeof params[params.length - 1] == 'object') {
		namedValues = params.pop();
	}

	// called like __({phrase: "Hello", locale: "en"})
	if (typeof phrase === 'object') {

		if (typeof phrase.locale === 'string' && typeof phrase.phrase === 'string') {
			translated = translate(phrase.locale, phrase.phrase);
		}

	// called like __("Hello")
	} else {
		// get translated message with locale
		translated = translate(defaultLocale, phrase);
	}

	// postprocess to get compatible to plurals
	if (typeof translated === 'object' && typeof translated.one != 'undefined') {
		translated = translated.one;
	}

	// in case there is no 'one' but an 'other' rule
	if (typeof translated === 'object' && typeof translated.other != 'undefined') {
		translated = translated.other;
	}

	return postProcess(translated, namedValues, params);
}

/**
 * Supports the advanced MessageFormat as provided by excellent messageformat module.
 * You should definetly head over to messageformat.github.io for a guide to MessageFormat.
 * i18n takes care of new MessageFormat('en').compile(msg);
 * with the current msg loaded from it's json files and cache that complied fn in memory.
 * So in short you might use it similar to __() plus extra object to accomblish MessageFormat's formating.
 *
 * @param  {String}    phrase
 * @param  {...Object} params
 * @return {String}    translate
 */
export function __mf(_phrase, ...params) {

	let phrase = _phrase,
		targetLocale = defaultLocale,
		namedValues = null,
		mf = null,
		f  = null;

	// Accept an object with named values as the last parameter
	if (typeof params[params.length - 1] == 'object') {
		namedValues = params.pop();
	}

	// called like __mf({phrase: "Hello", locale: "en"})
	if (typeof phrase === 'object') {

		if (typeof phrase.locale === 'string' && typeof phrase.phrase === 'string') {
			targetLocale = phrase.locale;
			phrase = phrase.phrase;
		}
	}
	// else called like __mf("Hello")

	const translated = translate(targetLocale, phrase);
	// --- end get translate

	// now head over to MessageFormat
	// and try to cache instance
	if (MessageFormatInstanceForLocale[targetLocale]) {
		mf = MessageFormatInstanceForLocale[targetLocale];
	} else {
		mf = new MessageFormat(targetLocale);
		mf.compiledFunctions = {};
		MessageFormatInstanceForLocale[targetLocale] = mf;
	}

	// let's try to cache that function
	if (mf.compiledFunctions[translated]) {
		f = mf.compiledFunctions[translated];
	} else {
		f = mf.compile(translated);
		mf.compiledFunctions[translated] = f;
	}

	return postProcess(f(namedValues), namedValues, params);
}

/**
 * Plurals translation of a single phrase.
 * Singular and plural forms will get added to locales if unknown.
 * Returns translated parsed and substituted string based on `count` parameter.
 *
 * @param  {String}    singular
 * @param  {String}    plural
 * @param  {Number}    count
 * @param  {...Object} params
 * @return {String}    translate
 */
export function __n(_singular, _plural, _count, ...params) {

	const singular = preProcess(_singular);

	let plural = _plural,
		count = _count,
		translated = null,
		namedValues = null,
		targetLocale = null;

	// Accept an object with named values as the last parameter
	if (typeof params[params.length - 1] == 'object') {
		namedValues = params.pop();
	}

	// called like __n({singular: "%s cat", plural: "%s cats", locale: "en"}, 3)
	if (typeof singular === 'object') {

		if (typeof singular.locale === 'string' && typeof singular.singular === 'string' && typeof singular.plural === 'string') {
			translated = translate(targetLocale = singular.locale, singular.singular, singular.plural);
		}

		params.unshift(count);

		// some template engines pass all values as strings -> so we try to convert them to numbers
		if (typeof plural === 'number' || `${parseInt(plural, 10)}` === plural) {
			count = plural;
		}

		// called like __n({singular: "%s cat", plural: "%s cats", locale: "en", count: 3})
		if (typeof singular.count === 'number' || typeof singular.count === 'string') {
			count = singular.count;
			params.unshift(plural);
		}
	}	else {
		// called like	__n('cat', 3)
		if (typeof plural === 'number' || String(parseInt(plural, 10)) === plural) {
			count = plural;

			// we add same string as default
			// which efectivly copies the key to the plural.value
			// this is for initialization of new empty translations
			plural = singular;

			params.unshift(count);
			params.unshift(plural);
		}
		// called like __n('%s cat', '%s cats', 3)
		// get translated message with locale from scope (deprecated) or object
		translated = translate(targetLocale = defaultLocale, singular, plural);
	}

	if (count === null) {
		count = namedValues.count;
	}

	// enforce number
	count = parseInt(count, 10);

	// find the correct plural rule for given locale
	if (typeof translated === 'object') {

		let p = null;

		// create a new Plural for locale
		// and try to cache instance
		if (PluralsForLocale[targetLocale]) {
			p = PluralsForLocale[targetLocale];
		} else {
			p = new MakePlural(targetLocale);
			PluralsForLocale[targetLocale] = p;
		}

		// fallback to 'other' on case of missing translations
		translated = translated[p(count)] || translated.other;
	}

	return postProcess(translated, namedValues, params, count);
}

/**
 * Returns a list of translations for a given phrase in each language.
 *
 * @param  {String} phrase
 * @return {Array<String>}
 */
export function __l(phrase) {
	return getLocales().sort().map(locale => __({
		phrase, locale
	}));
}

/**
 * Returns a hashed list of translations for a given phrase in each language.
 *
 * @param  {String} phrase
 * @return {Array<Object>}
 */
export function __h(phrase) {
	return getLocales().sort().map(locale => ({
		[locale]: __({
			phrase, locale
		})
	}));
}

/**
 * Set function to call when locale was change.
 *
 * @param  {Function} listener
 */
export function onLocaleChange(listener) {
	localeChangeListener = listener;
}

/**
 * Set current locale.
 *
 * @param  {String} locale
 * @return {String} locale
 */
export function setLocale(_locale) {

	let locale = _locale;

	const fallback = fallbacks[locale];

	if (typeof locales[locale] != 'object' && typeof fallback == 'string') {
		locale = fallback;
	}

	// called like setLocale('en')
	if (typeof locales[locale] == 'object') {

		defaultLocale = locale;

		if (cookiename !== null) {
			setCookie(cookiename, defaultLocale, {
				expires: 3600 * 24 * 31 * 12 * 100,
				path:    '/'
			});
		}

		localeChangeListener(defaultLocale);
	}

	return defaultLocale;
}

/**
 * Get current locale.
 *
 * @return {String}
 */
export function getLocale() {
	return defaultLocale;
}

/**
 * Get array of available locales.
 *
 * @return {Array<String>}
 */
export function getLocales() {
	return Object.keys(locales).filter(_ =>
		typeof locales[_] == 'object'
	);
}

/**
 * Returns a whole catalog optionally based on given locale.
 *
 * @param  {String} locale
 * @return {Object|Array}
 */
export function getCatalog(_locale) {

	let locale = _locale;

	if (typeof locale == 'undefined') {
		return locales;
	}

	const fallback = fallbacks[locale];

	if (typeof locales[locale] != 'object' && typeof fallback == 'string') {
		locale = fallback;
	}

	const catalog = locales[locale];

	// called like setLocale('en')
	if (typeof catalog == 'object') {
		return catalog;
	}

	return false;
}

/**
 * Add new translations.
 *
 * @param {String} locale
 * @param {Object} catalog
 */
export function addLocale(locale, catalog) {
	locales[locale] = catalog;
}

/**
 * Remove translations.
 *
 * @param  {String}
 */
export function removeLocale(locale) {
	locales[locale] = false;
}

function applyAPItoObject(object) {

	object.onLocaleChange = onLocaleChange;
	object.setLocale = setLocale;
	object.getLocale = getLocale;
	object.getLocales = getLocales;
	object.getCatalog = getCatalog;
	object.addLocale = addLocale;
	object.removeLocale = removeLocale;

	return object;
}

function setCookie(name, value, options = {}) {

	if (typeof document == 'undefined') {
		return;
	}

	let expires = options.expires;

	if (typeof expires == 'number' && expires) {

		const d = new Date();

		d.setTime(d.getTime() + expires * 1000);
		expires = options.expires = d;
	}

	if (expires && expires.toUTCString) {
		options.expires = expires.toUTCString();
	}

	let updatedCookie = `${name}=${encodeURIComponent(value)}`;

	for (const propName in options) {

		updatedCookie += `; ${propName}`;

		const propValue = options[propName];

		if (propValue !== true) {
			updatedCookie += `=${propValue}`;
		}
	}

	document.cookie = updatedCookie;
}

function getCookie(name) {

	if (typeof document == 'undefined' || name == null) {
		return false;
	}

	const matches = document.cookie.match(new RegExp(
		`(?:^|; )${name.replace(/([.$?*|{}()[]\\\/+^])/g, '\\$1')}=([^;]*)`
	));

	return matches ? decodeURIComponent(matches[1]) : false;
}

function preProcess(text) {

	if (Array.isArray(text) && text.hasOwnProperty('raw')) {
		return text.join('%s');
	}

	return text;
}

function postProcess(_text, namedValues, params, count) {

	let text = _text;

	// test for parsable interval string
	if (/\|/.test(text)) {
		text = parsePluralInterval(text, count);
	}

	// replace the counter
	if (typeof count == 'number') {
		text = vsprintf(text, [parseInt(count, 10)]);
	}

	// if the text string contains {{Mustache}} patterns we render it as a mini tempalate
	if (/\{\{.*\}\}/.test(text)) {
		text = Mustache.render(text, namedValues);
	}

	// if we have extra arguments with values to get replaced,
	// an additional substition injects those strings afterwards
	if (/%/.test(text) && params.length) {
		text = vsprintf(text, params);
	}

	return text;
}

/**
 * splits and parses a phrase for mathematical interval expressions
 */
function parsePluralInterval(phrase, count) {

	const phrases = phrase.split(/\|/);

	let returnPhrase = phrase;

	// some() breaks on 1st true
	phrases.some((p) => {

		const [m1, m2] = p.match(/^\s*([()[]\d,]+)?\s*(.*)$/);

		// not the same as in combined condition
		if (m1) {

			if (matchInterval(count, m1) === true) {
				returnPhrase = m2;
				return true;
			}

		} else {
			returnPhrase = p;
		}

		return false;
	});

	return returnPhrase;
}

/**
 * test a number to match mathematical interval expressions
 * [0,2] - 0 to 2 (including, matches: 0, 1, 2)
 * ]0,3[ - 0 to 3 (excluding, matches: 1, 2)
 * [1]   - 1 (matches: 1)
 * [20,] - all numbers ≥20 (matches: 20, 21, 22, ...)
 * [,20] - all numbers ≤20 (matches: 20, 21, 22, ...)
 */
function matchInterval(number, _interval) {

	const interval = ParseInterval(_interval);

	if (interval && typeof number == 'number') {

		const {
			from: {
				included: fromIncluded,
				value:    fromValue
			},
			to: {
				included: toIncluded,
				value:    toValue
			}
		} = interval;

		if (fromValue === number) {
			return fromIncluded;
		}

		if (toValue === number) {
			return toIncluded;
		}

		return (
			Math.min(fromValue, number) === fromValue
			&& Math.max(toValue, number) === toValue
		);
	}

	return false;
}

function translate(_locale, _singular, _plural) {

	const fallback = fallbacks[_locale];

	let locale = _locale,
		singular = _singular,
		plural = _plural,
		defaultSingular = singular,
		defaultPlural = plural;

	if (typeof locale == 'undefined') {
		locale = defaultLocale;
	}

	if (typeof locales[locale] != 'object' && typeof fallback == 'string') {
		locale = fallback;
	}

	if (typeof locales[locale] != 'object') {
		locale = defaultLocale;
	}

	if (objectNotation) {

		let indexOfColon = singular.indexOf(':');
		// We compare against 0 instead of -1 because we don't really expect the string to start with ':'.

		if (indexOfColon > 0) {
			defaultSingular = singular.substring(indexOfColon + 1);
			singular = singular.substring(0, indexOfColon);
		}

		if (plural && typeof plural !== 'number') {

			indexOfColon = plural.indexOf(':');

			if (indexOfColon > 0) {
				defaultPlural = plural.substring(indexOfColon + 1);
				plural = plural.substring(0, indexOfColon);
			}
		}
	}

	const accessor = localeAccessor(locale, singular),
		mutator = localeMutator(locale, singular);

	if (plural && !accessor()) {
		mutator({
			'one':   defaultSingular || singular,
			'other': defaultPlural || plural
		});
	}

	if (!accessor()) {
		mutator(defaultSingular || singular);
	}

	return accessor();
}

/**
 * Allows delayed access to translations nested inside objects.
 * @param {String} locale The locale to use.
 * @param {String} singular The singular term to look up.
 * @param {Boolean} [allowDelayedTraversal=true] Is delayed traversal of the tree allowed?
 * This parameter is used internally. It allows to signal the accessor that
 * a translation was not found in the initial lookup and that an invocation
 * of the accessor may trigger another traversal of the tree.
 * @returns {Function} A function that, when invoked, returns the current value stored
 * in the object at the requested location.
 */
function localeAccessor(locale, singular, _allowDelayedTraversal) {

	let allowDelayedTraversal = _allowDelayedTraversal;

	// Bail out on non-existent locales to defend against internal errors.
	if (typeof locales[locale] != 'object') {
		return Function.prototype;
	}

	// Handle object lookup notation
	const indexOfDot = objectNotation && singular.lastIndexOf(objectNotation);

	if (objectNotation && (0 < indexOfDot && indexOfDot < singular.length - 1)) {

		// If delayed traversal wasn't specifically forbidden, it is allowed.
		if (typeof allowDelayedTraversal == 'undefined') {
			allowDelayedTraversal = true;
		}

		// The accessor we're trying to find and which we want to return.
		let accessor = null;
		// An accessor that returns null.
		const nullAccessor = () => null;
		// Do we need to re-traverse the tree upon invocation of the accessor?
		let reTraverse = false;

		// Split the provided term and run the callback for each subterm.
		singular.split(objectNotation).reduce((object, index) => {
			// Make the accessor return null.
			accessor = nullAccessor;
			// If our current target object (in the locale tree) doesn't exist or
			// it doesn't have the next subterm as a member...
			if (object === null || !object.hasOwnProperty(index)) {
				// ...remember that we need retraversal (because we didn't find our target).
				reTraverse = allowDelayedTraversal;
				// Return null to avoid deeper iterations.
				return null;
			}
			// We can traverse deeper, so we generate an accessor for this current level.
			accessor = () => object[index];
			// Return a reference to the next deeper level in the locale tree.
			return object[index];

		}, locales[locale]);

		// Return the requested accessor.
		return () => (
			// If we need to re-traverse (because we didn't find our target term)
			// traverse again and return the new result (but don't allow further iterations)
			// or return the previously found accessor if it was already valid.
			(reTraverse) ? localeAccessor(locale, singular, false)() : accessor()
		);
	} else {
		// No object notation, just return an accessor that performs array lookup.
		return () => locales[locale][singular];
	}
}

/**
 * Allows delayed mutation of a translation nested inside objects.
 * @description Construction of the mutator will attempt to locate the requested term
 * inside the object, but if part of the branch does not exist yet, it will not be
 * created until the mutator is actually invoked. At that point, re-traversal of the
 * tree is performed and missing parts along the branch will be created.
 * @param {String} locale The locale to use.
 * @param {String} singular The singular term to look up.
 * @param {Boolean} [allowBranching=false] Is the mutator allowed to create previously
 * non-existent branches along the requested locale path?
 * @returns {Function} A function that takes one argument. When the function is
 * invoked, the targeted translation term will be set to the given value inside the locale table.
 */
function localeMutator(locale, singular, _allowBranching) {

	let allowBranching = _allowBranching;

	// Bail out on non-existent locales to defend against internal errors.
	if (typeof locales[locale] != 'object') {
		return Function.prototype;
	}

	// Handle object lookup notation
	const indexOfDot = objectNotation && singular.lastIndexOf(objectNotation);

	if (objectNotation && (0 < indexOfDot && indexOfDot < singular.length - 1)) {

		// If branching wasn't specifically allowed, disable it.
		if (typeof allowBranching == 'undefined') {
			allowBranching = false;
		}

		// This will become the function we want to return.
		let accessor = null;
		// An accessor that takes one argument and returns null.
		const nullAccessor = () => null;
		// Fix object path.
		let fixObject = () => ({});
		// Are we going to need to re-traverse the tree when the mutator is invoked?
		let reTraverse = false;

		// Split the provided term and run the callback for each subterm.
		singular.split(objectNotation).reduce((_object, index) => {

			let object = _object;

			// Make the mutator do nothing.
			accessor = nullAccessor;
			// If our current target object (in the locale tree) doesn't exist or
			// it doesn't have the next subterm as a member...
			if (object === null || !object.hasOwnProperty(index)) {
				// ...check if we're allowed to create new branches.
				if (allowBranching) {
					// Fix `object` if `object` is not Object.
					if (object === null || typeof object != 'object') {
						object = fixObject();
					}
					// If we are allowed to, create a new object along the path.
					object[index] = {};
				} else {
					// If we aren't allowed, remember that we need to re-traverse later on and...
					reTraverse = true;
					// ...return null to make the next iteration bail our early on.
					return null;
				}
			}
			// Generate a mutator for the current level.
			accessor = value => (object[index] = value);
			// Generate a fixer for the current level.
			fixObject = () => (object[index] = {});
			// Return a reference to the next deeper level in the locale tree.
			return object[index];

		}, locales[locale]);

		// Return the final mutator.
		return value => (
			// If we need to re-traverse the tree
			// invoke the search again, but allow branching this time (because here the mutator is being invoked)
			// otherwise, just change the value directly.
			(reTraverse) ? localeMutator(locale, singular, true)(value) : accessor(value)
		);

	} else {
		// No object notation, just return a mutator that performs array lookup and changes the value.
		return value => (locales[locale][singular] = value);
	}
}
