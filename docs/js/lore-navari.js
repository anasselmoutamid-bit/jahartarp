/* ═══ NAVARI — empire statique avec popup paginé ═══
   Données structurées injectées dans DATA.empires après chaque snapshot Firestore.
   Le rendu paginé est déclenché par la présence du champ `pages`. */

window.STATIC_EMPIRES = window.STATIC_EMPIRES || [];

window.STATIC_EMPIRES.push({
  id: 'navari-static',
  category: 'empires',
  isStatic: true,

  /* ── Card front ── */
  name: 'Navari',
  sub: 'La Cité aux Niveaux',
  ico: '🌃',
  color: '#FF4757',
  desc: "Cité-état verticale au cœur de la plaine de Velmara. Le pouvoir, la richesse et la lumière s'éteignent à mesure que l'on descend dans les strates souterraines — du Trône de Verre au Sommet aux Égouts de Fer.",
  tags: ['Cité-état', 'Verticale', 'Cyber-industrielle', 'Dynastique'],
  status: 'Souverain',

  /* ── Quick stats (band sous le bandeau) ── */
  quickStats: [
    { val: '6',     lbl: 'Strates' },
    { val: '1500',  lbl: 'Gardes royaux' },
    { val: '40',    lbl: 'Entrées palais' },
    { val: '2ᵉ',    lbl: 'Monnaie de Jaharta' }
  ],

  /* ── Pages (onglets dans le popup) ── */
  pages: [
    /* ─────────── 01 · GÉOLOGIE ─────────── */
    {
      id: 'geologie',
      title: 'Géologie',
      ico: '⛰️',
      tagline: 'Roches, failles et anomalies du sous-sol',
      sections: [
        {
          title: 'Contexte topographique',
          content: "Navari se dresse au cœur de la **plaine de Velmara**, vaste dépression tectonique née d'un ancien bassin d'effondrement *(graben)*. Tout autour, un arc montagneux millénaire — la **Couronne d'Almeryn** — encercle la cité comme un rempart de pierre.\n\nLe contraste géologique y est aussi violent que stratégique : une zone fertile et stable au centre, cernée de formations rocheuses escarpées et gorgées de ressources."
        },
        {
          title: 'Activités géotechniques & exploitation',
          features: [
            {
              ico: '🌋',
              name: 'Géothermie profonde',
              desc: "La plaine est traversée par de faibles anomalies thermiques, vestiges de poches magmatiques résiduelles sous les montagnes du sud. Elles alimentent les systèmes énergétiques autonomes de la cité."
            },
            {
              ico: '⛏️',
              name: 'Extraction minérale',
              desc: "Les flancs montagneux sont truffés de galeries minières anciennes, parfois récupérées par les Ordres ou les factions de l'Inquisition pour l'extraction stratégique de cristaux amplificateurs."
            },
            {
              ico: '🌀',
              name: 'Fissures telluriques',
              desc: "Certaines zones présentent des failles profondes stabilisées artificiellement, utilisées comme exutoires de chaleur ou de déchets toxiques par les installations cyber-industrielles."
            },
            {
              ico: '⚡',
              name: 'Résonances sismiques',
              desc: "Rares mais redoutées : des séismes induits par expérimentation peuvent réactiver d'anciens réseaux de cavernes ou libérer des poches de gaz oubliés — toxiques, hallucinogènes, parfois pires."
            }
          ]
        }
      ]
    },

    /* ─────────── 02 · TERRITOIRE ─────────── */
    {
      id: 'territoire',
      title: 'Territoire',
      ico: '🏗️',
      tagline: '« La Cité aux Niveaux » — modèle vertical autonome',
      intro: "Modèle vertical de cité-état autonome, où le **pouvoir, la richesse et la visibilité** diminuent à mesure que l'on descend dans les strates souterraines. Chaque niveau est administré, sécurisé et exploité indépendamment par des corps civils, religieux ou militaires spécifiques.",
      levels: [
        {
          depth: 0,
          tag: 'Surface · Superstructure',
          name: 'Le Sommet — Le Trône de Verre',
          color: '#FFD60A',
          ico: '👑',
          fn: 'Pouvoir exécutif suprême · résidence des figures dominantes',
          rows: [
            {
              key: 'Composition',
              list: [
                "Palais de Navari — résidence du Roi, de ses 4 femmes, 200 concubines et de la totalité de ses enfants",
                "Jardins suspendus, zones ultra-sécurisées, héliports"
              ]
            },
            {
              key: 'Accès',
              text: "Filtrage biométrique · drones de défense · ascenseurs codifiés · sextuple vérification aux 40 entrées · 1500 soldats et robots-soldats en garde permanente (24/24, 7/7)."
            },
            { key: 'Gouvernance', text: 'Le Roi.' }
          ]
        },
        {
          depth: -1,
          tag: 'Surface',
          name: 'Le Zenith Doré',
          color: '#FFB627',
          ico: '💎',
          fn: 'Ultra-riches · technarques · aristocratie marchande',
          rows: [
            {
              key: 'Composition',
              list: [
                "Sièges des banques principales et des institutions financières",
                "Boutiques de luxe, joailleries, restaurants étoilés",
                "Quartiers résidentiels d'élite",
                "Cathédrale Annexe de l'Inquisition-I"
              ]
            },
            {
              key: 'Services',
              text: "Sécurité privée · transport personnel par capsules · priorité absolue aux services de santé ultra-développés."
            },
            {
              key: 'Gouvernance',
              text: "Le **Consortium**, organe semi-étatique régulant flux, fiscalité et accès. Composé des trois dirigeants des familles les plus éminentes de la Cité."
            }
          ]
        },
        {
          depth: -2,
          tag: 'Au sol',
          name: 'Le Niveau de Cristal',
          color: '#00E5FF',
          ico: '🏙️',
          fn: 'Classes moyennes supérieures · commerçants établis',
          rows: [
            {
              key: 'Composition',
              list: [
                "Marchés centraux, galeries commerciales, centres médicaux",
                "Résidences standardisées, infrastructures sociales",
                "Grands parcs et zones vertes"
              ]
            },
            {
              key: 'Vie sociale',
              text: "Dynamique et active — première strate dotée d'un véritable espace public."
            },
            {
              key: 'Gouvernance',
              text: "Les **Gouvernorats Locaux**, financés par les impôts directs des résidents et supervisés par l'administration centrale."
            }
          ]
        },
        {
          depth: -3,
          tag: 'Sous-sol',
          name: 'Le Croissant Gris',
          color: '#9AA0B8',
          ico: '⚙️',
          fn: 'Travailleurs · petits commerces · indépendants',
          rows: [
            {
              key: 'Composition',
              list: [
                "Entrepôts, ateliers, services urbains (entretien, logistique)",
                "Bars, tavernes, lieux communautaires",
                "Habitats densément peuplés, souvent délabrés"
              ]
            },
            {
              key: 'Vie sociale',
              text: "Intense mais fragmentée. Les groupes syndicaux y sont implantés."
            },
            {
              key: 'Gouvernance',
              text: "Les **Préfectures Communautaires** — souvent corrompues ou infiltrées par des groupes de pression."
            }
          ]
        },
        {
          depth: -4,
          tag: 'Sous-sol',
          name: 'Les Fissures',
          color: '#FF6B35',
          ico: '🕳️',
          fn: "Pauvres · marginaux · immigrés illégaux · main-d'œuvre non déclarée",
          rows: [
            {
              key: 'Composition',
              list: [
                "Tavernes, marchés informels, zones de refuge",
                "Logements précaires, squats, couloirs inachevés"
              ]
            },
            {
              key: 'Ambiance',
              text: "Hostile, crépusculaire — tension constante avec les autorités supérieures."
            },
            {
              key: 'Gouvernance',
              text: "Partiellement abandonnée. Contrôlée par des gangs locaux, des milices, ou l'**Inquisition-I**."
            }
          ]
        },
        {
          depth: -5,
          tag: 'Profondeurs',
          name: 'Les Égouts de Fer',
          color: '#8B5CF6',
          ico: '☠️',
          fn: 'Exilés · sans-abris · hors-la-loi · criminalité organisée',
          rows: [
            {
              key: 'Composition',
              list: [
                "Marché noir, laboratoires illégaux, caches",
                "Réseaux parallèles d'alimentation et de communication"
              ]
            },
            {
              key: 'Architecture',
              text: "Souterrains instables, zones d'égout, anciennes fondations."
            },
            {
              key: 'Ambiance',
              text: "Surréaliste, dangereuse, parfois franchement surnaturelle."
            },
            {
              key: 'Gouvernance',
              text: "Aucune autorité officielle — cités parasites autogérées. L'**Inquisition** y mène des purges sporadiques baptisées « **Éclipses** »."
            }
          ]
        }
      ]
    },

    /* ─────────── 03 · ÉCONOMIE ─────────── */
    {
      id: 'economie',
      title: 'Économie',
      ico: '💰',
      tagline: 'Kanite, taxes officielles et monnaies parallèles',
      sections: [
        {
          title: 'Monnaie principale — le Kanite',
          content: "Le **Kanite** est la deuxième monnaie la plus forte de Jaharta. Géré et frappé par la **Chambre des Dynastes**, il se décline en quatre paliers de force.",
          ladder: [
            { name: 'Kanite de Bronze',  tier: 'I',   val: '1',                 desc: 'Monnaie de base',                        color: '#CD7F32' },
            { name: "Kanite d'Argent",   tier: 'II',  val: '100 Bronze',        desc: '= 100 K. de Bronze',                     color: '#C0C0C0' },
            { name: "Kanite d'Or",       tier: 'III', val: '10 000 Bronze',     desc: "= 100 K. d'Argent",                      color: '#FFD60A' },
            { name: 'Kanite de Platine', tier: 'IV',  val: '1 000 000 Bronze',  desc: "= 100 K. d'Or · 10 000 K. d'Argent",     color: '#E5E4E2' }
          ]
        },
        {
          title: 'Taxes',
          intro: "Plusieurs taxes existent à Navari. Les deux principales sont :",
          taxes: [
            { name: 'Taxe Impériale', val: '8 %',   desc: 'Sur chaque transaction.' },
            { name: 'Taxe Ducale',    val: '3 %',   desc: 'Versée à la famille gérant le marché concerné.' },
            { name: 'Taxe de Guilde', val: '± 3 %', desc: "Appliquée à l'achat ou à la vente via la Guilde." }
          ]
        },
        {
          title: 'Monnaie souterraine',
          content: "Plus l'on pénètre dans les profondeurs de la cité, plus les moyens s'amenuisent. De nouvelles formes de transactions y voient le jour.",
          alt: [
            {
              ico: '🧠',
              name: 'Don de souvenirs',
              desc: "Tous les citoyens sont équipés de processeurs intra-cérébraux munis d'un port USB-G permettant d'enregistrer ce qui est vu et entendu sur des clés ou des puces. Les souvenirs à valeur spécifique deviennent ainsi une monnaie d'échange.",
              warn: "Un souvenir enregistré est endommagé chez son propriétaire initial : trous de mémoire, zones d'oubli, voire amnésies totales si la durée dépasse cinq minutes."
            },
            {
              ico: '🔥',
              name: 'Paiement en nature',
              desc: "Pas besoin d'en dire plus."
            },
            {
              ico: '🤝',
              name: 'Troc & échange de bons procédés',
              desc: "Assez clair."
            }
          ]
        }
      ]
    }
  ]
});
