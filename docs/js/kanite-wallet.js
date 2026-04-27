/* ══════════════════════════════════════════════════════════════════════
   kanite-wallet.js — Jaharta RP
   Hiérarchie et conversion automatique des 4 kanites.
   Bronze < Silver < Gold < Platinum, facteur 100 entre chaque palier.
   Utilisé par : hub-shops (achats), casino-core (débits/crédits jeux).
   Expose window.JKanite.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var ORDER = ['bronze_kanite', 'silver_kanite', 'gold_kanite', 'platinum_kanite'];
  var RATE  = 100;

  /* Total wallet exprimé en unités bronze (pour comparaisons). */
  function totalInBronze(personal) {
    var t = 0;
    for (var i = 0; i < ORDER.length; i++) t += (personal[ORDER[i]] || 0) * Math.pow(RATE, i);
    return t;
  }

  /* Prix exprimé en unités bronze. Accepte un objet { currency: amount, ... }
     ou un nombre/currency simple ({ amount, currency }). */
  function priceInBronze(price) {
    var t = 0;
    if (!price) return 0;
    if (price.amount != null && price.currency) {
      var i = ORDER.indexOf(price.currency);
      return (i >= 0) ? price.amount * Math.pow(RATE, i) : Number(price.amount) || 0;
    }
    Object.keys(price).forEach(function (c) {
      var i = ORDER.indexOf(c);
      if (i >= 0) t += (price[c] || 0) * Math.pow(RATE, i);
      else t += Number(price[c]) || 0;
    });
    return t;
  }

  /* Compacte un portefeuille vers le haut (100 bronze → 1 silver, etc). */
  function autoConvertUp(personal) {
    var w = {};
    ORDER.forEach(function (c) { w[c] = Math.max(0, Math.floor(personal[c] || 0)); });
    for (var i = 0; i < ORDER.length - 1; i++) {
      if (w[ORDER[i]] >= RATE) {
        var carry = Math.floor(w[ORDER[i]] / RATE);
        w[ORDER[i]]     -= carry * RATE;
        w[ORDER[i + 1]] += carry;
      }
    }
    return w;
  }

  /* Débit avec conversion automatique : paie directement si solde suffisant,
     sinon casse des paliers supérieurs (rend la monnaie) ou remonte des
     paliers inférieurs. Retourne le wallet résultat, ou null si insuffisant. */
  function deductWithAutoConversion(personal, price) {
    var wallet = {};
    ORDER.forEach(function (c) { wallet[c] = personal[c] || 0; });

    var entries;
    if (price && price.amount != null && price.currency) {
      entries = [[price.currency, price.amount]];
    } else {
      entries = Object.entries(price || {});
    }

    for (var i = 0; i < entries.length; i++) {
      var cur = entries[i][0], amt = entries[i][1];
      var idx = ORDER.indexOf(cur);
      if (idx < 0) continue;
      var remaining = Number(amt) || 0;

      // 1) Paiement direct dans la devise demandée
      var direct = Math.min(wallet[cur], remaining);
      wallet[cur] -= direct;
      remaining   -= direct;
      if (remaining <= 0) continue;

      // 2) Casser un palier supérieur (rend la monnaie dans la devise cible)
      for (var hi = idx + 1; hi < ORDER.length && remaining > 0; hi++) {
        if (wallet[ORDER[hi]] <= 0) continue;
        var rateHi   = Math.pow(RATE, hi - idx);
        var neededHi = Math.ceil(remaining / rateHi);
        var useHi    = Math.min(wallet[ORDER[hi]], neededHi);
        wallet[ORDER[hi]] -= useHi;
        var change = useHi * rateHi - remaining;
        remaining = 0;
        if (change > 0) wallet[cur] += change;
      }

      // 3) Remonter depuis des paliers inférieurs (pas de perte, uniquement si entier)
      for (var lo = idx - 1; lo >= 0 && remaining > 0; lo--) {
        var rateLo   = Math.pow(RATE, idx - lo);
        var loNeeded = remaining * rateLo;
        var loUse    = Math.min(wallet[ORDER[lo]], loNeeded);
        var paid     = Math.floor(loUse / rateLo);
        wallet[ORDER[lo]] -= paid * rateLo;
        remaining         -= paid;
      }

      if (remaining > 0) return null; // insuffisant malgré conversion
    }
    return wallet;
  }

  /* Ajoute un montant dans une devise donnée (compacte vers le haut ensuite). */
  function addWithAutoConvertUp(personal, currency, amount) {
    var w = {};
    ORDER.forEach(function (c) { w[c] = personal[c] || 0; });
    w[currency] = (w[currency] || 0) + (Number(amount) || 0);
    return autoConvertUp(w);
  }

  window.JKanite = {
    ORDER: ORDER,
    RATE:  RATE,
    totalInBronze:           totalInBronze,
    priceInBronze:           priceInBronze,
    autoConvertUp:           autoConvertUp,
    deductWithAutoConversion: deductWithAutoConversion,
    addWithAutoConvertUp:    addWithAutoConvertUp
  };
})();
