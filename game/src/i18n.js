// Translations for every UI string. Country names come from the browser
// (Intl.DisplayNames), so all 236 countries are named in every language.

export const LANGS = {
  ar: { name: 'العربية', dir: 'rtl' },
  en: { name: 'English', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  es: { name: 'Español', dir: 'ltr' },
  de: { name: 'Deutsch', dir: 'ltr' },
  pt: { name: 'Português', dir: 'ltr' },
  tr: { name: 'Türkçe', dir: 'ltr' },
  ru: { name: 'Русский', dir: 'ltr' },
  zh: { name: '中文', dir: 'ltr' },
};

const S = {
  ar: {
    title: 'جبهة السماء', subtitle: 'حرب جوية على خريطة العالم',
    play: 'حرب جديدة', continue: 'متابعة الحملة', settings: 'الإعدادات', controls: 'طريقة التحكم',
    chooseCountry: 'اختر دولتك', chooseEnemy: 'اختر الدولة التي ستحاربها', search: 'ابحث عن دولة…',
    random: 'عشوائي', suggested: 'دول قريبة', allCountries: 'كل الدول', back: 'رجوع',
    warDeclared: '{a} تعلن الحرب على {b}!',
    objective: 'دمّر {n} أهداف معادية: الدفاع الجوي والرادارات والقواعد الجوية.',
    start: 'إقلاع!', language: 'اللغة', gameSpeed: 'سرعة اللعبة', slow: 'بطيئة', medium: 'متوسطة', fast: 'سريعة',
    sound: 'الصوت', on: 'تشغيل', off: 'إيقاف',
    controlsDesktop: 'لوحة المفاتيح: ← → للدوران، ↑ ↓ للسرعة، مسافة للرشاش، F للصاروخ، Q للمشاعل، + − للتكبير، P للإيقاف.',
    controlsMobile: 'الهاتف: حرّك عصا التحكم يساراً لتوجيه الطائرة (كلما أبعدتها زادت السرعة). الأزرار يميناً: رشاش، صاروخ، مشاعل.',
    controlsTips: 'ثبّت مقدمة الطائرة على الهدف حتى يظهر «قفل» ثم أطلق الصاروخ. عند إنذار الصاروخ أطلق المشاعل وانعطف بقوة. عُد إلى قاعدتك للإصلاح وإعادة التسليح.',
    pause: 'إيقاف', paused: 'متوقفة مؤقتاً', resume: 'استئناف', quit: 'القائمة الرئيسية',
    victory: 'نصر!', victoryText: '{b} استسلمت! سلاحك الجوي يسيطر على سمائها.', nextWar: 'الحرب التالية',
    defeat: 'هزيمة', defeatText: 'خسرت كل طائراتك. أعد تنظيم صفوفك وحاول مجدداً.', retry: 'أعد المحاولة',
    hp: 'الدرع', missiles: 'صواريخ', flares: 'مشاعل', lives: 'طائرات', score: 'النقاط', targets: 'الأهداف',
    missileWarning: 'صاروخ!', radarLock: 'رادار معادٍ يرصدك', repairing: 'إصلاح وإعادة تسليح…',
    returnHome: 'الدرع منخفض — عُد إلى القاعدة', ocean: 'مياه دولية',
    gun: 'رشاش', msl: 'صاروخ', flr: 'مشاعل', lock: 'قفل',
    sam: 'دفاع جوي', radar: 'رادار', airbase: 'قاعدة جوية', fighter: 'مقاتلة',
    destroyed: 'تم تدمير {x}', lost: 'سقطت طائرتك! طائرة جديدة خلال لحظات…', conquered: 'دول مُسيطَر عليها: {n}',
    base: 'القاعدة', enemy: 'العدو',
  },
  en: {
    title: 'Sky Front', subtitle: 'Air war on the world map',
    play: 'New war', continue: 'Continue campaign', settings: 'Settings', controls: 'Controls',
    chooseCountry: 'Choose your country', chooseEnemy: 'Choose the country to fight', search: 'Search country…',
    random: 'Random', suggested: 'Nearby', allCountries: 'All countries', back: 'Back',
    warDeclared: '{a} declares war on {b}!',
    objective: 'Destroy {n} enemy targets: air defenses, radars and air bases.',
    start: 'Take off!', language: 'Language', gameSpeed: 'Game speed', slow: 'Slow', medium: 'Medium', fast: 'Fast',
    sound: 'Sound', on: 'On', off: 'Off',
    controlsDesktop: 'Keyboard: ← → turn, ↑ ↓ throttle, Space guns, F missile, Q flares, + − zoom, P pause.',
    controlsMobile: 'Phone: push the stick on the left toward where you want to fly (further = faster). Right buttons: guns, missile, flares.',
    controlsTips: 'Keep your nose on a target until “LOCK” shows, then fire a missile. On a missile warning, drop flares and turn hard. Fly back to your base to repair and rearm.',
    pause: 'Pause', paused: 'Paused', resume: 'Resume', quit: 'Main menu',
    victory: 'Victory!', victoryText: '{b} has surrendered! Your air force rules its skies.', nextWar: 'Next war',
    defeat: 'Defeat', defeatText: 'All your aircraft are lost. Regroup and try again.', retry: 'Try again',
    hp: 'Armor', missiles: 'Missiles', flares: 'Flares', lives: 'Aircraft', score: 'Score', targets: 'Targets',
    missileWarning: 'MISSILE!', radarLock: 'Enemy radar lock', repairing: 'Repairing & rearming…',
    returnHome: 'Armor low — return to base', ocean: 'International waters',
    gun: 'GUN', msl: 'MSL', flr: 'FLR', lock: 'LOCK',
    sam: 'Air defense', radar: 'Radar', airbase: 'Air base', fighter: 'Fighter',
    destroyed: '{x} destroyed', lost: 'Aircraft lost! New aircraft incoming…', conquered: 'Countries taken: {n}',
    base: 'Base', enemy: 'Enemy',
  },
  fr: {
    title: 'Front Céleste', subtitle: 'Guerre aérienne sur la carte du monde',
    play: 'Nouvelle guerre', continue: 'Continuer la campagne', settings: 'Paramètres', controls: 'Commandes',
    chooseCountry: 'Choisissez votre pays', chooseEnemy: 'Choisissez le pays à combattre', search: 'Rechercher un pays…',
    random: 'Aléatoire', suggested: 'Proches', allCountries: 'Tous les pays', back: 'Retour',
    warDeclared: '{a} déclare la guerre à {b} !',
    objective: 'Détruisez {n} cibles ennemies : défenses aériennes, radars et bases aériennes.',
    start: 'Décollage !', language: 'Langue', gameSpeed: 'Vitesse du jeu', slow: 'Lente', medium: 'Moyenne', fast: 'Rapide',
    sound: 'Son', on: 'Activé', off: 'Désactivé',
    controlsDesktop: 'Clavier : ← → virer, ↑ ↓ gaz, Espace canon, F missile, Q leurres, + − zoom, P pause.',
    controlsMobile: 'Téléphone : poussez le manche à gauche vers où voler (plus loin = plus vite). Boutons à droite : canon, missile, leurres.',
    controlsTips: 'Gardez le nez sur une cible jusqu’à « VERROU », puis tirez. En cas d’alerte missile, larguez des leurres et virez fort. Revenez à votre base pour réparer et réarmer.',
    pause: 'Pause', paused: 'En pause', resume: 'Reprendre', quit: 'Menu principal',
    victory: 'Victoire !', victoryText: '{b} a capitulé ! Votre aviation domine son ciel.', nextWar: 'Guerre suivante',
    defeat: 'Défaite', defeatText: 'Tous vos avions sont perdus. Regroupez-vous et réessayez.', retry: 'Réessayer',
    hp: 'Blindage', missiles: 'Missiles', flares: 'Leurres', lives: 'Avions', score: 'Score', targets: 'Cibles',
    missileWarning: 'MISSILE !', radarLock: 'Verrouillage radar ennemi', repairing: 'Réparation et réarmement…',
    returnHome: 'Blindage faible — retour à la base', ocean: 'Eaux internationales',
    gun: 'CANON', msl: 'MSL', flr: 'LEURRE', lock: 'VERROU',
    sam: 'Défense aérienne', radar: 'Radar', airbase: 'Base aérienne', fighter: 'Chasseur',
    destroyed: '{x} détruit', lost: 'Avion perdu ! Nouvel avion en approche…', conquered: 'Pays conquis : {n}',
    base: 'Base', enemy: 'Ennemi',
  },
  es: {
    title: 'Frente Celeste', subtitle: 'Guerra aérea en el mapa mundial',
    play: 'Nueva guerra', continue: 'Continuar campaña', settings: 'Ajustes', controls: 'Controles',
    chooseCountry: 'Elige tu país', chooseEnemy: 'Elige el país contra el que lucharás', search: 'Buscar país…',
    random: 'Aleatorio', suggested: 'Cercanos', allCountries: 'Todos los países', back: 'Atrás',
    warDeclared: '¡{a} declara la guerra a {b}!',
    objective: 'Destruye {n} objetivos enemigos: defensas antiaéreas, radares y bases aéreas.',
    start: '¡Despegar!', language: 'Idioma', gameSpeed: 'Velocidad del juego', slow: 'Lenta', medium: 'Media', fast: 'Rápida',
    sound: 'Sonido', on: 'Sí', off: 'No',
    controlsDesktop: 'Teclado: ← → girar, ↑ ↓ potencia, Espacio cañón, F misil, Q bengalas, + − zoom, P pausa.',
    controlsMobile: 'Móvil: empuja la palanca izquierda hacia donde quieras volar (más lejos = más rápido). Botones derechos: cañón, misil, bengalas.',
    controlsTips: 'Mantén el morro sobre un objetivo hasta ver «FIJADO» y dispara. Ante una alerta de misil, suelta bengalas y gira fuerte. Vuelve a tu base para reparar y rearmar.',
    pause: 'Pausa', paused: 'En pausa', resume: 'Reanudar', quit: 'Menú principal',
    victory: '¡Victoria!', victoryText: '¡{b} se ha rendido! Tu fuerza aérea domina su cielo.', nextWar: 'Siguiente guerra',
    defeat: 'Derrota', defeatText: 'Has perdido todos tus aviones. Reagrúpate e inténtalo de nuevo.', retry: 'Reintentar',
    hp: 'Blindaje', missiles: 'Misiles', flares: 'Bengalas', lives: 'Aviones', score: 'Puntos', targets: 'Objetivos',
    missileWarning: '¡MISIL!', radarLock: 'Radar enemigo te fija', repairing: 'Reparando y rearmando…',
    returnHome: 'Blindaje bajo: vuelve a la base', ocean: 'Aguas internacionales',
    gun: 'CAÑÓN', msl: 'MISIL', flr: 'BENG', lock: 'FIJADO',
    sam: 'Defensa antiaérea', radar: 'Radar', airbase: 'Base aérea', fighter: 'Caza',
    destroyed: '{x} destruido', lost: '¡Avión derribado! Llega un avión nuevo…', conquered: 'Países conquistados: {n}',
    base: 'Base', enemy: 'Enemigo',
  },
  de: {
    title: 'Himmelsfront', subtitle: 'Luftkrieg auf der Weltkarte',
    play: 'Neuer Krieg', continue: 'Kampagne fortsetzen', settings: 'Einstellungen', controls: 'Steuerung',
    chooseCountry: 'Wähle dein Land', chooseEnemy: 'Wähle das gegnerische Land', search: 'Land suchen…',
    random: 'Zufällig', suggested: 'In der Nähe', allCountries: 'Alle Länder', back: 'Zurück',
    warDeclared: '{a} erklärt {b} den Krieg!',
    objective: 'Zerstöre {n} feindliche Ziele: Luftabwehr, Radare und Luftwaffenbasen.',
    start: 'Abheben!', language: 'Sprache', gameSpeed: 'Spieltempo', slow: 'Langsam', medium: 'Mittel', fast: 'Schnell',
    sound: 'Ton', on: 'An', off: 'Aus',
    controlsDesktop: 'Tastatur: ← → kurven, ↑ ↓ Schub, Leertaste Kanone, F Rakete, Q Täuschkörper, + − Zoom, P Pause.',
    controlsMobile: 'Handy: Schiebe den linken Stick in die gewünschte Flugrichtung (weiter = schneller). Rechte Tasten: Kanone, Rakete, Täuschkörper.',
    controlsTips: 'Halte die Nase auf ein Ziel, bis „AUFGESCHALTET“ erscheint, dann feuern. Bei Raketenwarnung Täuschkörper werfen und hart kurven. Zur Basis zurückfliegen, um zu reparieren und aufzumunitionieren.',
    pause: 'Pause', paused: 'Pausiert', resume: 'Weiter', quit: 'Hauptmenü',
    victory: 'Sieg!', victoryText: '{b} hat kapituliert! Deine Luftwaffe beherrscht den Himmel.', nextWar: 'Nächster Krieg',
    defeat: 'Niederlage', defeatText: 'Alle Flugzeuge verloren. Sammle dich und versuche es erneut.', retry: 'Nochmal',
    hp: 'Panzerung', missiles: 'Raketen', flares: 'Täuschk.', lives: 'Flugzeuge', score: 'Punkte', targets: 'Ziele',
    missileWarning: 'RAKETE!', radarLock: 'Feindradar erfasst dich', repairing: 'Reparatur & Aufmunitionierung…',
    returnHome: 'Panzerung niedrig – zurück zur Basis', ocean: 'Internationale Gewässer',
    gun: 'KANONE', msl: 'RAK', flr: 'TÄUSCH', lock: 'AUFGESCHALTET',
    sam: 'Luftabwehr', radar: 'Radar', airbase: 'Luftwaffenbasis', fighter: 'Jäger',
    destroyed: '{x} zerstört', lost: 'Flugzeug verloren! Neues Flugzeug kommt…', conquered: 'Eroberte Länder: {n}',
    base: 'Basis', enemy: 'Feind',
  },
  pt: {
    title: 'Frente Celeste', subtitle: 'Guerra aérea no mapa-múndi',
    play: 'Nova guerra', continue: 'Continuar campanha', settings: 'Configurações', controls: 'Controles',
    chooseCountry: 'Escolha seu país', chooseEnemy: 'Escolha o país a combater', search: 'Buscar país…',
    random: 'Aleatório', suggested: 'Próximos', allCountries: 'Todos os países', back: 'Voltar',
    warDeclared: '{a} declara guerra a {b}!',
    objective: 'Destrua {n} alvos inimigos: defesas antiaéreas, radares e bases aéreas.',
    start: 'Decolar!', language: 'Idioma', gameSpeed: 'Velocidade do jogo', slow: 'Lenta', medium: 'Média', fast: 'Rápida',
    sound: 'Som', on: 'Ligado', off: 'Desligado',
    controlsDesktop: 'Teclado: ← → virar, ↑ ↓ potência, Espaço canhão, F míssil, Q flares, + − zoom, P pausa.',
    controlsMobile: 'Celular: empurre o manche à esquerda para onde quer voar (mais longe = mais rápido). Botões à direita: canhão, míssil, flares.',
    controlsTips: 'Mantenha o nariz no alvo até aparecer “TRAVADO” e dispare. Num alerta de míssil, solte flares e vire forte. Volte à base para reparar e rearmar.',
    pause: 'Pausar', paused: 'Pausado', resume: 'Continuar', quit: 'Menu principal',
    victory: 'Vitória!', victoryText: '{b} se rendeu! Sua força aérea domina os céus.', nextWar: 'Próxima guerra',
    defeat: 'Derrota', defeatText: 'Todas as aeronaves perdidas. Reagrupe e tente de novo.', retry: 'Tentar de novo',
    hp: 'Blindagem', missiles: 'Mísseis', flares: 'Flares', lives: 'Aeronaves', score: 'Pontos', targets: 'Alvos',
    missileWarning: 'MÍSSIL!', radarLock: 'Radar inimigo travou em você', repairing: 'Reparando e rearmando…',
    returnHome: 'Blindagem baixa — volte à base', ocean: 'Águas internacionais',
    gun: 'CANHÃO', msl: 'MSL', flr: 'FLR', lock: 'TRAVADO',
    sam: 'Defesa antiaérea', radar: 'Radar', airbase: 'Base aérea', fighter: 'Caça',
    destroyed: '{x} destruído', lost: 'Aeronave abatida! Nova aeronave a caminho…', conquered: 'Países conquistados: {n}',
    base: 'Base', enemy: 'Inimigo',
  },
  tr: {
    title: 'Gök Cephesi', subtitle: 'Dünya haritasında hava savaşı',
    play: 'Yeni savaş', continue: 'Sefere devam et', settings: 'Ayarlar', controls: 'Kontroller',
    chooseCountry: 'Ülkeni seç', chooseEnemy: 'Savaşacağın ülkeyi seç', search: 'Ülke ara…',
    random: 'Rastgele', suggested: 'Yakındakiler', allCountries: 'Tüm ülkeler', back: 'Geri',
    warDeclared: '{a}, {b} ülkesine savaş ilan etti!',
    objective: '{n} düşman hedefini yok et: hava savunması, radarlar ve hava üsleri.',
    start: 'Kalkış!', language: 'Dil', gameSpeed: 'Oyun hızı', slow: 'Yavaş', medium: 'Orta', fast: 'Hızlı',
    sound: 'Ses', on: 'Açık', off: 'Kapalı',
    controlsDesktop: 'Klavye: ← → dön, ↑ ↓ gaz, Boşluk top, F füze, Q işaret fişeği, + − yakınlaştır, P duraklat.',
    controlsMobile: 'Telefon: soldaki çubuğu uçmak istediğin yöne it (uzak = hızlı). Sağdaki tuşlar: top, füze, işaret fişeği.',
    controlsTips: 'Burnunu hedefte tut, “KİLİT” görünce füzeyi ateşle. Füze uyarısında fişek at ve sert dön. Onarım ve mühimmat için üssüne dön.',
    pause: 'Duraklat', paused: 'Duraklatıldı', resume: 'Devam', quit: 'Ana menü',
    victory: 'Zafer!', victoryText: '{b} teslim oldu! Hava kuvvetlerin göklere hâkim.', nextWar: 'Sonraki savaş',
    defeat: 'Yenilgi', defeatText: 'Tüm uçakların düştü. Toparlan ve tekrar dene.', retry: 'Tekrar dene',
    hp: 'Zırh', missiles: 'Füzeler', flares: 'Fişekler', lives: 'Uçaklar', score: 'Puan', targets: 'Hedefler',
    missileWarning: 'FÜZE!', radarLock: 'Düşman radarı seni kilitledi', repairing: 'Onarım ve ikmal…',
    returnHome: 'Zırh düşük — üsse dön', ocean: 'Uluslararası sular',
    gun: 'TOP', msl: 'FÜZE', flr: 'FİŞEK', lock: 'KİLİT',
    sam: 'Hava savunması', radar: 'Radar', airbase: 'Hava üssü', fighter: 'Savaş uçağı',
    destroyed: '{x} yok edildi', lost: 'Uçak düştü! Yeni uçak geliyor…', conquered: 'Alınan ülkeler: {n}',
    base: 'Üs', enemy: 'Düşman',
  },
  ru: {
    title: 'Небесный фронт', subtitle: 'Воздушная война на карте мира',
    play: 'Новая война', continue: 'Продолжить кампанию', settings: 'Настройки', controls: 'Управление',
    chooseCountry: 'Выберите свою страну', chooseEnemy: 'Выберите страну-противника', search: 'Поиск страны…',
    random: 'Случайно', suggested: 'Рядом', allCountries: 'Все страны', back: 'Назад',
    warDeclared: '{a} объявляет войну: {b}!',
    objective: 'Уничтожьте {n} вражеских целей: ПВО, радары и авиабазы.',
    start: 'Взлёт!', language: 'Язык', gameSpeed: 'Скорость игры', slow: 'Медленно', medium: 'Средне', fast: 'Быстро',
    sound: 'Звук', on: 'Вкл', off: 'Выкл',
    controlsDesktop: 'Клавиатура: ← → поворот, ↑ ↓ тяга, Пробел пушка, F ракета, Q ловушки, + − масштаб, P пауза.',
    controlsMobile: 'Телефон: ведите левый джойстик туда, куда хотите лететь (дальше = быстрее). Кнопки справа: пушка, ракета, ловушки.',
    controlsTips: 'Держите нос на цели, пока не появится «ЗАХВАТ», затем пуск. При ракетной тревоге сбрасывайте ловушки и резко поворачивайте. Вернитесь на базу для ремонта и перевооружения.',
    pause: 'Пауза', paused: 'Пауза', resume: 'Продолжить', quit: 'Главное меню',
    victory: 'Победа!', victoryText: '{b} капитулирует! Ваши ВВС господствуют в небе.', nextWar: 'Следующая война',
    defeat: 'Поражение', defeatText: 'Все самолёты потеряны. Перегруппируйтесь и попробуйте снова.', retry: 'Ещё раз',
    hp: 'Броня', missiles: 'Ракеты', flares: 'Ловушки', lives: 'Самолёты', score: 'Очки', targets: 'Цели',
    missileWarning: 'РАКЕТА!', radarLock: 'Захват вражеским радаром', repairing: 'Ремонт и перевооружение…',
    returnHome: 'Броня на исходе — на базу', ocean: 'Нейтральные воды',
    gun: 'ПУШКА', msl: 'РАК', flr: 'ЛОВ', lock: 'ЗАХВАТ',
    sam: 'ПВО', radar: 'Радар', airbase: 'Авиабаза', fighter: 'Истребитель',
    destroyed: '{x}: уничтожен', lost: 'Самолёт сбит! Новый уже в пути…', conquered: 'Захвачено стран: {n}',
    base: 'База', enemy: 'Враг',
  },
  zh: {
    title: '天空战线', subtitle: '世界地图上的空战',
    play: '新战争', continue: '继续战役', settings: '设置', controls: '操作说明',
    chooseCountry: '选择你的国家', chooseEnemy: '选择要交战的国家', search: '搜索国家…',
    random: '随机', suggested: '附近国家', allCountries: '所有国家', back: '返回',
    warDeclared: '{a}向{b}宣战！',
    objective: '摧毁 {n} 个敌方目标：防空系统、雷达和空军基地。',
    start: '起飞！', language: '语言', gameSpeed: '游戏速度', slow: '慢', medium: '中', fast: '快',
    sound: '声音', on: '开', off: '关',
    controlsDesktop: '键盘：← → 转向，↑ ↓ 油门，空格 机炮，F 导弹，Q 干扰弹，+ − 缩放，P 暂停。',
    controlsMobile: '手机：把左侧摇杆推向想飞的方向（越远越快）。右侧按钮：机炮、导弹、干扰弹。',
    controlsTips: '机头对准目标直到出现“锁定”，然后发射导弹。导弹警告时投放干扰弹并急转。飞回基地可维修和补给。',
    pause: '暂停', paused: '已暂停', resume: '继续', quit: '主菜单',
    victory: '胜利！', victoryText: '{b}已投降！你的空军掌控了它的天空。', nextWar: '下一场战争',
    defeat: '失败', defeatText: '你的飞机全部损失。重整旗鼓再来一次。', retry: '重试',
    hp: '装甲', missiles: '导弹', flares: '干扰弹', lives: '飞机', score: '分数', targets: '目标',
    missileWarning: '导弹来袭！', radarLock: '被敌方雷达锁定', repairing: '维修并补给中…',
    returnHome: '装甲不足——返回基地', ocean: '国际水域',
    gun: '机炮', msl: '导弹', flr: '干扰', lock: '锁定',
    sam: '防空系统', radar: '雷达', airbase: '空军基地', fighter: '战斗机',
    destroyed: '{x}已被摧毁', lost: '飞机被击落！新飞机即将抵达…', conquered: '已占领国家：{n}',
    base: '基地', enemy: '敌人',
  },
};

let current = 'en';
let regionNames = null;

export function detectLang(saved) {
  if (saved && LANGS[saved]) return saved;
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const short = String(l).slice(0, 2).toLowerCase();
    if (LANGS[short]) return short;
  }
  return 'en';
}

export function setLang(lang) {
  current = LANGS[lang] ? lang : 'en';
  try { regionNames = new Intl.DisplayNames([current], { type: 'region' }); } catch { regionNames = null; }
  nameCache.clear();
  document.documentElement.lang = current;
  document.documentElement.dir = LANGS[current].dir;
}

export const getLang = () => current;
export const isRtl = () => LANGS[current].dir === 'rtl';

export function t(key, vars) {
  let s = (S[current] && S[current][key]) ?? S.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

const nameCache = new Map();
export function countryName(code) {
  let n = nameCache.get(code);
  if (n) return n;
  try { n = regionNames ? regionNames.of(code) : code; } catch { n = code; }
  if (!n) n = code;
  nameCache.set(code, n);
  return n;
}

export function flag(code) {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
