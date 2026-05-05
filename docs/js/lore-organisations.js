/* ═══ ORGANISATIONS STATIQUES — popups paginés ═══
   Trois organisations majeures de Jaharta : L'Inquisition-I, Vortex Inc., The Coven.
   Données injectées dans DATA.organisations après chaque snapshot Firestore.
   Le rendu paginé (org-style) est déclenché par la présence du champ `pages`. */

window.STATIC_ORGS = window.STATIC_ORGS || [];

/* ═════════════════════════════════════════════════════════════════════════════
   ╔═══════════════════════════════════════════════════════════════════════════╗
   ║  01 ▸  L'INQUISITION-I  ─────────  Culte du Transcendé                    ║
   ╚═══════════════════════════════════════════════════════════════════════════╝
   ═════════════════════════════════════════════════════════════════════════ */
window.STATIC_ORGS.push({
  id: 'inquisition-i-static',
  category: 'organisations',
  isStatic: true,

  /* ── Card front ── */
  name: "L'Inquisition-I",
  sub: "Le Culte du Transcendé",
  ico: "⛧",
  color: "#FF4757",
  desc: "Église monothéiste prônant la suprématie de la race humaine et la déchéance des Principes, vénérant un humain ayant transcendé les limites de l'univers.",
  tags: ["Culte", "Théocratique", "Suprasouverain", "Monothéiste"],
  status: "Suprasouverain",

  /* ── Image principale (laisser vide pour afficher le placeholder) ── */
  imageUrl: "",
  imageCaption: "Sceau de l'Élue — Cathédrale Illustre",

  /* ── Quick stats ── */
  quickStats: [
    { val: "2,5 Mds", lbl: "Fidèles" },
    { val: "537",     lbl: "Calibers" },
    { val: "5",       lbl: "Magisters" },
    { val: "10",      lbl: "Lois sacrées" }
  ],

  /* ── Bandeau opérationnel ── */
  banner: {
    tag: "Organisation · Culte théocratique",
    operates: "Navari · Hex-Tachyon · Shaanima"
  },

  /* ── Pages ── */
  pages: [
    /* ───── 01 · DOCTRINE ───── */
    {
      id: "doctrine",
      title: "Doctrine",
      ico: "✦",
      tagline: "Le Verbe de l'Élue, suprématie humaine et déchéance des Principes",
      sections: [
        { imageHero: true },
        {
          title: "Profession de foi",
          content: "L'Inquisition-I est une **église monothéiste** prônant la **suprématie de la race humaine** ainsi que la **déchéance des Principes**, vénérant un humain ayant transcendé les limites de l'univers : *l'Élue*. Sa parole est loi, son silence est parole, son absence est présence.\n\nLe culte se nomme officiellement le **Culte du Transcendé**. Tout fidèle, ou hérétique, est jugé selon une seule mesure : sa proximité ou son éloignement de la voie tracée par l'Être Suprême."
        },
        {
          title: "Aire d'opération",
          features: [
            { ico: "🌃", name: "Navari", desc: "Cathédrale annexe au Zénith Doré · purges régulières dans les Égouts de Fer (« Éclipses »)." },
            { ico: "🔷", name: "Hex-Tachyon", desc: "Présence diffuse mais influente · contrôle des courants idéologiques par les Légats." },
            { ico: "✶",  name: "Shaanima", desc: "Bastion ancien du dogme · cathédrales fortifiées et tribunaux du Dogme." }
          ]
        },
        {
          title: "Devise opérante",
          content: "*« Plus on voit, moins on parle. Plus on sait, moins on est visible. »*"
        }
      ]
    },

    /* ───── 02 · HIÉRARCHIE ───── */
    {
      id: "hierarchie",
      title: "Hiérarchie",
      ico: "⚜",
      tagline: "Sept paliers verticaux de la chair et de la foi",
      sections: [
        {
          title: "L'échelle de l'Inquisition",
          ranks: [
            {
              tier: "00",
              name: "Être Suprême",
              role: "Centre du culte · pleins pouvoirs",
              desc: "L'Élue. Centre du culte et raison même de son existence. Sa voix est loi. Nul ne la commande, nul ne peut la voir sans y être convoqué.",
              color: "#FFD60A"
            },
            {
              tier: "01",
              name: "Pentagone Ardent — Magisters",
              role: "5 piliers · pouvoir quasi-absolu sur leur axe",
              desc: "Cinq archistes répondant chacun à un pilier non divisible : la **Force**, la **Foi**, le **Dogme**, la **Volonté** et la **Suprématie**. Leur autorité sur les troupes affectées à leur axe est quasi absolue.",
              color: "#FF6B6B"
            },
            {
              tier: "02",
              name: "Calibers",
              role: "537 commandants de brigade",
              desc: "Au nombre exact des brigades (y compris les trois spéciales). Chacun gère une cathédrale-QG et ses subalternes. Seuls communicants directs avec les Magisters.",
              color: "#FF8C42"
            },
            {
              tier: "03",
              name: "Voix d'Elaas & Légats",
              role: "Juges émissaires · diplomatie",
              desc: "La Voix d'Elaas est le Juge Émissaire d'Urgence — elle peut juger un pays entier sur ordre de Sa Pureté. Les Légats sont ses yeux, oreilles, et les seuls diplomates de l'Inquisition.",
              color: "#FFA75A"
            },
            {
              tier: "04",
              name: "Oracles & Orateurs",
              role: "Prêtres, nonnes, communication inter-cathédrale",
              desc: "Les Vélastres (♂) et Oriales (♀) veillent à l'intégrité des cathédrales annexes. Les Orateurs et Oratrices répandent les mots de Sa Suprématie au peuple.",
              color: "#E8A87C"
            },
            {
              tier: "05",
              name: "Exécuteurs",
              role: "Soldats d'élite · noms retenus",
              desc: "Ferveur ayant multiplié les prouesses. Membre d'élite ayant reçu la bénédiction de voir son nom retenu par Sa Suprématie elle-même.",
              color: "#C38D9E"
            },
            {
              tier: "06",
              name: "Ferveurs",
              role: "Soldats de l'armée inquisitoriale",
              desc: "La masse opérante. Chair de l'Inquisition, exécutants des décrets. Affectés à un Caliber et un bataillon spécifique.",
              color: "#9B7EA8"
            },
            {
              tier: "07",
              name: "Luminés & Non-Vus",
              role: "Personnel · service rapproché",
              desc: "Luminés : entretien, repas, vie quotidienne des cathédrales. Non-Vus : harem personnel de l'Élue — incommunicables sans son autorisation.",
              color: "#7B6B91"
            }
          ]
        }
      ]
    },

    /* ───── 03 · STRUCTURE ───── */
    {
      id: "structure",
      title: "Structure",
      ico: "⛪",
      tagline: "Cathédrale Illustre, Pentagone Ardent et Cathédrales Annexes",
      sections: [
        {
          title: "Cathédrale Illustre",
          intro: "Le siège unique du pouvoir. Centralité absolue de l'Élue, entourée de ses corps de fonction silencieux.",
          features: [
            { ico: "👑", name: "Élue",                   desc: "Entité Suprême. Aucune communication directe possible sans convocation rituelle." },
            { ico: "🜍",  name: "Non-Vus",                desc: "Harem personnel. Servent l'Élue : tâches ménagères, garde rapprochée. Aucune âme n'a le droit ni la légitimité de leur parler." },
            { ico: "📜", name: "Gardiens Cryptographes", desc: "Érudits codifiant la langue de l'Inquisition. Archivent l'Histoire, les Lois et les Prophéties. Seuls habilités à demander audience à l'Élue, avec les Magisters." },
            { ico: "⚖",  name: "Voix d'Elaas",            desc: "Juge Émissaire d'Urgence. Peut juger l'entièreté d'un pays sur ordre de Sa Pureté. Surveille tous les royaumes et émet des comptes-rendus." },
            { ico: "📡", name: "Légats de la Voix",      desc: "Présents dans chaque Cathédrale annexe. Yeux et oreilles de la Voix d'Elaas. Diplomates attitrés — s'ils parlent." },
            { ico: "🜏",  name: "Ordre du Silence",       desc: "Section SPE-03 · les Sans-Visages. Basés à l'Île Centrale, missions de suppression discrètes. Mort subite, aucune preuve remontant à l'Inquisition." }
          ]
        },
        {
          title: "Pentagone Ardent — Les Cinq Ordres",
          intro: "Cinq piliers, cinq fonctions essentielles et non divisibles. Chaque Magister détient les presque-pleins-droits sur son axe.",
          pillars: [
            {
              ico: "⚔",
              name: "Ordre de la Force",
              tag: "Force exécutive · 535 bataillons",
              desc: "Colonne vertébrale de l'Inquisition. Chaque bataillon : Ferveurs, Exécuteurs, et un Caliber. Mène toute conquête ordonnée par l'Élue."
            },
            {
              ico: "🜂",
              name: "Ordre de la Volonté",
              tag: "Arcano-technologique · femmes érudites",
              desc: "Sécurité magique et développement des arcanes. Arme les bataillons, se divise en mages de guerre et de support en temps de campagne."
            },
            {
              ico: "🜔",
              name: "Ordre du Dogme",
              tag: "Punitif · pleins droits",
              desc: "Redressement et sanction. Tortures, violence, harcèlement — aucun moyen n'est de trop pour ramener une âme étourdie sur la voie de l'Élue."
            },
            {
              ico: "✦",
              name: "Ordre de la Foi",
              tag: "Manière douce · Orateurs & Oracles",
              desc: "Voix salvatrices. Convertisseurs du peuple, ils guident vers la voie de l'Élue uniquement par la parole et la conviction."
            },
            {
              ico: "☉",
              name: "Ordre de la Suprématie",
              tag: "3 sections spéciales · usage exceptionnel",
              desc: "Sollicité uniquement en cas de situation extrême, exceptionnelle et spécifique. Sa simple convocation marque la gravité du moment."
            }
          ]
        },
        {
          title: "Composition d'une Cathédrale Annexe",
          features: [
            { ico: "👁",  name: "Caliber",            desc: "Gérant Général de la Cathédrale." },
            { ico: "🜲",  name: "Oracles",            desc: "Vélastres / Oriales. Veillent à l'intégrité des membres et permettent la communication inter-cathédrales. Lien direct vers leur Magister." },
            { ico: "📡", name: "Légats de la Voix", desc: "Un par cathédrale. Ambassadeurs de l'Inquisition." },
            { ico: "🕯", name: "Orateurs",          desc: "Convertisseurs. Ne répondent pas au Caliber, mais à l'Oracle." },
            { ico: "⛧",  name: "Expieurs",           desc: "Membres du Dogme. Torturent les Hérétiques dans les sous-sols de la cathédrale." },
            { ico: "⚔",  name: "Exécuteurs & Ferveurs", desc: "Soldats sur le qui-vive en permanence." },
            { ico: "🜏",  name: "Sans-Visages",       desc: "Sections spéciales parfois présentes. Répondent au Caliber tant que ça ne contredit pas leur mission." },
            { ico: "🕊", name: "Luminés",            desc: "Personnel. Entretien, repas, vie quotidienne de la cathédrale." }
          ]
        }
      ]
    },

    /* ───── 04 · LOIS ───── */
    {
      id: "lois",
      title: "Lois",
      ico: "✠",
      tagline: "Les dix commandements scellés de l'Élue",
      sections: [
        {
          laws: [
            {
              num: "I",
              title: "Loi de l'Élue",
              hook: "Nul ne commande à l'Élue. Nul ne peut le voir sans y être convoqué. Nul ne commente son silence.",
              body: "Son silence est parole.\nSon absence est présence.\nL'Élu Suprême est au-dessus de toute structure."
            },
            {
              num: "II",
              title: "Loi de l'Ascension Scellée",
              hook: "Un rang ne peut être atteint que par absolution du rang supérieur et approbation silencieuse de l'Élue.",
              body: "Tout passage de rang nécessite un rite d'effacement du passé.\nLa mémoire de l'ascension est scellée par voie rituelle : même le promu ne s'en souvient plus."
            },
            {
              num: "III",
              title: "Loi de la Voix Unique",
              hook: "Un Inquisiteur parle au nom de l'ensemble, ou il ne parle pas.",
              body: "Aucun membre ne peut s'exprimer publiquement sans autorisation hiérarchique.\nL'Inquisition ne reconnaît qu'une voix unifiée. Le doute exprimé publiquement est une forme de trahison."
            },
            {
              num: "IV",
              title: "Loi du Masque",
              hook: "La vérité ne peut être transmise nue. Elle doit être codée, masquée, fracturée.",
              body: "Les hauts gradés portent tous un masque lors des assemblées.\nTout texte sacré est chiffré, symbolique ou écrit dans une langue morte.\nL'Inquisition n'utilise jamais de langage direct dans ses décrets."
            },
            {
              num: "V",
              title: "Loi de l'Invisible",
              hook: "Plus on voit, moins on parle. Plus on sait, moins on est visible.",
              body: "Les rangs élevés vivent dans l'ombre.\nLes Calibers et Magisters ne s'exhibent jamais publiquement sans raison.\nLa visibilité est inversement proportionnelle à l'autorité."
            },
            {
              num: "VI",
              title: "Loi des Cathédrales Fermées",
              hook: "Une porte ouverte est une perte. Les cathédrales sont des entités sacrées, non des lieux publics.",
              body: "Aucun non-intronisé ne peut y pénétrer, même un roi.\nEntrer sans convocation est punissable d'oubli permanent (effacement de toute trace de vie).\nUne convocation équivaut à un jugement."
            },
            {
              num: "VII",
              title: "Loi du Sang Purifié",
              hook: "Les lignées ne protègent pas. Le mérite ne suffit pas. Seul le sacrifice ouvre la voie.",
              body: "Aucune ascension ni immunité par filiation n'est possible.\nChaque rang doit être gagné par souffrance, preuve, et silence.\nLes enfants des membres n'ont aucun droit héréditaire."
            },
            {
              num: "VIII",
              title: "Loi de la Force Juste",
              hook: "La force n'est sacrée que si elle est orientée. La violence sans mandat est une hérésie de fer.",
              body: "Les légions ne peuvent agir sans décret inquisitorial.\nToute force armée privée est considérée suspecte et surveillée.\nUn usage de force injustifiée = jugement par un Caliber."
            },
            {
              num: "IX",
              title: "Loi de la Dissolution Contrôlée",
              hook: "Tout traître n'est pas supprimé. Certains doivent survivre pour que la peur vive.",
              body: "L'Inquisition entretient des hérétiques visibles, volontairement non capturés.\nLeur existence justifie la vigilance constante."
            },
            {
              num: "X",
              title: "Loi du Non-Rappel",
              hook: "Celui qui est effacé ne doit jamais être nommé.",
              body: "Aucune mention ne doit être faite d'un exilé, effacé ou condamné.\nMême les proches doivent cesser de prononcer son nom.\nLe Non-Rappel est la sanction la plus sacrée : vivre dans un monde où personne ne se souvient de toi."
            }
          ]
        }
      ]
    },

    /* ───── 05 · DIPLOMATIE ───── */
    {
      id: "diplomatie",
      title: "Diplomatie",
      ico: "🜲",
      tagline: "L'art de l'influence silencieuse",
      sections: [
        {
          title: "Nature",
          content: "L'Inquisition **négocie rarement**. Elle influence. Sa diplomatie n'est pas celle des royaumes ou des corporations : elle repose sur le poids du dogme, la peur du déclassement spirituel, et l'omniprésence silencieuse dans les cercles de pouvoir.\n\nElle agit comme une **entité suprasouveraine** : toute nation qui rejette ouvertement l'Inquisition se place *de facto* en état d'**hérésie passive**."
        },
        {
          title: "Principes Fondamentaux",
          features: [
            {
              ico: "✠",
              name: "Primauté du Dogme",
              desc: "Aucune loi civile ne peut contredire un précepte Inquisitorial. Les états doivent ajuster leurs politiques internes."
            },
            {
              ico: "⚖",
              name: "Neutralité Racialo-Politique",
              desc: "Aucune partie prise selon les races, ethnies ou idéologies — tant que la Force, la Volonté et l'Inquisition sont respectées."
            },
            {
              ico: "👁",
              name: "Doctrine du Regard Invisible",
              desc: "L'Inquisition ne s'exprime que par ses Voix. Jamais de participation aux forums publics ou traités multinationaux — mais elle les contrôle en amont."
            }
          ]
        },
        {
          title: "Outils Diplomatiques",
          features: [
            {
              ico: "👤",
              name: "Légats de l'Œil",
              desc: "Diplomates officiels, silencieux et masqués. Ils observent, influencent, mais ne négocient pas."
            },
            {
              ico: "📜",
              name: "Mandats de Conformité",
              desc: "Offres politiques en apparence facultatives, mais dont le rejet marque une nation comme « flétrie »."
            },
            {
              ico: "🜏",
              name: "Sans-Visages",
              desc: "Unités spéciales sollicitées à des fins de suppression d'éléments trop dérangeants pour la voie."
            }
          ]
        }
      ]
    }
  ]
});


/* ═════════════════════════════════════════════════════════════════════════════
   ╔═══════════════════════════════════════════════════════════════════════════╗
   ║  02 ▸  VORTEX INC.  ─────────  Compagnie de Management                    ║
   ╚═══════════════════════════════════════════════════════════════════════════╝
   ═════════════════════════════════════════════════════════════════════════ */
window.STATIC_ORGS.push({
  id: 'vortex-inc-static',
  category: 'organisations',
  isStatic: true,

  /* ── Card front ── */
  name: "Vortex Inc.",
  sub: "Agence de management des stars",
  ico: "✦",
  color: "#FFD60A",
  desc: "Vortex Inc. est une agence de management pour les stars et célébrités du monde entier. Du producteur au styliste, du Business Manager à l'Egerie, tout est conçu pour transformer un visage en empire.",
  tags: ["Compagnie", "Management", "Show-business", "Élite"],
  status: "Privé",

  /* ── Image principale (laisser vide pour afficher le placeholder) ── */
  imageUrl: "",
  imageCaption: "Logo holographique — Tour Vortex",

  /* ── Quick stats ── */
  quickStats: [
    { val: "1",   lbl: "Œil-d'En-Haut" },
    { val: "3",   lbl: "Sections" },
    { val: "★★★", lbl: "Mur des élites" },
    { val: "24/7", lbl: "Service" }
  ],

  /* ── Bandeau opérationnel ── */
  banner: {
    tag: "Organisation · Compagnie de management",
    operates: "Réseaux globaux · multi-empires"
  },

  /* ── Pages ── */
  pages: [
    /* ───── 01 · DIRECTION ───── */
    {
      id: "direction",
      title: "Direction",
      ico: "👁",
      tagline: "Au sommet de la tour, un regard qui voit tout",
      sections: [
        { imageHero: true },
        {
          title: "L'Œil-d'En-Haut · PDG",
          content: "**Autorité absolue de l'Agence**. Elle n'apparaît en public que lors d'événements d'importance capitale, ou de problèmes ne relevant plus de la fonction des Producteurs. Dans de rares cas, elle se montre pour féliciter un élément particulièrement impressionnant.\n\nSes décisions ne sont jamais commentées, ses ordres jamais discutés. Toute la pyramide Vortex tourne autour de son silence."
        },
        {
          title: "Architecture interne",
          features: [
            { ico: "★",  name: "StarForger",   desc: "Le forge des visages : Producteurs, Stylistes, Community Managers, Lifestyle Managers." },
            { ico: "💎", name: "PremiumClass", desc: "Pour les fortunés : Comptables d'élite, Business Managers, Event Managers, Egerie Managers, Escorting." },
            { ico: "🎭", name: "Talents",      desc: "Les visages publics — Stars, Idols, Influenceurs, Acteurs — et les ombres : Vixens, AI Idols, Sécurité." }
          ]
        }
      ]
    },

    /* ───── 02 · STARFORGER ───── */
    {
      id: "starforger",
      title: "StarForger",
      ico: "★",
      tagline: "Façonner les visages que le monde connaîtra",
      sections: [
        {
          tiers: [
            {
              num: "02",
              ico: "🎬",
              name: "Producteurs",
              tag: "Top 3 affiché · seuils d'accès à la PDG",
              desc: "Ils ont à leur charge les stars et célébrités. Leur but : faire de leurs recrues des éléments **parfaits**, alliant célébrité et revenus stables, mais surtout importants. Une myriade existe, mais seuls les **trois plus efficaces** ont le droit de toquer à la porte de la PDG."
            },
            {
              num: "03",
              ico: "💄",
              name: "SkinCaretakers — Stylistes",
              tag: "Une star par styliste · zéro tolérance",
              desc: "Une seule célébrité chacun. Maquillage, tenue, coiffe, coaching, psychologie : ils s'occupent de leur star comme d'un dôme en or qui se brisera au moindre souffle de vent. Tableau des trois meilleurs, mais **aucune tolérance** : un faux pas, et c'est la porte."
            },
            {
              num: "04",
              ico: "📱",
              name: "Community Managers",
              tag: "Voix numérique des stars",
              desc: "Tout ce qui touche aux réseaux sociaux : posts, messageries, réponses aux fans, stories. En somme, ils sont **la voix** des stars hors caméra."
            },
            {
              num: "05",
              ico: "🛎",
              name: "Lifestyle Managers",
              tag: "Tout ce qui touche au quotidien",
              desc: "Trouver un appartement, appeler un taxi, commander des tenues, trouver un écrivain de chanson, licencier un majordome… tout est éreintant pour une star. Le Lifestyle Manager s'en occupe — du choix de la peinture de salle de bain à la planification de la dernière voiture livrée."
            }
          ]
        }
      ]
    },

    /* ───── 03 · PREMIUMCLASS ───── */
    {
      id: "premiumclass",
      title: "PremiumClass",
      ico: "💎",
      tagline: "Pour ceux qui n'ont jamais à compter",
      sections: [
        {
          tiers: [
            {
              num: "06",
              ico: "📊",
              name: "Maîtres Experts-Comptables",
              tag: "Honoraires 7 chiffres · déclarations jamais vérifiées",
              desc: "Les Experts-Comptables sont renommés pour leur fiabilité. Les **Maîtres** sont un cran au-dessus. Leurs honoraires dépassent les sept chiffres, mais leurs déclarations **ne sont jamais vérifiées par l'État**. De quoi réjouir les fortunés cherchant à camoufler une grosse partie de leurs revenus."
            },
            {
              num: "07",
              ico: "💼",
              name: "Business Managers",
              tag: "PDG de substitution · prouesses garanties",
              desc: "Licencier les mauvais éléments, les remplacer par des trésors du marché du travail, **sextupler** vos chiffres d'affaires, ou monter une entreprise atteignant **un milliard d'HoloCoin en moins de neuf mois** — il en est capable. Pourquoi ? Parce qu'il est reconnu. Honoraires aussi impressionnants que les résultats."
            },
            {
              num: "08",
              ico: "🥂",
              name: "Event Managers",
              tag: "Private parties · rooftops · plane meetings",
              desc: "Organisateur sans égal. Peu importe le thème demandé, il **surpassera les espérances et bien plus encore**. Honoraires hors de ce monde."
            },
            {
              num: "09",
              ico: "🎀",
              name: "Egerie Managers",
              tag: "Partenariat StarForger · contrats d'ambassadeur",
              desc: "En partenariat avec StarForger, génère des contrats d'égérie et d'ambassadeur avec les stars Vortex. **Plus les honoraires sont gros, plus la star sera brillante.**"
            },
            {
              num: "10",
              ico: "🌹",
              name: "Escorting Manager",
              tag: "[ERP] Stars du film adulte · agendas post-travail",
              erp: true,
              desc: "Le filet de Vortex ne se limite pas au monde de la lumière. L'Escorting Manager règle votre agenda **post-travail** pour vous décompresser avec les plus grandes stars du film adulte — tant que le compte bancaire en est capable. Massages, danses, tenues, sorties en restaurant : toutes les demandes sont satisfaites tant que le virement est effectué en temps et en heure."
            }
          ]
        }
      ]
    },

    /* ───── 04 · TALENTS ───── */
    {
      id: "talents",
      title: "Talents",
      ico: "🎭",
      tagline: "Personnel exécutif & visages publics",
      sections: [
        {
          tiers: [
            {
              num: "11",
              ico: "★",
              name: "Stars · Idols · Influenceurs · Acteurs",
              tag: "Image extérieure · avantages selon célébrité",
              desc: "Connus de tous. Les avantages **augmentent en fonction de leur réputation et célébrité** : meilleur logement offert, **Platinum NexusCard** (carte bancaire prestige), cadeaux des plus grandes marques, flexibilité des lois…"
            },
            {
              num: "12",
              ico: "🌹",
              name: "Vixens · Maids/Majordomes · Escortes · Pornstars",
              tag: "[ERP] Image sombre · honoraires standards + extras négociables",
              erp: true,
              desc: "Image sombre de Vortex. Une fortune astronomique pour leurs services, mais qualité et panoplie en valent chaque HoloCoin. Les honoraires couvrent les services standards ; les **extras** se négocient à l'avance avec le Producteur en amont du début de période de service."
            },
            {
              num: "13",
              ico: "🤖",
              name: "AI Idols Copies",
              tag: "Clones robotiques de stars · prix selon cote",
              desc: "Oui. Vortex clone ses stars en versions robotiques. Il est tout à fait possible d'**acheter une copie conforme** de son idol préféré pour soi. Les prix dépendent évidemment de la cote de la star en question."
            },
            {
              num: "14",
              ico: "🛡",
              name: "Sécurité · Gardes du corps · Huissiers",
              tag: "Force opérationnelle visible",
              desc: "Force visible et fiable qui escorte, protège, et fait respecter les contrats Vortex. Présents en marge de chaque événement, chaque tournée, chaque livraison sensible."
            }
          ]
        }
      ]
    },

    /* ───── 05 · FACE CACHÉE ───── */
    {
      id: "face-cachee",
      title: "Face Cachée",
      ico: "⚠",
      tagline: "[ERP] Section verrouillée — accès admin requis",
      lockable: true,
      lockKey: "vortex-inc-static__face-cachee",
      lockedHint: "Cette page est **verrouillée par défaut**. Seul un administrateur peut la déverrouiller pour révéler la face cachée de Vortex Inc.",
      sections: [
        {
          title: "Domaines occultés de Vortex Inc.",
          intro: "*Tout ce qui suit n'a jamais été imprimé, jamais déclaré, jamais signé. Les Producteurs concernés se taisent. Les comptables d'élite arrondissent. Le PDG, lui, n'a aucun avis sur la question.*",
          features: [
            {
              ico: "🜏",
              name: "Trafic d'humains",
              desc: "Réseau opaque géré par une cellule détachée des Producteurs principaux. Recrutement « volontaire » de talents qui ne quittent plus jamais le contrat — physiquement comme administrativement."
            },
            {
              ico: "📦",
              name: "Idoles sur commande",
              desc: "Un client suffisamment fortuné peut commander une **idol sur-mesure** : phénotype, voix, comportement, spécialité. Le « processus de fabrication » dure entre six et dix-huit mois — entre StarForger et chirurgie clandestine."
            },
            {
              ico: "💱",
              name: "Idoles comme monnaie de contrat",
              desc: "Pour les contrats à neuf chiffres, certaines idols sont **transférées comme actifs** entre Vortex et la partie adverse. Elles n'ont aucun droit de regard sur la transaction."
            },
            {
              ico: "🜍",
              name: "Marché noir des Copies AI",
              desc: "Les AI Idols Copies officielles sont une couverture. Sous le manteau, il existe des copies **non bridées** — sans filtres comportementaux, sans verrous d'usage. Vendues à prix d'or à des cercles très privés."
            },
            {
              ico: "💉",
              name: "Programme de longévité forcée",
              desc: "Les stars trop rentables ne meurent pas. Greffes, transferts de conscience, prolongations chimiques. Le contrat ne s'arrête qu'au moment où la rentabilité tombe sous un seuil — pas au moment où le corps lâche."
            },
            {
              ico: "🎭",
              name: "Bureau des Identités Doubles",
              desc: "Un service très discret qui fournit à des élites politiques, militaires ou criminelles **une identité publique fabriquée** — une vraie carrière de star, montée de toutes pièces, pour servir de couverture à leur véritable activité."
            }
          ]
        },
        {
          title: "Note de l'administration",
          content: "*Cette page peut être re-verrouillée à tout moment via le bouton « 🔒 Re-verrouiller » dans la barre d'actions du popup. Toute modification ou ajout de contenu doit passer par le code source du fichier `lore-organisations.js`.*"
        }
      ]
    }
  ]
});


/* ═════════════════════════════════════════════════════════════════════════════
   ╔═══════════════════════════════════════════════════════════════════════════╗
   ║  03 ▸  THE COVEN  ─────────  Fraternité d'Helléan                         ║
   ╚═══════════════════════════════════════════════════════════════════════════╝
   ═════════════════════════════════════════════════════════════════════════ */
window.STATIC_ORGS.push({
  id: 'coven-static',
  category: 'organisations',
  isStatic: true,

  /* ── Card front ── */
  name: "The Coven",
  sub: "Fraternité d'Helléan",
  ico: "🜨",
  color: "#8B5CF6",
  desc: "Fraternité éternelle de cinq sorcières surpuissantes, chacune gardienne d'un Cercle. Existant dans une dimension parallèle, elles tissent dans l'ombre d'Helléan.",
  tags: ["Fraternité", "Occulte", "Magie originelle", "Helléan"],
  status: "Clandestin",

  /* ── Image principale (laisser vide pour afficher le placeholder) ── */
  imageUrl: "",
  imageCaption: "Sigil des Cinq Cercles — Sanctuaire scellé",

  /* ── Quick stats ── */
  quickStats: [
    { val: "5",  lbl: "Consœurs" },
    { val: "10", lbl: "Arcanes Nocturnes" },
    { val: "∞",  lbl: "Initiés" },
    { val: "1",  lbl: "Mythe (Arcaniste)" }
  ],

  /* ── Bandeau opérationnel ── */
  banner: {
    tag: "Organisation · Fraternité occulte",
    operates: "Shaanima · Helléan"
  },

  /* ── Pages ── */
  pages: [
    /* ───── 01 · LES CONSŒURS ───── */
    {
      id: "consoeurs",
      title: "Les Consœurs",
      ico: "✺",
      tagline: "Cinq gardiennes, cinq Cercles, une dimension parallèle",
      sections: [
        { imageHero: true },
        {
          title: "Les Cinq",
          intro: "À la tête du Coven, **cinq sorcières surpuissantes** capables de plier les lois naturelles à leur volonté. Existant la plupart du temps dans une dimension parallèle, elles sont **discrètes, létales, et à l'abri de tout danger**. Elles ne quittent jamais leur sanctuaire et ne parlent au monde qu'à travers leurs Arcanes Nocturnes.",
          circles: [
            {
              name: "Haelanthéa",
              cercle: "Cercle de l'Abrupte",
              ico: "🜂",
              color: "#FF4757",
              desc: "Incarnation de la **puissance magique et mentale brute**. Elle domine les flux psychiques, effrite les os, brise les volontés. La plus redoutée dans les interrogatoires d'âme."
            },
            {
              name: "Morréïs",
              cercle: "Cercle de l'Illusoire",
              ico: "◐",
              color: "#00E5FF",
              desc: "Maîtresse des **voiles et des reflets**. Elle transforme la réalité perçue, efface les présences, rend les vérités insaisissables. Nul ne sait jamais si elle est là — ou s'il s'imagine des choses."
            },
            {
              name: "Saphyss",
              cercle: "Cercle du Sommeil",
              ico: "☾",
              color: "#8B5CF6",
              desc: "Reine des **rêves et des subconscients**. Elle navigue dans les nuits des vivants, réveille les morts, convoque les souvenirs pour les remodeler. Elle parle aux enfants, aux fous, aux dormeurs."
            },
            {
              name: "Vornélya",
              cercle: "Cercle du Véridique",
              ico: "✦",
              color: "#FFD60A",
              desc: "**Prophétesse silencieuse**. Elle lit les lignes du destin, prédit les fractures du monde, grave les vérités que même le temps n'efface pas. L'œil fixe dans le chaos."
            },
            {
              name: "Lyxaëlle",
              cercle: "Cercle de l'Imaginaire",
              ico: "⬢",
              color: "#44FF88",
              desc: "**Fusion de la magie et de la machine**. Elle manipule les réseaux, les IA, les données-réalité comme des filaments vivants. La voix derrière les écrans noirs."
            }
          ]
        },
        {
          title: "[ERP] Statut intime",
          content: "*Théoriquement immortelles, les Consœurs sont **inaccessibles** à tout membre de l'organisation. Elles sont célestiellement promises à l'**Arcaniste**, bien que ce dernier n'existe plus. Toutefois, aucune règle ne leur interdit de se distraire avec leurs Arcanes Nocturnes, qu'ils soient ou non liés directement à leur propre Cercle. Ce privilège reste **secret, ritualisé et hautement codifié**.*"
        }
      ]
    },

    /* ───── 02 · ARCANES NOCTURNES ───── */
    {
      id: "arcanes",
      title: "Arcanes Nocturnes",
      ico: "☽",
      tagline: "Les bras droit et gauche · seuls visages connus du Coven",
      sections: [
        {
          title: "Bras droit, bras gauche",
          content: "Bras droit et gauche de chaque Consœur. **Exclusivement masculins**, ils sont les seuls intermédiaires entre les Sœurs et le reste de l'organisation, et parfois entre le Coven et le monde extérieur.\n\nChaque duo est lié à une Consœur via un **Pacte d'Écho** — un serment rituel gravé dans leur chair et leur esprit. Ils exécutent ses volontés, transmettent ses oracles, conduisent ses armées de l'ombre.\n\nIls sont les **lieutenants stratégiques**, les **messagers diplomatiques**, et parfois même les **juges silencieux**. Dans le monde, les Arcanes Nocturnes sont les **seuls visages connus** du Coven — mais jamais leur véritable identité."
        },
        {
          title: "[ERP] Rituel d'entrée",
          content: "*Par rituel d'entrée, **tous les Arcanes Nocturnes sont eunuques**. Leurs corps sont modifiés pour empêcher toute reproduction ou attachement charnel hors du pacte mystique. Leur rôle est purement fonctionnel — mais certains servent aussi de **jouets rituels** aux Consœurs, qu'ils soient leur bras attitré ou non. Ce lien n'est jamais affectif, seulement énergétique, servant à maintenir l'équilibre occulte entre Dominante et Serviteur.*"
        }
      ]
    },

    /* ───── 03 · LAMES & INITIÉS ───── */
    {
      id: "lames-inities",
      title: "Lames & Initiés",
      ico: "⚔",
      tagline: "Force brute et tissu vivant du Coven",
      sections: [
        {
          title: "III · Les Lames Occultes",
          intro: "Forces d'intervention, d'élimination, de sabotage — **tous membres du Cercle de l'Abrupte**.",
          content: "Ce sont la **force brute** du Coven, les instruments de la destruction sacrée. Hommes et femmes entraînés depuis l'enfance, augmentés par des **rituels douloureux** et des **fusions magico-techniques**."
        },
        {
          title: "[ERP] La Nuit des Plaisirs sans Fin",
          content: "*Un rite sacré unit les Lames. Célébrée **une fois par an**, organisée par les Arcanes Nocturnes, elle marque une **orgie rituelle obligatoire** pour toutes les Lames du Cercle de l'Abrupte. L'absence est considérée comme une trahison. Ce rite renforce les liens d'obéissance, de loyauté et de **vulnérabilité partagée**. Aucune distinction de genre ou de hiérarchie n'est reconnue cette nuit-là.*"
        },
        {
          title: "IV · Les Initiés",
          intro: "Le reste de l'organisation. Le tissu vivant du Coven.",
          features: [
            { ico: "👁",  name: "Espions",                    desc: "Infiltration des sphères de pouvoir et des zones inquisitoriales." },
            { ico: "🜂",  name: "Artisans rituels",            desc: "Fabriquent les supports physiques des sortilèges, totems, sigils." },
            { ico: "🛡",  name: "Gardiens",                   desc: "Protègent les sites sacrés et les sanctuaires des Cercles." },
            { ico: "📜", name: "Faussaires",                 desc: "Documents, identités, mémoires — falsification totale." },
            { ico: "🜍",  name: "Guérisseuses",                desc: "Soins arcaniques, parfois maladies sur commande." },
            { ico: "💻", name: "Hackers arcaniques",         desc: "Au croisement du code et du sortilège, sous Lyxaëlle." },
            { ico: "🔯",  name: "Convocationnistes",          desc: "Convoquent entités, échos, fragments d'âme." },
            { ico: "🜨",  name: "Disciples en formation",     desc: "*Beaucoup ignorent même qu'ils font partie du Coven*, envoûtés, activables à distance par un mot-clef ou un objet-totem." }
          ]
        }
      ]
    },

    /* ───── 04 · L'ARCANISTE ───── */
    {
      id: "arcaniste",
      title: "L'Arcaniste",
      ico: "✶",
      tagline: "Le mythe qui hante les Cercles",
      sections: [
        {
          title: "Une légende parmi les Cercles",
          content: "Il se murmure une légende parmi les Cercles : celle d'un **homme, unique, dont la puissance magique rivalisait avec celle des cinq Consœurs réunies**. On l'appelait **l'Arcaniste**.\n\nNi bras droit. Ni disciple. Ni égal. Mais **anomalie absolue**.\n\nIl aurait choisi de disparaître — ou aurait été **effacé par les Consœurs elles-mêmes**. Nul ne sait s'il est mort, emprisonné, ou éveillé dans les tréfonds d'Helléan.\n\nMais une chose est sûre : **l'Arcaniste reviendrait si l'équilibre du monde sombrait à nouveau.**"
        },
        {
          title: "Statut canonique",
          features: [
            { ico: "👤", name: "Pour les profanes",  desc: "Un mythe. Une rumeur de tavernier ou de prêtre fou." },
            { ico: "🜨", name: "Pour les Initiés",   desc: "Un secret. Évoqué à voix basse, jamais à voix haute." },
            { ico: "🥀", name: "Pour les Consœurs", desc: "Un deuil. Un nom qu'aucune ne prononce plus." }
          ]
        }
      ]
    },

    /* ───── 05 · LOIS ───── */
    {
      id: "lois",
      title: "Lois",
      ico: "✠",
      tagline: "Sept Internes · Six Externes · gravées par Rituel de Marque",
      sections: [
        {
          title: "Lois Internes",
          intro: "Régissent la structure, les rituels, les rapports hiérarchiques et le comportement à l'**intérieur** du Coven. Absolues, gravées dans la mémoire de tous les Initiés par un **Rituel de Marque**.",
          laws: [
            {
              num: "1",
              title: "Primauté des Cercles",
              hook: "Nul ne remet en question la volonté d'une Consœur.",
              body: "Leur parole a force de loi, et chaque membre est lié par l'allégeance à un Cercle, qu'il soit initié ou soldat."
            },
            {
              num: "2",
              title: "Interdit du Lien",
              hook: "Aucun amour, aucun enfant, aucun foyer.",
              body: "Les membres n'ont pas le droit de fonder de dynasties, ni d'entretenir de relations affectives pérennes. L'attachement affaiblit la cause.\nLes enfants sont arrachés à la naissance de leurs mères et placés dans un centre infantile d'apprentissage."
            },
            {
              num: "3",
              title: "Le Secret Absolu",
              hook: "Révéler l'existence ou l'objectif du Coven est le seul crime puni par disparition immédiate, sans sépulture.",
              body: "Ce serment est lié à un enchantement de **mort silencieuse** en cas de trahison verbale."
            },
            {
              num: "4",
              title: "Obéissance Rituelle",
              hook: "Lors d'un Ordre Cénaculaire, aucune discussion, hésitation ou question n'est tolérée.",
              body: "Émis par les Arcanes Nocturnes au nom des Consœurs. **Même un silence prolongé** peut être considéré comme une déviance."
            },
            {
              num: "5",
              title: "Conservation du Savoir",
              hook: "Tout savoir mystique ou tactique avancé doit être retransmis au Cercle.",
              body: "Par **dépôt de mémoire**, avant la mort ou lors d'une mission finale. Les **Voilés** (sorciers scribes) se chargent de cette récupération."
            },
            {
              num: "6",
              title: "Culte de la Nuit",
              hook: "Aucune action sacrée ne peut être entreprise de jour.",
              body: "Rituels, meurtres politiques, enlèvements ou sacrifices se font strictement entre le coucher et le lever du soleil. **La lumière corrompt l'œuvre.**"
            },
            {
              num: "7",
              title: "L'Appel de la Consœur",
              hook: "Convoqué — par rêve, message astral, Arcane Nocturne, rituel — le membre doit abandonner tout sans délai ni justification.",
              body: "Refuser équivaut à une **exécution psychique immédiate**."
            }
          ]
        },
        {
          title: "Lois Externes",
          intro: "Structurent la **posture du Coven envers le monde extérieur** — Inquisition, autres États, et le pays d'Helléan.",
          laws: [
            {
              num: "1",
              title: "Protection d'Helléan",
              hook: "Le Coven n'intervient dans le monde que pour protéger le territoire sacré d'Helléan.",
              body: "Berceau ancien de la **Magie Originelle**. Toute initiative extérieure doit servir directement ou indirectement cette protection."
            },
            {
              num: "2",
              title: "Non-Exposition",
              hook: "Le Coven ne doit jamais apparaître comme une autorité visible ou identifiable.",
              body: "Il agit dans l'ombre, infiltre, influence, renverse, mais **ne gouverne jamais**. L'anonymat est sa souveraineté."
            },
            {
              num: "3",
              title: "Non-Collision Frontale avec l'Inquisition",
              hook: "Une guerre ouverte avec l'Inquisition entraînerait la fin des deux ordres.",
              body: "Le Coven agit uniquement dans les **angles morts**, manipule les événements, corrompt les dignitaires, mais évite toute confrontation directe — sauf en cas d'absolue nécessité."
            },
            {
              num: "4",
              title: "Discrétion sur la Magie",
              hook: "Les arts du Coven doivent rester masqués, méconnaissables ou attribués à des phénomènes inexpliqués.",
              body: "Jamais un citoyen, un soldat ou un roi ne doit pouvoir identifier un acte magique comme relevant du Coven."
            },
            {
              num: "5",
              title: "Neutralité dans les Conflits Civils",
              hook: "Le Coven n'intervient pas dans les querelles internes des royaumes.",
              body: "Sauf si elles risquent d'exposer les Cercles, les Initiés infiltrés ou les sites sacrés. Toute implication est menée par **manipulation indirecte**."
            },
            {
              num: "6",
              title: "Silence envers l'Arcaniste",
              hook: "L'Arcaniste est un mythe pour les profanes, un secret pour les Initiés, un deuil pour les Consœurs.",
              body: "Il est **interdit** d'en parler publiquement, de l'évoquer dans un rituel, ou d'en chercher les traces sans autorisation du Cénacle."
            }
          ]
        }
      ]
    }
  ]
});
