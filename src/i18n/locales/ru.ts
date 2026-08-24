/**
 * Русские строки. Формулировки взяты из макетов (`design.pen`) — интерфейс должен
 * говорить ровно теми же словами, что согласованы с заказчиком.
 *
 * Заголовки секций записаны в обычном регистре: в макетах они набраны капсом, но это
 * решение оформления, а не текста, поэтому верхний регистр делает стиль, а не перевод.
 *
 * Валюта нигде не указывается — только числа.
 */

/**
 * Расширяет строковые литералы до `string`, сохраняя форму объекта и длину кортежей.
 * Благодаря этому `en.ts` обязан повторить набор ключей один в один, но волен иметь
 * собственные значения — без такого расширения `typeof ru` требовал бы от английского
 * файла дословно русских строк.
 */
type Localized<T> = T extends string ? string : { readonly [K in keyof T]: Localized<T[K]> };

const ru = {
  /** Названия позиций универсального каталога — ключи из `CATALOG`. */
  catalog: {
    // Двигатель
    'engine-oil': 'Моторное масло и фильтр',
    'air-filter': 'Воздушный фильтр',
    'spark-plugs': 'Свечи зажигания',
    'glow-plugs': 'Свечи накаливания',
    'timing-belt': 'Ремень ГРМ',
    'timing-chain': 'Цепь ГРМ',
    'accessory-belt': 'Ремень навесного оборудования',
    'pcv-valve': 'Клапан вентиляции картера',
    'engine-mounts': 'Опоры двигателя',
    'oxygen-sensor': 'Лямбда-зонд',
    'catalytic-converter': 'Катализатор',

    // Система охлаждения
    coolant: 'Антифриз',
    thermostat: 'Термостат',
    'water-pump': 'Помпа',
    radiator: 'Радиатор охлаждения',

    // Топливная система
    'fuel-filter': 'Топливный фильтр',
    'fuel-pump-strainer': 'Сетка бензонасоса',
    'injectors-cleaning': 'Форсунки (чистка)',
    'throttle-cleaning': 'Дроссель (чистка)',

    // Трансмиссия
    'atf-and-filter': 'Масло АКПП и фильтр',
    'manual-gearbox-oil': 'Масло МКПП',
    'clutch-kit': 'Комплект сцепления',
    'differential-oil': 'Масло редуктора и раздатки',
    'cv-boots': 'Пыльники ШРУС',
    'cv-joints': 'ШРУС',

    // Тормозная система
    'front-brake-pads': 'Тормозные колодки передние',
    'rear-brake-pads': 'Тормозные колодки задние',
    'front-brake-discs': 'Тормозные диски передние',
    'rear-brake-discs': 'Тормозные диски задние',
    'brake-fluid': 'Тормозная жидкость',
    'brake-hoses': 'Тормозные шланги',
    'parking-brake-shoes': 'Колодки стояночного тормоза',

    // Подвеска и рулевое
    'front-shocks': 'Амортизаторы передние',
    'rear-shocks': 'Амортизаторы задние',
    'strut-mounts': 'Опорные подшипники стоек',
    springs: 'Пружины',
    'stabilizer-links': 'Стойки стабилизатора',
    'stabilizer-bushings': 'Втулки стабилизатора',
    'control-arm-bushings': 'Сайлентблоки рычагов',
    'ball-joints': 'Шаровые опоры',
    'wheel-bearings': 'Ступичные подшипники',
    'tie-rod-ends': 'Рулевые наконечники',
    'tie-rods': 'Рулевые тяги',
    'power-steering-fluid': 'Жидкость ГУР',

    // Электрика
    battery: 'Аккумулятор',
    alternator: 'Генератор',
    starter: 'Стартер',
    'low-beam-bulbs': 'Лампа ближнего света',

    // Салон и кузов
    'cabin-filter': 'Салонный фильтр',
    'wiper-blades': 'Щётки стеклоочистителя',
    'rust-proofing': 'Антикоррозийная обработка',

    // Шины и колёса
    'summer-tires': 'Летние шины',
    'winter-tires': 'Зимние шины',
  },

  /** Категории деталей и услуг — ключи из `CATEGORY_KEYS`. */
  category: {
    engine: 'Двигатель',
    cooling: 'Система охлаждения',
    fuel: 'Топливная система',
    transmission: 'Трансмиссия',
    brakes: 'Тормозная система',
    suspension: 'Подвеска и рулевое',
    electrical: 'Электрика',
    interior: 'Салон и кузов',
    wheels: 'Шины и колёса',
  },

  /** Гараж целиком пуст — вместо вкладки «ТО» показывается приглашение завести машину. */
  garage: {
    empty: 'Машин пока нет',
    emptyHint: 'Добавьте автомобиль — с него и начнётся история обслуживания.',
  },

  /**
   * Вкладка «ТО»: подсказки частых услуг (`COMMON_SERVICES`) и карточки вверху экрана.
   * Числа приходят уже отформатированными (`{{km}}`, `{{mileage}}`), а `count` нужен
   * только для выбора формы слова.
   */
  service: {
    'oil-change-labour': 'Замена масла (работа)',
    diagnostics: 'Диагностика',
    'wheel-alignment': 'Развал-схождение',
    'tire-fitting': 'Шиномонтаж',
    balancing: 'Балансировка',
    'car-wash': 'Мойка',
    'throttle-cleaning': 'Чистка дроссельной заслонки',
    'ac-recharge': 'Заправка кондиционера',

    currentMileage: 'Текущий пробег',
    updateMileage: 'Обновить пробег',
    mileageHint: 'Меньше, чем в истории, поставить не получится',
    next: 'Следующее ТО',
    noData: 'ТО ещё не было',
    inKm: 'через {{km}} км',
    inMonths_one: 'через {{months}} месяц',
    inMonths_few: 'через {{months}} месяца',
    inMonths_many: 'через {{months}} месяцев',
    inMonths_other: 'через {{months}} месяца',
    orMonths_one: 'или {{months}} месяц',
    orMonths_few: 'или {{months}} месяца',
    orMonths_many: 'или {{months}} месяцев',
    orMonths_other: 'или {{months}} месяца',
    lastService: 'последнее ТО · {{mileage}} км',
    dueAt: 'следующее · {{mileage}} км',
    overdue: 'пора на ТО',
    overdueByKm: 'перепробег {{km}} км',
    assumedHint: 'нет данных о прошлых ТО — считаем от нулевого пробега',
  },

  /** История записей ТО на вкладке «ТО». */
  records: {
    history: 'История',
    scheduled: 'Регулярное',
    unscheduled: 'Внеплановое',
    total: 'Итого',
    services: 'Услуги: {{list}}',
    add: 'Добавить ТО',
    empty: 'Записей ТО пока нет',
    emptyHint: 'Добавьте первое ТО — от него посчитается ресурс всех деталей.',
    count_one: '{{count}} запись ТО',
    count_few: '{{count}} записи ТО',
    count_many: '{{count}} записей ТО',
    count_other: '{{count}} записи ТО',
  },

  /** Вкладка «Запчасти»: остаточный ресурс. */
  parts: {
    needsAttention: 'Требует внимания',
    remaining: '{{km}} км · {{months}} мес',
    remainingKm: '{{km}} км',
    remainingMonths: '{{months}} мес',
    overdue: 'просрочено',
    overdueKm: '{{km}} км · просрочено',
    overdueMonths: '{{months}} мес · просрочено',
    noData: 'нет данных',
    /** Остаток посчитан от начала жизни машины — числа настоящие, но с оговоркой. */
    assumed: '{{value}} · нет данных',
    addCustom: 'Своя запчасть',
    openCatalog: 'Каталог',
    empty: 'Отслеживать нечего',
    emptyHint: 'Включите детали в каталоге или добавьте свою.',
  },

  /** Карточка детали. */
  partDetail: {
    remainingKm: 'осталось {{km}} км',
    remainingMonthsPrimary_one: 'осталось {{months}} месяц',
    remainingMonthsPrimary_few: 'осталось {{months}} месяца',
    remainingMonthsPrimary_many: 'осталось {{months}} месяцев',
    remainingMonthsPrimary_other: 'осталось {{months}} месяца',
    remainingMonths_one: 'или {{months}} месяц',
    remainingMonths_few: 'или {{months}} месяца',
    remainingMonths_many: 'или {{months}} месяцев',
    remainingMonths_other: 'или {{months}} месяца',
    overdueKm: 'перепробег {{km}} км',
    overdueMonths_one: 'просрочено на {{months}} месяц',
    overdueMonths_few: 'просрочено на {{months}} месяца',
    overdueMonths_many: 'просрочено на {{months}} месяцев',
    overdueMonths_other: 'просрочено на {{months}} месяца',
    name: 'Название',
    editName: 'Изменить название',
    intervalKm: 'Интервал по пробегу',
    intervalMonths: 'Интервал по времени',
    editIntervals: 'Изменить интервалы',
    intervalNotSet: 'не задан',
    changes: 'История замен',
    lastChange: 'последняя замена',
    noChanges: 'Замен пока нет',
    noChangesHint: 'Замены подтягиваются из записей ТО — добавьте первую, и она появится здесь.',
    assumedHint:
      'Замен в истории нет — считаем, что деталь ни разу не меняли, и отсчитываем ресурс от нуля. Добавьте запись ТО, и расчёт станет точным.',
    setLastChange: 'Указать последнюю замену',
    setLastChangeHint: 'Заведём запись ТО задним числом — с неё и начнётся отсчёт.',
    hide: 'Скрыть деталь',
    hideConfirm: 'Скрыть «{{name}}»?',
    hideWarning: 'Деталь пропадёт из списка, но история замен сохранится — вернуть её можно в каталоге.',
    nameRequired: 'Название стереть нельзя',
    intervalRequired: 'Без интервала ресурс не посчитать — оставьте хотя бы один',
  },

  /** Новая или отредактированная запчасть. */
  partForm: {
    title: 'Новая запчасть',
    editTitle: 'Запчасть',
    name: 'Название',
    namePlaceholder: 'Ремень генератора',
    category: 'Категория',
    interval: 'Интервал замены',
    byMileage: 'По пробегу',
    byTime: 'По времени',
    intervalHint:
      'Достаточно одного интервала. Если задать только срок по времени, кольцо остатка будет считаться по нему, а не по пробегу.',
    changesHint:
      'Пробег и дата последней замены подтягиваются из записей ТО. Пока таких записей нет, деталь будет помечена как «нет данных».',
    submit: 'Добавить запчасть',
    intervalRequired: 'Задайте хотя бы один интервал',
    nameRequired: 'Без названия деталь не сохранить',
  },

  /** Каталог запчастей машины. */
  catalogScreen: {
    title: 'Каталог запчастей',
    search: 'Поиск по названию',
    hint: 'Отметьте, что отслеживать для {{car}}. Снятые с отметки детали не показываются на вкладке «Запчасти», но их история сохраняется — деталь можно вернуть в любой момент.',
    empty: 'Ничего не нашлось',
    custom: 'Свои детали',
  },

  /**
   * Причина, по которой позиция каталога выключена для этой машины.
   * Ключи собираются как `reason.<то, что вернул inapplicableReason>`.
   */
  reason: {
    fuel: {
      petrol: 'только для бензина',
      diesel: 'только для дизеля',
      hybrid: 'только для гибрида',
      electric: 'только для электро',
      combustion: 'только для ДВС',
    },
    transmission: {
      manual: 'только для механики',
      automatic: 'только для автомата',
    },
  },

  /** Добавление и редактирование записи ТО, включая шторки деталей и услуги. */
  recordForm: {
    title: 'Новое ТО',
    editTitle: 'Запись ТО',
    date: 'Дата',
    mileage: 'Пробег',
    kind: 'Тип ТО',
    parts: 'Заменённые детали',
    addPart: 'Добавить деталь',
    noParts: 'Деталей пока нет',
    services: 'Услуги',
    addService: 'Добавить услугу',
    noServices: 'Услуг пока нет',
    cost: 'Стоимость',
    total: 'Итого за ТО',
    noPriceWarning_one: 'У позиции «{{list}}» не указана цена — при вычислении она посчитана как 0.',
    noPriceWarning_few: 'У позиций «{{list}}» не указаны цены — при вычислении они посчитаны как 0.',
    noPriceWarning_many: 'У позиций «{{list}}» не указаны цены — при вычислении они посчитаны как 0.',
    noPriceWarning_other: 'У позиций «{{list}}» не указаны цены — при вычислении они посчитаны как 0.',
    pickParts: 'Выбрать детали',
    searchCatalog: 'Поиск по каталогу',
    addSelected_one: 'Добавить {{count}} деталь',
    addSelected_few: 'Добавить {{count}} детали',
    addSelected_many: 'Добавить {{count}} деталей',
    addSelected_other: 'Добавить {{count}} детали',
    serviceName: 'Название',
    serviceNamePlaceholder: 'Замена масла',
    serviceCategory: 'Категория',
    categoryHint: 'Определяет, в какую категорию попадёт стоимость услуги в разделе «Расходы».',
    commonServices: 'Частые услуги',
    itemCost: 'Стоимость',
    editItemCost: 'Стоимость позиции',
    delete: 'Удалить запись',
    deleteConfirm: 'Удалить эту запись ТО?',
    deleteWarning: 'Ресурс деталей пересчитается без неё.',
  },

  /** Вкладка «Расходы». */
  expenses: {
    title: 'Расходы',
    period: 'Период',
    spentIn: 'Потрачено за {{year}}',
    spentAllTime: 'Потрачено за всё время',
    allTime: 'За всё время',
    average: 'среднее {{amount}} за визит',
    byMonth: 'по месяцам, {{year}}',
    byCategory: 'По категориям',
    byCar: 'По машинам',
    unallocated: 'Нераспределённое',
    unallocatedHint: 'Стоимость введена одной суммой за ТО — разложить по категориям нельзя',
    empty: 'Расходов пока нет',
    emptyHint: 'Укажите стоимость в записях ТО — здесь появится разбивка.',
  },

  /** Настройки. */
  settings: {
    title: 'Настройки',
    cars: 'Автомобили',
    carSubtitle: '{{year}} · {{fuel}} · {{transmission}}',
    addCar: 'Добавить автомобиль',
    deleteCar: 'Удалить автомобиль',
    deleteCarConfirm: 'Удалить {{car}}?',
    deleteCarWarning: 'Вся история ТО этой машины удалится вместе с ней. Отменить будет нельзя.',
    app: 'Приложение',
    language: 'Язык',
    languageRu: 'Русский',
    languageEn: 'English',
    theme: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    themeSystem: 'Как в системе',
    data: 'Данные',
    export: 'Экспортировать данные',
    exportHint: 'Один файл со всеми машинами и историей',
    exportFailed: 'Не удалось сохранить файл',
    import: 'Импортировать данные',
    importHint: 'Заменит все текущие данные',
    importConfirm: 'Заменить все данные?',
    importWarning:
      'Машины, каталоги и вся история ТО будут стёрты и заменены содержимым файла. Отменить это будет нельзя.',
    importDone: 'Данные заменены',
    importDoneCars_one: '{{count}} машина',
    importDoneCars_few: '{{count}} машины',
    importDoneCars_many: '{{count}} машин',
    importDoneCars_other: '{{count}} машины',
    importFailed: 'Не удалось прочитать файл',
    importInvalidNotJson: 'Файл не читается как JSON — похоже, он повреждён.',
    importInvalidWrongApp: 'Это JSON, но не из Car Reminder — нужен файл из «Экспортировать данные».',
    importInvalidVersion: 'Файл сделан приложением посвежее — обновите Car Reminder и попробуйте снова.',
    version: 'Car Reminder · версия {{version}}',
  },

  /** Новый или отредактированный автомобиль. */
  carForm: {
    title: 'Новый автомобиль',
    editTitle: 'Автомобиль',
    make: 'Марка',
    model: 'Модель',
    year: 'Год выпуска',
    fuel: 'Тип топлива',
    transmission: 'Коробка передач',
    mileage: 'Текущий пробег',
    serviceInterval: 'Интервал регулярного ТО',
    serviceIntervalHint: 'Ноль означает, что регулярных ТО нет — карточка «Следующее ТО» не показывается.',
    catalogHint:
      'По типу топлива и коробке подберём стартовый список деталей: в дизель не попадут свечи зажигания, в автомат — диск сцепления. Список можно изменить в любой момент.',
    historyHint:
      'История обслуживания добавляется вручную — записями ТО. Детали без записей будут помечены как «нет данных».',
    submit: 'Добавить автомобиль',
    makeRequired: 'Укажите марку',
    modelRequired: 'Укажите модель',
    yearInvalid: 'Такого года выпуска не бывает',
    mileageRequired: 'Укажите текущий пробег',
  },

  /** Тип топлива: подписи кнопок в форме машины и строка в настройках. */
  fuel: {
    petrol: 'Бензин',
    diesel: 'Дизель',
    hybrid: 'Гибрид',
    electric: 'Электро',
    combustion: 'ДВС',
  },

  /** Коробка передач. */
  transmission: {
    manual: 'Механика',
    automatic: 'Автомат',
  },

  /**
   * Ошибки сохранения — ключи из `ValidationCode` плюс `date-invalid`: разбор даты
   * происходит до валидации записи, поэтому своего кода у этой ошибки нет.
   */
  validation: {
    'date-in-future': 'Дата ещё не наступила — выберите сегодняшний день или раньше',
    'date-invalid': 'Дата набрана не полностью или такого дня не существует',
    'mileage-not-positive': 'Введите пробег числом — ноль и минус не подойдут',
    'mileage-below-earlier-record':
      'Пробег меньше, чем в записи от {{date}}: там уже {{mileage}} км. Одометр не крутится назад',
    'mileage-above-later-record':
      'Пробег больше, чем в записи от {{date}}: там всего {{mileage}} км. Одометр не крутится назад',
    'mileage-below-history': 'Меньше {{mileage}} км поставить нельзя — столько записано в ТО от {{date}}',
  },

  /** Единицы и сокращения. */
  units: {
    km: 'км',
    months: 'мес',
    kmValue: '{{value}} км',
    monthsValue: '{{value}} мес',
    monthsLong_one: '{{count}} месяц',
    monthsLong_few: '{{count}} месяца',
    monthsLong_many: '{{count}} месяцев',
    monthsLong_other: '{{count}} месяца',
    kmLong_one: '{{count}} километр',
    kmLong_few: '{{count}} километра',
    kmLong_many: '{{count}} километров',
    kmLong_other: '{{count}} километра',
  },

  /** Нижние вкладки. */
  tabs: {
    service: 'ТО',
    parts: 'Запчасти',
    expenses: 'Расходы',
    settings: 'Настройки',
  },

  /** Общие действия и заглушки. */
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    done: 'Готово',
    add: 'Добавить',
    delete: 'Удалить',
    hide: 'Скрыть',
    edit: 'Изменить',
    update: 'Обновить',
    calculate: 'Вычислить',
    search: 'Поиск',
    back: 'Назад',
    close: 'Закрыть',
    ok: 'Понятно',
    selectCar: 'Выбрать машину',
    optional: 'Можно не указывать',
    dash: '—',
    nothingFound: 'Ничего не нашлось',
    error: 'Что-то пошло не так',
  },

  /** Подписи месяцев для диаграммы расходов, в порядке от января. */
  months: {
    short: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  },
} as const;

export type Translations = Localized<typeof ru>;

export default ru;
