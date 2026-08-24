import type { Translations } from './ru';

/**
 * English strings. Wording on the Service and Parts screens follows the approved
 * mock-ups («13 · Service (EN)», «14 · Parts (EN)»); the rest is written in the same
 * register — plain, spoken English rather than a word-for-word trace of the Russian.
 *
 * The `Translations` type is `ru.ts` with its string literals widened, so a key that is
 * missing here or spelled differently fails the build.
 *
 * English resolves only the `one` and `other` plural forms; the `_few` and `_many` keys
 * exist to keep the key sets identical and are never selected at runtime.
 *
 * No currency anywhere — numbers only.
 */
const en: Translations = {
  catalog: {
    // Engine
    'engine-oil': 'Engine oil & filter',
    'air-filter': 'Air filter',
    'spark-plugs': 'Spark plugs',
    'glow-plugs': 'Glow plugs',
    'timing-belt': 'Timing belt',
    'timing-chain': 'Timing chain',
    'accessory-belt': 'Accessory belt',
    'pcv-valve': 'PCV valve',
    'engine-mounts': 'Engine mounts',
    'oxygen-sensor': 'Oxygen sensor',
    'catalytic-converter': 'Catalytic converter',

    // Cooling
    coolant: 'Coolant',
    thermostat: 'Thermostat',
    'water-pump': 'Water pump',
    radiator: 'Radiator',

    // Fuel system
    'fuel-filter': 'Fuel filter',
    'fuel-pump-strainer': 'Fuel pump strainer',
    'injectors-cleaning': 'Injector cleaning',
    'throttle-cleaning': 'Throttle body cleaning',

    // Transmission
    'atf-and-filter': 'Automatic gearbox oil & filter',
    'manual-gearbox-oil': 'Manual gearbox oil',
    'clutch-kit': 'Clutch kit',
    'differential-oil': 'Differential & transfer case oil',
    'cv-boots': 'CV boots',
    'cv-joints': 'CV joints',

    // Brakes
    'front-brake-pads': 'Front brake pads',
    'rear-brake-pads': 'Rear brake pads',
    'front-brake-discs': 'Front brake discs',
    'rear-brake-discs': 'Rear brake discs',
    'brake-fluid': 'Brake fluid',
    'brake-hoses': 'Brake hoses',
    'caliper-grease': 'Caliper grease',
    'parking-brake-shoes': 'Parking brake shoes',

    // Suspension & steering
    'front-shocks': 'Front shock absorbers',
    'rear-shocks': 'Rear shock absorbers',
    'strut-mounts': 'Strut top mounts',
    springs: 'Springs',
    'stabilizer-links': 'Anti-roll bar links',
    'stabilizer-bushings': 'Anti-roll bar bushes',
    'control-arm-bushings': 'Control arm bushes',
    'ball-joints': 'Ball joints',
    'wheel-bearings': 'Wheel bearings',
    'tie-rod-ends': 'Tie rod ends',
    'tie-rods': 'Tie rods',
    'power-steering-fluid': 'Power steering fluid',

    // Electrical
    battery: 'Battery',
    alternator: 'Alternator',
    starter: 'Starter motor',
    'low-beam-bulbs': 'Low beam bulb',

    // Interior & body
    'cabin-filter': 'Cabin filter',
    'wiper-blades': 'Wiper blades',
    'rust-proofing': 'Rust proofing',

    // Tyres & wheels
    'summer-tires': 'Summer tyres',
    'winter-tires': 'Winter tyres',
  },

  category: {
    engine: 'Engine',
    cooling: 'Cooling',
    fuel: 'Fuel system',
    transmission: 'Transmission',
    brakes: 'Brakes',
    suspension: 'Suspension & steering',
    electrical: 'Electrical',
    interior: 'Interior & body',
    wheels: 'Tyres & wheels',
  },

  garage: {
    empty: 'No cars yet',
    emptyHint: 'Add a car — the service history starts with it.',
  },

  service: {
    'oil-change-labour': 'Oil change (labour)',
    diagnostics: 'Diagnostics',
    'wheel-alignment': 'Wheel alignment',
    'tire-fitting': 'Tyre fitting',
    balancing: 'Wheel balancing',
    'car-wash': 'Car wash',
    'ac-recharge': 'A/C recharge',

    currentMileage: 'Current mileage',
    updateMileage: 'Update mileage',
    mileageHint: 'It cannot go below what the history already holds',
    next: 'Next service',
    noData: 'no services yet',
    inKm: 'in {{km}} km',
    inMonths_one: 'in {{months}} month',
    inMonths_few: 'in {{months}} months',
    inMonths_many: 'in {{months}} months',
    inMonths_other: 'in {{months}} months',
    orMonths_one: 'or {{months}} month',
    orMonths_few: 'or {{months}} months',
    orMonths_many: 'or {{months}} months',
    orMonths_other: 'or {{months}} months',
    lastService: 'last service · {{mileage}} km',
    dueAt: 'next · {{mileage}} km',
    overdue: 'service due',
    overdueByKm: '{{km}} km over',
    assumedHint: 'no data on past services — counting from zero mileage',
  },

  records: {
    history: 'History',
    scheduled: 'Scheduled',
    unscheduled: 'Unscheduled',
    total: 'Total',
    services: 'Services: {{list}}',
    add: 'Add service',
    empty: 'No service records yet',
    emptyHint: 'Add the first one — part life is counted from it.',
    count_one: '{{count}} service record',
    count_few: '{{count}} service records',
    count_many: '{{count}} service records',
    count_other: '{{count}} service records',
  },

  parts: {
    needsAttention: 'Needs attention',
    remaining: '{{km}} km · {{months}} mo',
    remainingKm: '{{km}} km',
    remainingMonths: '{{months}} mo',
    overdue: 'overdue',
    overdueKm: '{{km}} km · overdue',
    overdueMonths: '{{months}} mo · overdue',
    noData: 'no data',
    assumed: '{{value}} · no data',
    addCustom: 'Own part',
    openCatalog: 'Catalogue',
    empty: 'Nothing to track',
    emptyHint: 'Tick parts in the catalogue or add your own.',
  },

  partDetail: {
    remainingKm: '{{km}} km left',
    remainingMonthsPrimary_one: '{{months}} month left',
    remainingMonthsPrimary_few: '{{months}} months left',
    remainingMonthsPrimary_many: '{{months}} months left',
    remainingMonthsPrimary_other: '{{months}} months left',
    remainingMonths_one: 'or {{months}} month',
    remainingMonths_few: 'or {{months}} months',
    remainingMonths_many: 'or {{months}} months',
    remainingMonths_other: 'or {{months}} months',
    overdueKm: '{{km}} km over',
    overdueMonths_one: 'overdue by {{months}} month',
    overdueMonths_few: 'overdue by {{months}} months',
    overdueMonths_many: 'overdue by {{months}} months',
    overdueMonths_other: 'overdue by {{months}} months',
    name: 'Name',
    editName: 'Edit name',
    intervalKm: 'Mileage interval',
    intervalMonths: 'Time interval',
    editIntervals: 'Edit intervals',
    intervalNotSet: 'not set',
    changes: 'Replacement history',
    lastChange: 'last replacement',
    noChanges: 'No replacements yet',
    noChangesHint: 'Replacements come from service records — add the first one and it shows up here.',
    assumedHint:
      'No replacements on record — we take it the part has never been changed and count from zero. Add a service record and the figures become exact.',
    setLastChange: 'Set the last replacement',
    setLastChangeHint: 'This adds a back-dated service record — the count starts from it.',
    hide: 'Hide part',
    hideConfirm: 'Hide “{{name}}”?',
    hideWarning: 'The part leaves the list, but its replacement history stays — you can bring it back from the catalogue.',
    nameRequired: 'The name cannot be left blank',
    intervalRequired: 'Without an interval there is nothing to count — keep at least one',
  },

  partForm: {
    title: 'New part',
    editTitle: 'Part',
    name: 'Name',
    namePlaceholder: 'Accessory belt',
    category: 'Category',
    interval: 'Replacement interval',
    byMileage: 'By mileage',
    byTime: 'By time',
    intervalHint:
      'One interval is enough. Set the time interval alone and the remaining-life ring is counted by time, not by mileage.',
    noIntervalHint:
      'You can leave the interval empty — some parts are replaced by condition, not by schedule. Such a part goes to the catalogue switched off, because there is nothing to measure. Turn it on whenever you like.',
    changesHint:
      'The mileage and date of the last replacement are taken from service records. Until there is one, the part is marked “no data”.',
    submit: 'Add part',
    intervalRequired: 'Set at least one interval',
    nameRequired: 'A part needs a name',
  },

  catalogScreen: {
    title: 'Parts catalogue',
    search: 'Search by name',
    hint: 'Tick what to track for {{car}}. Unticked parts leave the Parts tab, but their history is kept — you can bring a part back at any time.',
    empty: 'Nothing found',
    custom: 'Own parts',
  },

  reason: {
    fuel: {
      petrol: 'petrol only',
      diesel: 'diesel only',
      hybrid: 'hybrids only',
      electric: 'electric only',
      combustion: 'combustion engines only',
    },
    transmission: {
      manual: 'manual only',
      automatic: 'automatic only',
    },
  },

  recordForm: {
    title: 'New service',
    editTitle: 'Service record',
    date: 'Date',
    mileage: 'Mileage',
    kind: 'Service type',
    parts: 'Replaced parts',
    addPart: 'Add part',
    noParts: 'No parts yet',
    services: 'Services',
    addService: 'Add service',
    noServices: 'No services yet',
    cost: 'Cost',
    total: 'Service total',
    noPriceWarning_one: '“{{list}}” has no price — it was counted as 0.',
    noPriceWarning_few: 'These have no price and were counted as 0: {{list}}.',
    noPriceWarning_many: 'These have no price and were counted as 0: {{list}}.',
    noPriceWarning_other: 'These have no price and were counted as 0: {{list}}.',
    pickParts: 'Select parts',
    searchCatalog: 'Search the catalogue',
    addSelected_one: 'Add {{count}} part',
    addSelected_few: 'Add {{count}} parts',
    addSelected_many: 'Add {{count}} parts',
    addSelected_other: 'Add {{count}} parts',
    serviceName: 'Name',
    serviceNamePlaceholder: 'Oil change',
    serviceCategory: 'Category',
    categoryHint: 'Decides which category the cost of this service lands in under Expenses.',
    commonServices: 'Common services',
    itemCost: 'Cost',
    itemNote: 'Comment',
    itemNotePlaceholder: 'Model, part number, a note',
    editItemCost: 'Item cost',
    delete: 'Delete record',
    deleteConfirm: 'Delete this service record?',
    deleteWarning: 'Part life will be recounted without it.',
  },

  expenses: {
    title: 'Expenses',
    period: 'Period',
    spentIn: 'Spent in {{year}}',
    spentAllTime: 'Spent all time',
    allTime: 'All time',
    average: 'average {{amount}} per visit',
    byMonth: 'by month, {{year}}',
    byCategory: 'By category',
    byCar: 'By car',
    unallocated: 'Unallocated',
    unallocatedHint: 'The cost was entered as one service total — it cannot be split by category',
    empty: 'No expenses yet',
    emptyHint: 'Put costs into your service records and the breakdown shows up here.',
  },

  settings: {
    title: 'Settings',
    cars: 'Cars',
    carSubtitle: '{{year}} · {{fuel}} · {{transmission}}',
    addCar: 'Add car',
    deleteCar: 'Delete car',
    deleteCarConfirm: 'Delete {{car}}?',
    deleteCarWarning: 'The whole service history of this car goes with it. This cannot be undone.',
    app: 'App',
    language: 'Language',
    languageRu: 'Русский',
    languageEn: 'English',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'Follow system',
    data: 'Data',
    export: 'Export data',
    exportHint: 'A single file with every car and its history',
    exportFailed: 'Could not save the file',
    import: 'Import data',
    importHint: 'Replaces all current data',
    importConfirm: 'Replace all data?',
    importWarning:
      'Cars, catalogues and the whole service history will be wiped and replaced with the contents of the file. This cannot be undone.',
    importDone: 'Data replaced',
    importDoneCars_one: '{{count}} car',
    importDoneCars_few: '{{count}} cars',
    importDoneCars_many: '{{count}} cars',
    importDoneCars_other: '{{count}} cars',
    importFailed: 'Could not read the file',
    importInvalidNotJson: 'The file does not read as JSON — it looks damaged.',
    importInvalidWrongApp: 'This is JSON, but not from Car Reminder — pick a file made by “Export data”.',
    importInvalidVersion: 'The file comes from a newer version of the app — update Car Reminder and try again.',
    version: 'Car Reminder · version {{version}}',
  },

  carForm: {
    title: 'New car',
    editTitle: 'Car',
    make: 'Make',
    model: 'Model',
    year: 'Year',
    fuel: 'Fuel type',
    transmission: 'Gearbox',
    mileage: 'Current mileage',
    serviceInterval: 'Scheduled service interval',
    serviceIntervalHint: 'Zero means there are no scheduled services — the “Next service” card is hidden.',
    catalogHint:
      'The fuel type and gearbox pick the starting list of parts: a diesel gets no spark plugs, an automatic no clutch. You can change the list at any time.',
    historyHint:
      'Service history is added by hand, one record at a time. Parts without records are marked “no data”.',
    submit: 'Add car',
    makeRequired: 'Enter the make',
    modelRequired: 'Enter the model',
    yearInvalid: 'No car was built in that year',
    mileageRequired: 'Enter the current mileage',
  },

  fuel: {
    petrol: 'Petrol',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    electric: 'Electric',
    combustion: 'Combustion',
  },

  transmission: {
    manual: 'Manual',
    automatic: 'Automatic',
  },

  validation: {
    'date-in-future': 'That day has not come yet — pick today or earlier',
    'date-invalid': 'The date is incomplete or there is no such day',
    'mileage-not-positive': 'Enter the mileage as a number — zero and minus will not do',
    'mileage-below-earlier-record':
      'Lower than the record of {{date}}, which already stands at {{mileage}} km. An odometer does not run backwards',
    'mileage-above-later-record':
      'Higher than the record of {{date}}, which stands at only {{mileage}} km. An odometer does not run backwards',
    'mileage-below-history': 'It cannot go below {{mileage}} km — that much is in the service of {{date}}',
  },

  units: {
    km: 'km',
    months: 'mo',
    kmValue: '{{value}} km',
    monthsValue: '{{value}} mo',
    monthsLong_one: '{{count}} month',
    monthsLong_few: '{{count}} months',
    monthsLong_many: '{{count}} months',
    monthsLong_other: '{{count}} months',
    kmLong_one: '{{count}} kilometre',
    kmLong_few: '{{count}} kilometres',
    kmLong_many: '{{count}} kilometres',
    kmLong_other: '{{count}} kilometres',
  },

  tabs: {
    service: 'Service',
    parts: 'Parts',
    expenses: 'Expenses',
    settings: 'Settings',
  },

  common: {
    save: 'Save',
    cancel: 'Cancel',
    done: 'Done',
    add: 'Add',
    delete: 'Delete',
    hide: 'Hide',
    edit: 'Edit',
    update: 'Update',
    calculate: 'Calculate',
    search: 'Search',
    back: 'Back',
    close: 'Close',
    ok: 'Got it',
    selectCar: 'Select car',
    optional: 'Optional',
    dash: '—',
    nothingFound: 'Nothing found',
    error: 'Something went wrong',
  },

  months: {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};

export default en;
