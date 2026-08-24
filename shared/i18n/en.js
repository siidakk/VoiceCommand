/**
 * English strings — the canonical locale.
 *
 * Every other locale file mirrors these keys exactly; tests/i18n.test.js fails
 * the build if a translation drifts out of sync, so a missing key is caught
 * before it can render as a raw identifier in the UI.
 *
 * Placeholders use {braces} and are filled by t() in shared/i18n/index.js.
 */

export default {
  code: 'en',
  /** BCP-47 tag handed to the Web Speech API. */
  speech: 'en-US',
  name: 'English',
  nativeName: 'English',
  currency: 'USD',

  strings: {
    // ------------------------------------------------------------ categories
    'category.produce': 'Produce',
    'category.bakery': 'Bakery',
    'category.dairy': 'Dairy & Eggs',
    'category.meat': 'Meat',
    'category.seafood': 'Seafood',
    'category.frozen': 'Frozen',
    'category.breakfast': 'Breakfast',
    'category.pantry': 'Pantry',
    'category.condiments': 'Condiments',
    'category.snacks': 'Snacks',
    'category.beverages': 'Beverages',
    'category.household': 'Household',
    'category.personal_care': 'Personal Care',
    'category.baby': 'Baby',
    'category.pet': 'Pet',
    'category.other': 'Other',

    // --------------------------------------------------- substitution reasons
    'reason.dairyFree': 'dairy-free alternative',
    'reason.vegan': 'vegan alternative',
    'reason.healthier': 'healthier choice',
    'reason.cheaper': 'cheaper option',
    'reason.similar': 'similar item',
    'reason.glutenFree': 'gluten-free option',
    'reason.leaner': 'leaner cut',
    'reason.premium': 'premium option',

    // ----------------------------------------------------- suggestion reasons
    'suggest.runningLow': 'You usually rebuy this every {days} days',
    'suggest.runningLowShort': 'Running low',
    'suggest.frequentlyBought': 'You buy this often',
    'suggest.inSeason': 'In season now',
    'suggest.onSale': '{percent}% off this week',
    'suggest.seasonalEvent': 'Popular this time of year',
    'suggest.pairsWith': 'Goes well with {item}',
    'suggest.staple': 'A common staple',
    'suggest.outOfStock': '{item} is out of stock',
    'alert.runningLow': "It looks like you're running low on {item}",
    'alert.runningLowMore': "It looks like you're running low on {item} and {count} more",
    'alert.addIt': 'Add it',
    'alert.addAll': 'Add all',

    // ------------------------------------------------------ seasonal events
    'event.newYear': 'New Year healthy eating',
    'event.spring': 'Spring',
    'event.summer': 'Summer',
    'event.festive': 'Festive season',
    'event.holidays': 'Holidays',

    // ------------------------------------------------------------------- app
    'app.title': 'Voice Shopping Assistant',
    'app.tagline': 'Say what you need. It lands on the list.',

    // ------------------------------------------------------------ mic states
    'mic.idle': 'Tap to speak',
    'mic.listening': 'Listening…',
    'mic.processing': 'Working on it…',
    'mic.denied': 'Microphone blocked',
    'mic.unsupported': 'Voice not supported here',
    'mic.hint': 'Try “add two litres of milk”',
    'mic.continuous': 'Hands-free',

    // ----------------------------------------------------------------- lists
    'list.title': 'Shopping list',
    'list.empty': 'Your list is empty.',
    'list.emptyHint': 'Tap the mic and say “I need bread and eggs”.',
    'list.items': '{count} items',
    'list.itemsOne': '1 item',
    'list.total': 'Estimated total',
    'list.done': 'in the cart',
    'list.clearAll': 'Clear list',
    'list.undo': 'Undo',
    'list.markBought': 'Mark as bought',

    // ----------------------------------------------------------- suggestions
    'panel.suggestions': 'Smart suggestions',
    'panel.seasonal': 'In season & on sale',
    'panel.substitutes': 'Alternatives',
    'panel.search': 'Search results',
    'panel.history': 'Bought before',
    'panel.noSuggestions': 'No suggestions yet — add a few items first.',
    'panel.demoHistory': 'Using a sample purchase history so predictions show straight away.',
    'panel.resetHistory': 'Clear sample',
    'panel.variantsFrom': 'from {price}',
    'panel.optionCount': '{count} options',
    'heard.preferInstead': 'Prefer {item}?',
    'panel.addAll': 'Add all',

    // ---------------------------------------------------------------- search
    'search.title': 'Voice search',
    'search.none': 'Nothing matched “{query}”.',
    'search.results': '{count} matches for “{query}”',
    'search.resultsOne': '1 match for “{query}”',
    'search.under': 'under {price}',
    'search.between': 'between {min} and {max}',
    'search.brand': 'brand {brand}',
    'search.filters': 'Filters',
    'search.clear': 'Clear search',

    // -------------------------------------------------------- spoken replies
    'say.added': 'Added {qty} {unit} of {item}',
    'say.addedSimple': 'Added {item}',
    'say.removed': 'Removed {item}',
    'say.updated': 'Updated {item} to {qty}',
    'say.cleared': 'Cleared your list',
    'say.marked': 'Marked {item} as bought',
    'say.notFound': 'I could not find {item} on your list',
    'say.listSummary': 'You have {count} items on the list',
    'say.listReadout': '{count} items: {items}',
    'say.listRemaining': 'Still to get: {items}',
    'say.listEmpty': 'Your list is empty',
    'say.searchResults': 'I found {count} matches for {query}',
    'say.searchResultsOne': 'I found one match for {query}',
    'say.searchNone': 'I did not find anything for {query}',
    'say.outOfStock': '{item} is out of stock. Try {alt} instead',
    'say.substitute': 'You could swap {item} for {alt}',
    'say.notUnderstood': 'Sorry, I did not catch that',
    'say.help': 'Try saying: add two litres of milk, remove bread, or find toothpaste under five dollars',

    // ---------------------------------------------------------- transcript UI
    'heard.label': 'Heard',
    'heard.interim': 'Listening',
    'heard.confidence': '{percent}% confident',
    'heard.didYouMean': 'Did you mean {item}?',
    'heard.unrecognised': 'Not sure what to do with that.',
    'heard.tryThese': 'Try one of these:',

    // ---------------------------------------------------------------- errors
    'error.micDenied': 'Microphone access was blocked. Allow it in your browser settings, or type your command instead.',
    'error.micUnsupported': 'This browser has no speech recognition. Chrome, Edge or Safari will work — or use the text box below.',
    'error.network': 'Speech service unreachable. Check your connection and try again.',
    'error.noSpeech': 'I did not hear anything. Tap the mic and try again.',
    'error.aborted': 'Listening stopped.',
    'error.audioCapture': 'No microphone found. Plug one in and reload.',
    'error.server': 'Could not reach the server — working offline with your local list.',
    'error.generic': 'Something went wrong. Please try again.',
    'error.retry': 'Retry',
    'error.dismiss': 'Dismiss',

    // -------------------------------------------------------------- controls
    'ctl.language': 'Language',
    'ctl.voiceReplies': 'Voice replies',
    'ctl.typeInstead': 'Type a command',
    'ctl.send': 'Send',
    'ctl.help': 'Commands',
    'ctl.offline': 'On this device',
    'ctl.online': 'Synced',
    'ctl.offlineHint': 'Your list is saved in this browser. No server needed.',
    'ctl.onlineHint': 'Your list is synced across your devices.',
    'ctl.settings': 'Settings',
    'ctl.close': 'Close',

    // ------------------------------------------------------------ help sheet
    'help.title': 'What you can say',
    'help.add': 'Add items',
    'help.remove': 'Remove items',
    'help.quantity': 'Set quantity',
    'help.search': 'Search & filter',
    'help.manage': 'Manage the list',

    // ------------------------------------------------------------- a11y text
    'a11y.micButton': 'Start or stop voice input',
    'a11y.removeItem': 'Remove {item}',
    'a11y.toggleItem': 'Toggle {item} as bought',
    'a11y.increase': 'Increase quantity of {item}',
    'a11y.decrease': 'Decrease quantity of {item}',
    'a11y.liveRegion': 'Assistant feedback'
  }
};
