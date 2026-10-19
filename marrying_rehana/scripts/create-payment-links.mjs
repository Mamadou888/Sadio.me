// Creates one Stripe Payment Link per gift and writes the links into data/gifts.json.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-payment-links.mjs            # gifts without a link
//   STRIPE_SECRET_KEY=sk_live_... node scripts/create-payment-links.mjs --reset    # every gift (test → live)
//   STRIPE_SECRET_KEY=sk_live_... node scripts/create-payment-links.mjs --only coachella  # one gift (e.g. new price)
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-payment-links.mjs --update-fields   # push new checkout field labels to existing links
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SITE_URL = 'https://sadio.me/marrying_rehana';
const GIFTS_PATH = new URL('../data/gifts.json', import.meta.url);
const INACTIVE_MESSAGE = 'This gift has already been given. Thank you! 🤍 / Ce cadeau a déjà été offert. Merci ! 🤍';

const CUSTOM_FIELDS = [
  { key: 'guestname', type: 'text', label: 'Your name / Votre nom', optional: false, maxLength: 60 },
  { key: 'guestnote', type: 'text', label: 'Please leave us a note / Laissez-nous un mot', optional: false, maxLength: 255 },
  {
    key: 'display', type: 'dropdown', label: 'Show on the registry? / Afficher ?', optional: false,
    options: [
      ['namenote', 'Name & note / Nom et mot'],
      ['nameonly', 'Name only / Nom seulement'],
      ['private', 'Keep private / Rester privé'],
    ],
  },
];

export function buildCustomFieldParams(p = new URLSearchParams()) {
  CUSTOM_FIELDS.forEach((f, i) => {
    const k = `custom_fields[${i}]`;
    p.set(`${k}[key]`, f.key);
    p.set(`${k}[type]`, f.type);
    p.set(`${k}[label][type]`, 'custom');
    p.set(`${k}[label][custom]`, f.label);
    p.set(`${k}[optional]`, String(f.optional));
    if (f.type === 'text') p.set(`${k}[text][maximum_length]`, String(f.maxLength));
    f.options?.forEach(([value, label], j) => {
      p.set(`${k}[dropdown][options][${j}][value]`, value);
      p.set(`${k}[dropdown][options][${j}][label]`, label);
    });
  });
  return p;
}

export function buildPaymentLinkParams(gift, priceId, siteUrl) {
  const p = new URLSearchParams();
  p.set('line_items[0][price]', priceId);
  p.set('line_items[0][quantity]', '1');
  p.set('restrictions[completed_sessions][limit]', '1');
  p.set('inactive_message', INACTIVE_MESSAGE);
  p.set('after_completion[type]', 'redirect');
  p.set('after_completion[redirect][url]', `${siteUrl}/?gifted=${gift.id}`);
  return buildCustomFieldParams(p);
}

export function selectGifts(gifts, { reset, only }) {
  if (only) {
    const picked = gifts.filter(g => g.id === only);
    if (picked.length === 0) throw new Error(`Unknown gift id: ${only}`);
    return picked;
  }
  return reset ? gifts : gifts.filter(g => !g.paymentLinkId);
}

async function stripePost(path, params, key) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path} failed (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  return body;
}

function parseArgs(argv) {
  const onlyIndex = argv.indexOf('--only');
  return { reset: argv.includes('--reset'), only: onlyIndex >= 0 ? argv[onlyIndex + 1] ?? '' : null };
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Set STRIPE_SECRET_KEY (sk_test_... or sk_live_...)');
  const opts = parseArgs(process.argv.slice(2));
  if (opts.only === '') throw new Error('--only needs a gift id');

  const gifts = JSON.parse(fs.readFileSync(GIFTS_PATH));
  if (process.argv.includes('--update-fields')) {
    for (const gift of gifts.filter(g => g.paymentLinkId)) {
      await stripePost(`payment_links/${gift.paymentLinkId}`, buildCustomFieldParams(), key);
      console.log(`${gift.id} fields updated`);
    }
    return;
  }
  const save = () => fs.writeFileSync(GIFTS_PATH, JSON.stringify(gifts, null, 2) + '\n');

  for (const gift of selectGifts(gifts, opts)) {
    // A changed gift gets a new link; switch the old one off so its old price can't be bought.
    if (opts.only && gift.paymentLinkId) {
      await stripePost(`payment_links/${gift.paymentLinkId}`, new URLSearchParams({ active: 'false' }), key);
    }
    const product = await stripePost('products', new URLSearchParams({
      name: gift.title.en,
      description: gift.description.en,
      'images[0]': `${SITE_URL}/${gift.image}`,
    }), key);
    const price = await stripePost('prices', new URLSearchParams({
      product: product.id,
      currency: 'usd',
      unit_amount: String(Math.round(gift.priceUsd * 100)),
    }), key);
    const link = await stripePost('payment_links', buildPaymentLinkParams(gift, price.id, SITE_URL), key);
    gift.paymentLink = link.url;
    gift.paymentLinkId = link.id;
    save(); // after each gift, so a failure halfway keeps the links already made
    console.log(`${gift.id} → ${link.url}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
