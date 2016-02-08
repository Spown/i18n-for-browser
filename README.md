[![NPM](https://nodei.co/npm/i18n-for-browser.png?compact=true)](https://nodei.co/npm/i18n-for-browser/)

# i18n-for-browser
Implementation of [`i18n-node`](https://github.com/mashpie/i18n-node) designed for client-side.


## Install
```sh
npm install i18n-for-browser
```

## Test
```sh
npm test
```

## Load
```js
// load modules
import * as i18n from 'i18n-for-browser';
```

now you are ready to use a `i18n.__('Hello')`. 


## Configure

Some options same as in [`i18n-node`](https://github.com/mashpie/i18n-node), except

```js
i18n.configure({
	// store of translations
    locales: {
    	'en': {...},
    	'ru': {...}
	},

    // sets a custom cookie name to read/write locale  - defaults to NULL
    cookie: 'yourcookiename',

    // injects `__` and `__n` functions to global scope
    // some methods like `setLocale` are injected to this functions
    // e.g. `__.getLocale()`
    // defaults to false
    globalize: true,

    // get default locale from url
    // e.g. `/path?locale=en`
    // defaults to false
    defaultLocaleFromQuery: true
});
```

Properties necessary for work with fs (`directory`, `updateFiles`, `indent`, `extenstion`, `prefix`) are skipped.

Also you can use auto-configuration: just define variable `I18N` with configuration before importing the module.

```js
const I18N = {
    locales: {
    	'en': {...},
    	'ru': {...}
	},
	globalize: true
};

...

import 'i18n-for-browser';

console.log(`${__('Hello')!}`);

```


## API


### __(phrase, ...params)

[See i18n-node.](https://github.com/mashpie/i18n-node#__)


### __n(singular, plural, count, ...params)

[See i18n-node.](https://github.com/mashpie/i18n-node#__n)


### setLocale(locale)

[See i18n-node.](https://github.com/mashpie/i18n-node#setlocale). Also this function write new locale to cookies if `cookiename` is setted.


### onLocaleChange(listener)

Set function to call when locale will change.

For example if you provide only needed translation via `I18N` object.
```js
const I18N = {
	cookiename: 'locale',
	globalize:  true
	...
};

...

import 'i18n-for-browser';

__.onLocaleChange(location.reload.bind(location));

...

$(".language-picker__language__en").click((e) => {
	__.setLocale('en');
});

```

Also it very comfortable use with react:
```js
class App extends React.Component {

	...

	componentDidMount() {
		___.onLocaleChange(this.forceUpdate.bind(this));
	}

	...

}
```


### getLocale()

[See i18n-node.](https://github.com/mashpie/i18n-node#getlocale)


### getLocales()

Get list of available locales.


### getCatalog(locale)

[See i18n-node.](https://github.com/mashpie/i18n-node#getcatalog)


### addLocale(locale, catalog)

Dynamically adding/replacing of locale


### removeLocale(locale)

Remove locale by key.