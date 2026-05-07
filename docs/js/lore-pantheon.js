/* ═══ PANTHEON — Principes statiques (10 entrées)
   Données injectées dans DATA.pantheon après chaque snapshot Firestore.
   - `defaultLocked: true` → la card est verrouillée tant qu'un admin ne déverrouille pas.
   - L'image d'illustration peut être remplacée par un upload admin (stocké dans
     `config/lore_images.entries.{id}` via window._lorePantheonImages).
   ═══════════════════════════════════════════════════════════════════════════ */

window.STATIC_PANTHEON = window.STATIC_PANTHEON || [];

window.STATIC_PANTHEON.push(
  {
    id: 'shinamea-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: false,                         /* Seul Principe Unlocked */
    name: 'Shinamea',
    domain: 'Principe de la Force',
    ico: '👊',
    color: '#FF4757',
    desc: "Shinamea est un Principe connu pour son tempérament pressé et tempétueux. Elle n'attend jamais et fonce toujours tête la première dès qu'elle a une idée.",
    details: {
      'Reflector élu': 'Kang-Soo Baek',
      'Pouvoir légué': "**Prime Smash** — Un poing outrepassant toutes les limites possibles et imaginables."
    }
  },
  {
    id: 'avalan-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Avalan',
    domain: "Principe de l'Attraction",
    ico: '💖',
    color: '#ff66b3',
    desc: "Avalan est plus que l'incarnation de la Beauté : il est la raison pour laquelle ce mot existe. Un seul regard vers lui et le coup de foudre est assuré. C'est pour cette raison qu'il cache souvent son visage — il n'aime qu'une seule personne à la fois : son Reflector du moment, qu'il choisit toujours par pur désir physique.",
    details: {
      'Reflector élu': 'Belladonna Vizione',
      'Pouvoir légué': "**Principle: Charm** — Un pouvoir permettant de charmer instantanément quiconque est cible de ce pouvoir."
    }
  },
  {
    id: 'madeleine-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Madeleine',
    domain: "Principe de l'Arcane",
    ico: '✨',
    color: '#8B5CF6',
    desc: "Madeleine est douce, discrète, et fidèle à ses principes et valeurs. Elle ne parle jamais trop, et ses mots n'ont aucun superflu. Sa maîtrise de l'Arcane est absolue et ses connaissances en termes de sorts semblent infinies.",
    details: {
      'Reflector élu': 'Haelanthéa Stargazer',
      'Pouvoir légué': "**Infinity** — Le mana du possesseur de ce pouvoir ne se vide jamais."
    }
  },
  {
    id: 'xelorin-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Xelorin',
    domain: 'Principe de la Guerre',
    ico: '⚔️',
    color: '#4DA3FF',
    desc: "Xelorin est un artiste martial parfait. Il maîtrise toutes les armes et tous les arts de la Guerre, qu'ils soient existants, à venir ou oubliés. Cette maîtrise lui a permis de contrôler sa personne à la perfection, ce qui lui vaut aussi le surnom de **Principe du Calme**.",
    details: {
      'Reflector élu': 'Jean de la Fontaine',
      'Pouvoir légué': "**Dimensional Slash: Absolute Zero** — Une version supérieure du Dimensional Slash, permettant d'absolument tout trancher, même une idée."
    }
  },
  {
    id: 'zagan-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Zagan',
    domain: 'Principe de la Domination',
    ico: '👑',
    color: '#6366f1',
    desc: "Zagan est le frère de Shinamea. Là où sa sœur se limite à la force brute, lui allie force écrasante, intelligence sans faille et charisme étouffant. Son Reflector n'est élu que s'il survit à leur rencontre mentale.",
    details: {
      'Reflector élu': 'Septio Von Glycia',
      'Pouvoir légué': "**Adapt** — Permet d'apprendre un sort ou une technique après qu'ils aient été exécutés dans le champ d'activation du pouvoir."
    }
  },
  {
    id: 'saphite-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Saphite',
    domain: "Principe de l'Excellence",
    ico: '💎',
    color: '#FFD60A',
    desc: "La nomination parle d'elle-même : Saphite excelle dans tous les domaines — force, vitesse, dextérité, intelligence, charisme, arcane, beauté, leadership et bien d'autres encore. Peu importe le sujet, Saphite excelle.",
    details: {
      'Reflector élu': 'Neferti Aamon',
      'Pouvoir légué': "**Sublimation** — Le possesseur débloque instantanément la version ultime de tous les pouvoirs acquis et possédés."
    }
  },
  {
    id: 'isono-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Isono',
    domain: 'Principe du Savant',
    ico: '🔮',
    color: '#00e5cc',
    desc: "L'**Omnisciente** — son second surnom. Isono est terrifiant car il sait tout : ce qui était, ce qui est, et ce qui sera. Son problème ? Il est avare de sa connaissance.",
    details: {
      'Reflector élu': 'Sultan Kamar Aamon',
      'Pouvoir légué': "**All-Knowing** — L'évolution ultime de *Analyze*. Le possesseur a une connaissance complète de la personne en face — passé, présent et futur — et connaît tout des liens directs de la cible en supplément. Cependant, il ne peut d'aucune manière partager ses connaissances avec autrui."
    }
  },
  {
    id: 'kakoku-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Kakoku',
    domain: 'Principe du Chaos',
    ico: '🌀',
    color: '#ff6b35',
    desc: "Kakoku est un Principe excentrique et hors du commun, même au sein des Principes — qui sont déjà tous hors du commun. Cet être peut rendre l'imaginaire tangible et le réel imaginaire. **Principe de la Confusion** est aussi son second surnom.",
    details: {
      'Reflector élu': 'Sienna Ciggna',
      'Pouvoir légué': "**Absurde** — Ses mots deviennent réalité, peu importe l'énormité de ce qui est annoncé."
    }
  },
  {
    id: 'bihwa-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Bihwa',
    domain: 'Principe de la Vitesse',
    ico: '⚡',
    color: '#fbbf24',
    desc: "La Vitesse de la Lumière ? Un concept trop lent pour Bihwa. Il est si rapide qu'il peut être présent partout, en même temps.",
    details: {
      'Reflector élu': 'Red',
      'Pouvoir légué': "**Time Speed** — Le temps d'une action RP, le possesseur bouge *littéralement* à la vitesse du temps."
    }
  },
  {
    id: 'vanhama-static',
    category: 'pantheon',
    isStatic: true,
    defaultLocked: true,
    name: 'Vanhama',
    domain: 'Principe de la Causalité',
    ico: '♾️',
    color: '#7B1FA2',
    desc: "Principe des Principes. La Causalité, ou la Fatalité. Vanhama est inéluctable, et ainsi sont ses décisions. Il dicte ses lois, et le monde suit sans broncher.",
    details: {
      'Reflector élu': 'Aucun',
      'Pouvoir légué': "**Nexus** — Le possesseur peut changer une loi de ce monde."
    }
  }
);
