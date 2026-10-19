export const STRINGS = {
  en: {
    title: 'Rehana & Mamadou Sadio',
    registry: 'Registry',
    blurb: [
      "Your presence, prayers and well wishes are already more than enough for us 🤍 This registry is completely optional. But for those of you who are determined to spoil us anyway, we've put together a little wish list.",
      "We thought about a registry full of household things we'd need. The truth is, we don't plan on sitting still anytime soon. In our heart of hearts, we want to spend as much time as we can experiencing everything this life has to offer. That is what we value most.",
      "So every gift here is a future moment: a trip, an adventure, a meal we dream of experiencing together. If you'd like to help make one happen, it would mean the absolute world to us. And when we do it, we'll send you a message and a photo from wherever we are 😊",
    ],
    toggle: 'Voir en français',
    sortBy: 'Sort by:',
    sortAsc: 'Price: low to high',
    sortDesc: 'Price: high to low',
    giftButton: 'Gift this experience',
    gifted: 'Gifted 🤍',
    by: 'by {name}',
    euroNote: '',
    thanks: 'Thank you so much! 🤍 Check your inbox for a little note from us.',
    thanksFor: 'Thank you so much for gifting us “{gift}”! 🤍 Check your inbox for a little note from us.',
    close: 'Close',
    photoCredits: 'Photo credits',
    madeWith: 'Made with love by Rehana (Designer) and Mamadou (Engineer) ❤️',
    loadError: "We couldn't load the gifts. Please refresh the page.",
  },
  fr: {
    title: 'Rehana & Mamadou Sadio',
    registry: 'Liste de cadeaux',
    blurb: [
      "Votre présence, vos prières et vos vœux sont déjà largement suffisants pour nous 🤍 Cette liste est entièrement facultative. Mais pour les plus têtus d'entre vous qui souhaitent absolument nous gâter, nous avons préparé une petite liste d'envies.",
      "Nous avons pensé à une liste remplie d'objets pour la maison. La vérité, c'est que nous n'avons pas l'intention de nous poser de sitôt. Au fond de nos cœurs, nous voulons passer autant de temps que possible à découvrir tout ce que la vie a à offrir. C'est ce qui compte le plus pour nous.",
      "Alors chaque cadeau ici est un moment à venir : un voyage, une aventure, un repas que nous rêvons de vivre ensemble. Si vous souhaitez nous aider à en réaliser un, cela nous toucherait énormément. Et le jour venu, nous vous enverrons un message et une photo, où que nous soyons 😊",
    ],
    toggle: 'View in English',
    sortBy: 'Trier par :',
    sortAsc: 'Prix croissant',
    sortDesc: 'Prix décroissant',
    giftButton: 'Offrir cette expérience',
    gifted: 'Offert 🤍',
    by: 'par {name}',
    euroNote: 'Les prix en euros sont approximatifs. Le paiement est effectué en dollars américains.',
    thanks: 'Merci infiniment ! 🤍 Un petit mot de notre part vous attend dans votre boîte mail.',
    thanksFor: 'Merci infiniment de nous avoir offert « {gift} » ! 🤍 Un petit mot de notre part vous attend dans votre boîte mail.',
    close: 'Fermer',
    photoCredits: 'Crédits photo',
    madeWith: 'Fait avec amour par Rehana (designer) et Mamadou (ingénieur) ❤️',
    loadError: "Impossible de charger les cadeaux. Veuillez actualiser la page.",
  },
};

export function t(lang, key, vars = {}) {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

const LANGS = ['en', 'fr'];

export function resolveLang(search, stored) {
  const fromUrl = new URLSearchParams(search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  if (LANGS.includes(stored)) return stored;
  return 'en';
}
