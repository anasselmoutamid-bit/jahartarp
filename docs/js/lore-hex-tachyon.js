/* ═══ HEX-TACHYON — empire statique avec popup paginé + verrouillage admin ═══
   La cité-état est gardée verrouillée par défaut ; un admin peut la déverrouiller
   pour tous via l'option « Déverrouiller » du popup (état stocké dans
   Firestore : config/lore_locks → entries[id]). */

window.STATIC_EMPIRES = window.STATIC_EMPIRES || [];

window.STATIC_EMPIRES.push({
  id: 'hex-tachyon-static',
  category: 'empires',
  isStatic: true,
  defaultLocked: true,

  /* ── Card front ── */
  name: 'Hex-Tachyon',
  sub: 'La Cité Fractale',
  ico: '🔷',
  color: '#00E5FF',
  desc: "Capitale d'Exodus, nichée au creux d'un cratère de volcan éteint artificiellement. Sa technologie — exosquelettes, armes ultramodernes, machinerie holographique — n'a aucun équivalent connu sur Jaharta.",
  tags: ['Cité-état', 'Capitale d\'Exodus', 'Cyber-tech', 'Cratère volcanique'],
  status: 'Capitale technologique',

  /* ── Quick stats (band sous le bandeau) ── */
  quickStats: [
    { val: '8',     lbl: 'Districts' },
    { val: '14 km', lbl: 'Cratère ⌀' },
    { val: '3',     lbl: 'Régents' },
    { val: '2',     lbl: 'Monnaies' }
  ],

  /* ── Pages (onglets dans le popup) ── */
  pages: [
    /* ─────────── 01 · GÉOGRAPHIE ─────────── */
    {
      id: 'geographie',
      title: 'Géographie',
      ico: '🌋',
      tagline: 'Le berceau du Tachyon-Caldera',
      sections: [
        {
          title: 'La Caldeira de Tachyon',
          content: "Hex-Tachyon est bâtie au cœur d'un ancien volcan, le **Tachyon-Caldera**, dont l'éruption fut **artificiellement étouffée** voici près de deux millénaires par les bâtisseurs originels. La cité est née dans la cicatrice — un cratère parfait de **14 km de diamètre**, ceint de murailles rocheuses hautes de **800 mètres** qui isolent l'espace urbain du reste du continent.\n\nLe geste fondateur — sceller un volcan vivant pour y dresser une ville — donna son nom à la *Veine Tachyon* : ce courant d'énergie résiduelle, capté en profondeur, alimente encore aujourd'hui l'intégralité du réseau de la cité-état."
        },
        {
          title: 'Architecture & verticalité',
          features: [
            {
              ico: '🌐',
              name: 'Voile Stratosphérique',
              desc: "Un dôme atmosphérique semi-transparent recouvre l'intégralité de la caldeira, modulant la lumière, la pression et l'humidité au gré des saisons synthétiques décrétées par le Conseil Régent."
            },
            {
              ico: '🛰️',
              name: 'Plateformes flottantes',
              desc: "Des dalles anti-gravitiques se déploient à différentes altitudes au-dessus du cratère, permettant aux strates aristocratiques de s'élever bien au-dessus du sol — Halo-Véga culmine à plus de 600 m."
            },
            {
              ico: '🔥',
              name: 'Cœur Magmatique scellé',
              desc: "Sous la cité, une chambre magmatique dormante reste contenue par un dispositif de résonateurs entretenus en continu. Sa chaleur résiduelle alimente la géothermie, mais une défaillance déclencherait une catastrophe à l'échelle continentale."
            },
            {
              ico: '🛡️',
              name: 'Bouclier électromagnétique naturel',
              desc: "Les parois rocheuses chargées en cristaux ferreux agissent comme une cage de Faraday géante. Les ondes hostiles sont déviées : Hex-Tachyon est l'une des villes les plus difficiles à infiltrer par signal externe."
            }
          ]
        }
      ]
    },

    /* ─────────── 02 · TERRITOIRE ─────────── */
    {
      id: 'territoire',
      title: 'Territoire',
      ico: '🏙️',
      tagline: 'Huit districts, du Nexus suspendu aux Égouts oubliés',
      intro: "La cité s'organise autour de huit districts répartis du sommet flottant aux profondeurs du cratère. Chaque district possède sa propre juridiction, sa propre gestion énergétique, et ses propres règles informelles — un mille-feuille politique où **l'altitude détermine l'autorité**.",
      levels: [
        {
          depth: 1,
          tag: 'Centre · Place fractale',
          name: 'Nexus Régent',
          color: '#FFD60A',
          ico: '👁️',
          fn: "Épicentre politique & énergétique — Résidence des Trois Régents",
          rows: [
            {
              key: 'Description',
              text: "Forteresse d'hologrammes, de piliers à impulsions quantiques et de miroirs de données. Au cœur se dresse l'**Hôtel de Tri-Astorg**, résidence des Trois Régents, enveloppée d'un dôme anti-intrusion vibrant à la fréquence des volontés dominantes."
            },
            {
              key: 'Composition',
              list: [
                "Hôtel de Tri-Astorg — résidence des Régents",
                "Tours administratives flottant au-dessus de la place fractale",
                "Centre de surveillance algorithmique de la cité"
              ]
            },
            {
              key: 'Vie sociale',
              text: "Les citoyens les plus influents y échangent leurs faveurs comme des artefacts sacrés."
            }
          ]
        },
        {
          depth: 2,
          tag: 'Suspendu · Sanctuaire des Étoiles',
          name: 'Halo-Véga',
          color: '#FF6B9D',
          ico: '⭐',
          fn: 'Quartier des célébrités — figures publiques adulées',
          rows: [
            {
              key: 'Accès',
              text: "Isolé du reste de la cité par une **barrière énergétique prisme**. On n'y entre que sur **invitation génétiquement encodée**."
            },
            {
              key: 'Composition',
              list: [
                "Tours cristallines flottantes, piscines à anti-gravité",
                "IA domestiques capables de simuler l'amour éternel",
                "Clones serviteurs · soirées dans des plans parallèles privatifs",
                "Stars du NexusNet, chanteurs psioniques, idols post-humaines"
              ]
            },
            {
              key: 'Particularité',
              text: "Les rues changent de forme selon l'humeur collective des résidents ; la météo y est une œuvre d'art vivante."
            }
          ]
        },
        {
          depth: 3,
          tag: 'Sommets spirales · Hauts-dômes',
          name: 'Cryptherion',
          color: '#00E5FF',
          ico: '💠',
          fn: "Quartier riche — élites économiques & cyber-ingénieurs",
          rows: [
            {
              key: 'Composition',
              list: [
                "Immeubles à gravité modulée",
                "Jardins synthétiques, passerelles de néons privés",
                "IA domestiques conscientes",
                "Magnats du NexusNet, aristocrates post-humains"
              ]
            },
            {
              key: 'Particularité',
              text: "Les lois y sont **« personnalisées » par abonnement**."
            }
          ]
        },
        {
          depth: 4,
          tag: 'Sol · Centre commercial de l\'infini',
          name: 'Agora Flux',
          color: '#FFB627',
          ico: '🛍️',
          fn: 'Quartier marchand — cœur pulsant de l\'économie visible',
          rows: [
            {
              key: 'Description',
              text: "Entrelacs de bazars cybernétiques, échoppes modulaires et marchés en réalité augmentée."
            },
            {
              key: 'Échanges',
              list: [
                "Artefacts magitech, implants légaux",
                "Données altérées, bêtes hybrides",
                "Tout se vend, tout s'échange"
              ]
            },
            {
              key: 'Pouvoir',
              text: "Les flux de **HoloCoin** crépitent au rythme des enchères vocales. Les **guildes de marchands** y sont aussi puissantes que les militaires."
            }
          ]
        },
        {
          depth: 5,
          tag: 'Sol · Vivier social',
          name: 'Quadrant Subline',
          color: '#44FF88',
          ico: '🎭',
          fn: 'Quartier populaire — castes moyennes, rêveurs, technomages indépendants',
          rows: [
            {
              key: 'Composition',
              list: [
                "Ruelles pleines de street art digital",
                "Cafés-boîtes quantiques, amphithéâtres de débats holographiques",
                "Espaces communs auto-administrés"
              ]
            },
            {
              key: 'Vie sociale',
              text: "On y croise autant **d'éclats de révolte** que **d'utopies temporaires**."
            }
          ]
        },
        {
          depth: 6,
          tag: 'Sol · Dôme des Sens',
          name: 'Nébuleuse Pourpre',
          color: '#C77DFF',
          ico: '🌸',
          fn: 'Quartier des plaisirs — charnels, virtuels, psychotropes ou spirituels',
          rows: [
            {
              key: 'Description',
              text: "District aux murs caméléons et aux parfums synthétiques, spécialisé dans les plaisirs sous toutes leurs formes."
            },
            {
              key: 'Composition',
              list: [
                "Cyber-cabarets, temples du rêve dirigés par des Oracles Sensitifs",
                "Arènes érotiques",
                "Simulateurs d'émotions extrêmes"
              ]
            },
            {
              key: 'Statut',
              text: "Officiellement toléré, **officieusement exploité par les Régents**."
            }
          ]
        },
        {
          depth: 7,
          tag: 'Sous-sol · Friche sous tension',
          name: 'Fosse de Kaon',
          color: '#FF6B35',
          ico: '🔻',
          fn: 'Quartier pauvre — zone en ruine sous le niveau principal',
          rows: [
            {
              key: 'Description',
              text: "Située sous le niveau principal, entre structures en ruine et data-tours effondrées. La lumière n'y atteint que par reflets filtrés et les infrastructures sont gérées par des **IA erratiques**."
            },
            {
              key: 'Vie quotidienne',
              text: "Les habitants vivent de récupérations, de deals illégaux et de systèmes D."
            },
            {
              key: 'Sécurité',
              text: "Les drones de sécurité n'y volent **qu'en escadrille armée**."
            }
          ]
        },
        {
          depth: 8,
          tag: 'Profondeurs · Conduits interdits',
          name: 'Infra-Kaos',
          color: '#FF4757',
          ico: '☣️',
          fn: 'Marché noir — labyrinthe souterrain s\'étendant sous toute la cité',
          rows: [
            {
              key: 'Échanges',
              list: [
                "Trafics d'artefacts interdits",
                "Codes corrompus, technologies inquisitionnées",
                "Refuge pour exilés, mutants et intelligences rejetées"
              ]
            },
            {
              key: 'Direction',
              text: "Aux mains des **« Courtiers Fantômes »** — opérateurs anonymes connus uniquement par leurs pseudonymes cryptés."
            }
          ]
        }
      ]
    },

    /* ─────────── 03 · ÉCONOMIE ─────────── */
    {
      id: 'economie',
      title: 'Économie',
      ico: '💠',
      tagline: 'Une monnaie d\'État, une monnaie d\'influence',
      sections: [
        {
          title: 'Le HoloCoin — monnaie légale',
          content: "Monnaie légale, **numérique et centralisée**. Créée par le Conseil Régent, le HoloCoin est la seule devise reconnue par la loi dans la cité-état. Géré par l'**Agence de Régulation Fractale**, chaque transaction est enregistrée dans un système quantique infalsifiable nommé **Flux-Archive**.",
          ladder: [
            { name: 'HoloCoin',          tier: 'HC',  val: '1,7 Kanites',          desc: 'Unité de base',                      color: '#00E5FF' },
            { name: 'SuperHoloCoin',     tier: 'SHC', val: '170 Kanites',          desc: '= 100 HC',                           color: '#4DA3FF' },
            { name: 'HyperHoloCoin',     tier: 'HHC', val: '17 000 Kanites',       desc: '= 10 000 HC',                        color: '#8B5CF6' },
            { name: 'PrismaticHoloCoin', tier: 'PHC', val: '1 700 000 Kanites',    desc: '= 1 000 000 HC',                     color: '#C77DFF' }
          ]
        },
        {
          title: 'Usages courants',
          intro: "Le HoloCoin couvre l'ensemble des transactions officielles à Hex-Tachyon :",
          taxes: [
            { name: 'Logement & santé',     val: '🏠', desc: 'Logement, services de base, cybermédecine.' },
            { name: 'Accès gradués',        val: '🔑', desc: "Droit d'entrée dans certains quartiers ou programmes sociaux." },
            { name: 'Fonctions d\'État',    val: '📜', desc: "Enregistrement de commerce, transport public avancé, administration." }
          ]
        },
        {
          title: 'Le CredSpecter — monnaie sociale',
          content: "Monnaie sociale virtuelle **non-convertible**, adossée à la **réputation**.\n\nLe CredSpecter est une unité d'influence générée automatiquement par l'activité sociale, artistique ou politique d'un citoyen sur le **NexusNet**, la matrice virtuelle omniprésente d'Hex-Tachyon. Elle représente la notoriété, le charisme et l'impact culturel d'un individu.\n\nValeur instable, liée aux algorithmes sociaux, aux tendances et aux évaluations communautaires : **plus de likes et de vues, plus de CredSpecters**. Émise par **Vortex Inc.**, l'entreprise au sommet du monde de la célébrité.",
          alt: [
            {
              ico: '📵',
              name: 'Non convertible légalement',
              desc: "Impossible à échanger contre du HoloCoin par les circuits bancaires traditionnels."
            },
            {
              ico: '🎫',
              name: 'Privilèges & accès',
              desc: "Échangeable contre privilèges sociaux, accès événementiels, invitations à Halo-Véga, services d'artistes ou contrats personnalisés."
            },
            {
              ico: '📊',
              name: 'Influence officielle',
              desc: "Influence la perception publique, les classements officiels et l'intérêt des mécènes régents."
            },
            {
              ico: '🕶️',
              name: 'Marché parallèle',
              desc: "Il est possible de **vendre des CredSpecters à l'insu de l'État** — pratique tolérée tant qu'elle reste discrète.",
              warn: "La vente détectée entraîne une déchéance de score et un signalement par la Fractale."
            }
          ]
        }
      ]
    }
  ]
});
