# Rehana & Mamadou — Experience Registry (Design)

Date: 2026-10-18 · Owner: Mamadou · Lives at `https://sadio.me/marrying_rehana/`

## What it is

A one-page wedding registry where every "gift" is a future trip or experience.
Guests see the list, pick one, pay by card, optionally leave their name and a
note, and get a thank-you email. Each gift can be bought **once**; afterwards
it shows as gifted (with the guest's name/note if they allowed it).

Style follows withjoy.com/rehana-mamadou/registry: off-white page, big serif
names, blurb next to the couple photo, a "Sort by" control, a grid of white
rounded cards (image, title, price, button), nothing else.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Hosting | Folder `marrying_rehana/` inside the existing `Mamadou888/Sadio.me` repo (`gh-pages` branch). **No new repo, no DNS change.** | The repo already serves `sadio.me` via GitHub Pages + `CNAME`, so any folder in it is served at `sadio.me/<folder>/`. |
| Frontend | Static HTML + CSS + vanilla ES modules, no build step. Tests run with Node's built-in `node --test`. | Matches the existing static site; nothing to install. |
| Payments | **Stripe Payment Links**, one per gift, created by a script. Stripe-hosted checkout: all major/international cards, Apple Pay, Google Pay, Link. | Easiest checkout with no payment code; cheapest mainstream option (≈2.9% + 30¢, +1.5% international cards). PayPal costs more and can't collect the note fields as cleanly. |
| Buy once | Each Payment Link has `restrictions.completed_sessions.limit = 1`. Stripe deactivates it after one purchase and shows `inactive_message`. The site also shows "Gifted" from the backend. | Stripe enforces it even if the site is stale. |
| Currency | **Always charge USD.** In French mode, prices are *displayed* as an approximate euro amount (`≈ 129 €`) using a fixed rate in config, with a note that payment is in US dollars. | Charging EUR on a US Stripe account adds a 1% conversion fee on top of the international-card fee; charging USD avoids it. |
| Name / note | Three Stripe checkout custom fields (Stripe's max is 3), all required (Mamadou, 2026-10-19): name (text, ≤60), note (text, ≤255), "Show on registry?" dropdown. The dropdown still decides what is public. | Collected inside checkout, no extra form. |
| Storage + "who bought what" | Google Sheet + Google Apps Script (under `mamadou888@gmail.com`). A time trigger every 5 min reads completed Checkout Sessions from Stripe and appends a row per purchase. The same script serves public gift status as JSON to the site. | Stripe can't serve notes publicly. Polling avoids webhooks, which Apps Script can't verify (no access to headers) and answers with a 302. |
| Thank-you email | Sent by the Apps Script from `mamadou888@gmail.com` when it records a purchase; English or French template based on checkout locale. Text is editable in the script. | Stripe receipts can't carry custom content. |
| Language | English by default. Fixed, high-contrast pill button at the **top right** toggles French/English; the choice is remembered (`localStorage`) and can be forced with `?lang=fr`. Checkout opens in French via `?locale=fr` on the Payment Link. | |
| Sorting | "Sort by" select: Price low → high (**default**), Price high → low. Ties keep list order. | |
| Photos | Gift images: the Wikimedia Commons photos in **Photo credits** below (approved by Mamadou 2026-10-18), saved locally as `images/gifts/<id>.jpg` (Commons 960px thumbnail). Credits (photographer + license, linked to the Commons page) listed in the page footer, as CC BY / BY-SA require. Couple photo: provided by Mamadou at implementation time, saved as `images/couple.jpg`. | |

### Data shown publicly per gift (from the backend)

| Guest's choice | Shown under the gift |
|---|---|
| `namenote` — "Name & note" | "Gifted 🤍", "from {name}" (if given), the note (if given) |
| `nameonly` — "Name only" | "Gifted 🤍", "from {name}" (if given) |
| `private` — "Keep private" (also the fallback) | "Gifted 🤍" only |

Email addresses are never exposed by the public endpoint.

## Gifts

Prices in USD. `id` is the stable key used everywhere. `marrying_rehana/data/gifts.json` is the source of truth; this section mirrors it.

| id | USD | Title (EN) | Title (FR) |
|---|---|---|---|
| `nyc-dollar-slice` | 1.5 | Rehana's first dollar slice in NYC | La première « dollar slice » de Rehana à New York |
| `nyc-chopped-cheese` | 5.5 | Rehana's first chopped cheese in NYC | Le premier « chopped cheese » de Rehana à New York |
| `thailand-mango-sticky-rice` | 10 | Mango sticky rice on a beach in Thailand | Du riz gluant à la mangue sur une plage en Thaïlande |
| `rio-carnival-beach` | 20 | A beach day in Rio during Carnival | Une journée à la plage à Rio pendant le carnaval |
| `vietnam-homestay` | 35 | 3 nights at a homestay in northern Vietnam | 3 nuits chez l'habitant dans le nord du Vietnam |
| `eiffel-tower` | 38 | Climbing the Eiffel Tower for the first time | Monter en haut de la tour Eiffel pour la première fois |
| `nigeria-entry-fee` | 45 | Our unofficial entry fee into Nigeria | Notre « droit d'entrée » officieux au Nigeria |
| `new-orleans-mardi-gras` | 50 | A Cajun feast at Mardi Gras in New Orleans | Un festin cajun à Mardi Gras à La Nouvelle-Orléans |
| `petra-quad-bike` | 70 | Quad biking in the desert near Petra, Jordan | Du quad dans le désert près de Pétra, en Jordanie |
| `cartagena-cooking-class` | 75 | A cooking class for two in Cartagena, Colombia | Un cours de cuisine à deux à Carthagène, en Colombie |
| `indonesia-treehouse` | 80 | A bamboo treehouse on a small Indonesian island | Une cabane en bambou sur une petite île indonésienne |
| `dar-es-salaam-boat` | 90 | A boat ride off the coast of Dar es Salaam | Une balade en bateau au large de Dar es Salaam |
| `kazakhstan-horseback` | 95 | Horseback riding for two in Kazakhstan | Balade à cheval à deux au Kazakhstan |
| `grand-canyon-fuel` | 100 | Fuel for a Grand Canyon road trip | Le plein pour un road trip au Grand Canyon |
| `disneyland` | 110 | Rehana's ticket to Disneyland | Le billet de Rehana pour Disneyland |
| `guinea-radisson` | 125 | 2 nights at the Radisson Blu in Conakry, Guinea | 2 nuits au Radisson Blu de Conakry, en Guinée |
| `iceland-car-rental` | 150 | A rental car to chase the northern lights in Iceland | Une voiture pour chasser les aurores boréales en Islande |
| `tahiti-dolphins` | 200 | Swimming with dolphins in Tahiti | Nager avec les dauphins à Tahiti |
| `anjouan-comoros` | 250 | 3 nights on Anjouan, Comoros | 3 nuits à Anjouan, aux Comores |
| `nyc-helicopter` | 300 | A helicopter ride over New York City | Un tour en hélicoptère au-dessus de New York |
| `uganda-gorillas` | 400 | A gorilla trekking ticket in Uganda | Un ticket pour aller voir les gorilles en Ouganda |
| `coachella` | 600 | Our first Coachella | Notre tout premier Coachella |
| `saudi-umrah` | 1000 | A trip to Saudi Arabia for Umrah | Un voyage en Arabie saoudite pour la Omra |
| `serengeti-four-seasons` | 2000 | 2 nights at the Four Seasons in the Serengeti, Tanzania | 2 nuits au Four Seasons du Serengeti, en Tanzanie |

### Photo credits

| id | Credit (shown on site) | License | Source |
|---|---|---|---|
| `nyc-dollar-slice` | Contributorwiki12 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:New_York_Pizza_Slices.png |
| `nyc-chopped-cheese` | Logimancer | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Chopped_cheese_Crotona_Bronx.jpg |
| `thailand-mango-sticky-rice` | Dennis Wong | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Mango_sticy_rice_(3859549574).jpg |
| `rio-carnival-beach` | bisonlux | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Praia_de_Copacabana_-_Rio_de_Janeiro,_Brasil.jpg |
| `vietnam-homestay` | Alphab.fr | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Rice_fields_near_Sapa,_Vi%C3%AAt_Nam.jpg |
| `eiffel-tower` | Jebulon | CC0 | https://commons.wikimedia.org/wiki/File:Tour_Eiffel_1er_%C3%A9tage_vu_du_Champ_de_Mars.jpg |
| `nigeria-entry-fee` | Ei'eke | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:A_Nigeria_Jollof_Rice_with_chicken.jpg |
| `new-orleans-mardi-gras` | Mobilus In Mobili | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Mardi_Gras_Mounted_Patrol_-_Bourbon_Street_New_Orleans_2023.jpg |
| `petra-quad-bike` | Peter Chisholm | CC0 | https://commons.wikimedia.org/wiki/File:Wadi_rum_desert.jpg |
| `cartagena-cooking-class` | PapiPijuan | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Comida_de_la_Playa_de_Santa_Ver%C3%B3nica.jpg |
| `indonesia-treehouse` | Dini Rosyadah Tridya | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Amazing_Tree_House_at_Nusa_Penida.jpg |
| `dar-es-salaam-boat` | David Stanley | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Indian_Ocean_Fishing_Boats_(34768090073).jpg |
| `kazakhstan-horseback` | Ken and Nyetta | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Horses_Grazing_on_the_Kazakhstani_Steppe_(7131707195).jpg |
| `grand-canyon-fuel` | Dietmar Rabich | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Grand_Canyon_(Arizona,_USA),_South_Rim_nahe_Tusayan_--_2012_--_6040.jpg |
| `disneyland` | Tuxyso | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Sleeping_Beauty_Castle_Disneyland_Anaheim_2013.jpg |
| `guinea-radisson` | Alpha hmd | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Un_aper%C3%A7u_de_la_ville_de_conakry.jpg |
| `iceland-car-rental` | Moyan Brenn | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Aurora_borealis_(13687618934).jpg |
| `tahiti-dolphins` | Dan Harville | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Spinner_Dolphin,_%C3%8Eles_du_Vent,_French_Polynesia_imported_from_iNaturalist_photo_251470527.jpg |
| `anjouan-comoros` | Haryamouji | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Anjouan_-_Islands_of_Comoros.jpg |
| `nyc-helicopter` | nosha | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Lower_Manhattan_from_Helicopter.jpg |
| `uganda-gorillas` | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Mountain_gorilla_(Gorilla_beringei_beringei)_female_eating_root.jpg |
| `coachella` | Alan Paone | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Coachella_2014_sunset.jpg |
| `saudi-umrah` | Adli Wahid (edited by Basile Morin) | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:The_Kaaba_during_Hajj_-_edited.jpg |
| `serengeti-four-seasons` | Michelle Maria | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Elephants_in_the_Serengeti_-_panoramio.jpg |

### Descriptions

**nyc-dollar-slice**
EN: Rehana's very first New York dollar slice: folded in half and eaten standing up on the sidewalk, alongside the rats, like a real New Yorker. Unfortunately, it ain't a dollar no more.
FR : La toute première « dollar slice » new-yorkaise de Rehana : pliée en deux et mangée debout sur le trottoir, aux côtés des rats, comme une vraie New-Yorkaise. Malheureusement, ça ne coûte plus un dollar.

**nyc-chopped-cheese**
EN: Rehana's very first chopped cheese from a real New York corner store. Her official New Yorker initiation. Yes, the meat will be halal as it will be an Arab bodega.
FR : Le tout premier « chopped cheese » de Rehana, acheté dans une vraie épicerie de quartier new-yorkaise. Son initiation officielle de New-Yorkaise. Et oui, la viande sera halal, puisque ce sera une bodega arabe.

**thailand-mango-sticky-rice**
EN: A plate of mango sticky rice on a Thai beach, toes in the sand as the sun goes down. Sweet mango, warm coconut rice, and the two of us fighting over the last bite.
FR : Une assiette de riz gluant à la mangue sur une plage thaïlandaise, les pieds dans le sable au coucher du soleil. De la mangue sucrée, du riz tiède au lait de coco, et nous deux qui nous disputons la dernière bouchée.

**rio-carnival-beach**
EN: A full day on the sand at Copacabana while Carnival takes over Rio de Janeiro. Fresh juice in hand, samba drifting in from the street, and absolutely nowhere to be. Your gift covers our beach chairs, an umbrella and an embarrassing number of passion fruit juices.
FR : Une journée entière sur le sable de Copacabana pendant que le carnaval envahit Rio de Janeiro. Un jus frais à la main, la samba qui monte de la rue, et nulle part où aller. Votre cadeau couvre nos transats, le parasol et un nombre gênant de jus de fruit de la passion.

**vietnam-homestay**
EN: Three nights with a local family in the mountains of northern Vietnam. Rice terraces out the window, home-cooked meals at their table.
FR : Trois nuits chez une famille dans les montagnes du nord du Vietnam. Des rizières en terrasses par la fenêtre, des repas faits maison à leur table.

**eiffel-tower**
EN: Tickets to the top of the Eiffel Tower for our very first time. You're covering this one, because Mamadou refuses to pay for an elevator ride just for a view.
FR : Des billets pour le sommet de la tour Eiffel, pour notre toute première fois. C'est vous qui offrez, parce que Mamadou refuse de payer un ascenseur juste pour une vue.

**nigeria-entry-fee**
EN: The bribe we're probably going to have to pay to get into Nigeria safe, sound and alive. All that for some crappy jollof rice. We'll let you know if it was worth it.
FR : Le pot-de-vin qu'on devra sûrement payer pour entrer au Nigeria sains, saufs et vivants. Tout ça pour un riz jollof pas terrible. On vous dira si ça valait le coup.

**new-orleans-mardi-gras**
EN: A big Cajun feast in New Orleans during Mardi Gras: gumbo, crawfish, jambalaya, the works. Then we walk it off chasing parades and catching beads.
FR : Un grand festin cajun à La Nouvelle-Orléans pendant Mardi Gras : gumbo, écrevisses, jambalaya, tout y passe. Ensuite, on digère en suivant les défilés et en attrapant des colliers.

**petra-quad-bike**
EN: Quad biking across the red desert around Petra, Jordan. Mamadou is the better driver, so we're only taking one bike ;) Rehana gets the view, Mamadou gets the bragging rights, and we both get covered in sand.
FR : Du quad à travers le désert rouge autour de Pétra, en Jordanie. Mamadou conduit mieux, donc on ne prend qu'un seul quad ;) Rehana profite de la vue, Mamadou de la gloire, et on finit tous les deux couverts de sable.

**cartagena-cooking-class**
EN: A cooking class for two in Cartagena, learning to make arepas, empanadas, patacones, coconut rice and the traditional Caribbean fried fish. Then we eat everything we made. We'll be cooking it for you when you visit.
FR : Un cours de cuisine à deux à Carthagène pour apprendre à préparer des arepas, des empanadas, des patacones, du riz au coco et le poisson frit traditionnel des Caraïbes. Ensuite, on mange tout ce qu'on a préparé. On vous en cuisinera quand vous viendrez nous voir.

**indonesia-treehouse**
EN: A stay in a bamboo treehouse on a small Indonesian island. We'll wake up to the jungle, explore the island by scooter and fall asleep to the sound of the waves.
FR : Un séjour dans une cabane en bambou perchée dans les arbres, sur une petite île indonésienne. Réveil dans la jungle, l'île explorée en scooter, et le bruit des vagues pour s'endormir.

**dar-es-salaam-boat**
EN: A boat ride off the coast of Dar es Salaam, eating fresh fish and sipping coconuts while Mamadou learns about the history of his new Swahili culture.
FR : Une balade en bateau au large de Dar es Salaam, à manger du poisson frais et siroter des noix de coco pendant que Mamadou découvre l'histoire de sa nouvelle culture swahilie.

**kazakhstan-horseback**
EN: Horseback riding for two through the open steppe and mountain valleys of Kazakhstan. Just us, two horses, endless sky and no phone signal. A day to slow down and be in nature together.
FR : Une balade à cheval à deux à travers la steppe et les vallées de montagne du Kazakhstan. Juste nous, deux chevaux, un ciel immense et pas de réseau. Une journée pour ralentir et profiter de la nature ensemble.

**grand-canyon-fuel**
EN: Fill up our tank for a road trip through the Grand Canyon in Arizona. We all know gas prices crazy.
FR : Faites le plein pour notre road trip à travers le Grand Canyon, en Arizona. On sait tous que le prix de l'essence, c'est n'importe quoi.

**disneyland**
EN: One ticket to Disneyland so Rehana can relive her childhood princess fairytales. The castle, the fireworks, the mouse ears: the whole fairytale.
FR : Un billet pour Disneyland pour que Rehana revive les contes de princesses de son enfance. Le château, les feux d'artifice, les oreilles de Mickey : tout le conte de fées.

**guinea-radisson**
EN: Two nights at the Radisson Blu in Conakry, in Mamadou's homeland of Guinea. This will specifically be for when we want to take a break from staying with all the aunties and uncles we love so much. And for Rehana to discover Fulani culture.
FR : Deux nuits au Radisson Blu de Conakry, en Guinée, le pays d'origine de Mamadou. Ce sera spécialement pour quand on voudra souffler un peu entre deux séjours chez toutes les tatas et tontons qu'on aime tant. Et pour que Rehana découvre la culture peule.

**iceland-car-rental**
EN: A rental car to drive across Iceland in winter. We'll chase the northern lights after dark and thaw out in natural hot springs in between. Bring on the cold.
FR : Une voiture de location pour sillonner l'Islande en hiver. On chassera les aurores boréales la nuit et on se réchauffera dans les sources chaudes entre deux routes. Vive le froid !

**tahiti-dolphins**
EN: Swimming with wild dolphins in the warm blue Pacific off Tahiti. The kind of story we'll be telling our grandkids about. Hopefully we don't get kidnapped by dolphins.
FR : Nager avec des dauphins sauvages dans les eaux chaudes et bleues du Pacifique, au large de Tahiti. Le genre d'histoire qu'on racontera à nos petits-enfants. En espérant ne pas se faire kidnapper par les dauphins.

**anjouan-comoros**
EN: Three nights on Anjouan, the small island in the Comoros where Rehana's family is from. Volcanic hills, clove and ylang-ylang in the air, and family who will make sure Mamadou never goes hungry. A trip back to Rehana's roots, together.
FR : Trois nuits à Anjouan, la petite île des Comores d'où vient la famille de Rehana. Des collines volcaniques, l'odeur des clous de girofle et de l'ylang-ylang, et une famille qui veillera à ce que Mamadou ne manque jamais de rien. Un retour aux racines de Rehana, ensemble.

**nyc-helicopter**
EN: A helicopter ride over New York so Rehana can take in her new city all in one sweep.
FR : Un tour en hélicoptère au-dessus de New York pour que Rehana découvre sa nouvelle ville d'un seul coup d'œil.

**uganda-gorillas**
EN: A ticket to trek through the misty forests of Uganda and sit a few meters from a family of mountain gorillas. A bucket-list moment for both of us.
FR : Un ticket pour marcher dans les forêts brumeuses de l'Ouganda et s'asseoir à quelques mètres d'une famille de gorilles des montagnes. Un rêve pour nous deux.

**coachella**
EN: Our first ever Coachella, out in the California desert. Sunshine, good music and fingers crossed that Justin Bieber shows up. If he does, you'll hear us screaming from wherever you are.
FR : Notre tout premier Coachella, en plein désert californien. Du soleil, de la bonne musique, et on croise les doigts pour que Justin Bieber soit là. S'il vient, vous nous entendrez crier d'où vous êtes.

**saudi-umrah**
EN: Umrah together as husband and wife. A trip to Mecca and Medina to pray, reflect and give thanks for everything that brought us here, and for all of you. We'll keep you in our duas.
FR : La Omra ensemble, en tant que mari et femme. Un voyage à La Mecque et à Médine pour prier, méditer et rendre grâce pour tout ce qui nous a menés ici, et pour chacun d'entre vous. Vous serez dans nos douas.

**serengeti-four-seasons**
EN: Two nights at the Four Seasons in the Serengeti, in Rehana's homeland of Tanzania. The bougiest hotel two kids from humble beginnings could ever dream of: elephants at the watering hole below the pool and sunsets over the savanna. If you've always wanted to spoil us, this is the one.
FR : Deux nuits au Four Seasons du Serengeti, en Tanzanie, le pays d'origine de Rehana. L'hôtel le plus chic dont deux enfants partis de rien puissent rêver : des éléphants au point d'eau sous la piscine et des couchers de soleil sur la savane. Si vous avez toujours voulu nous gâter, c'est celui-là.

## Page copy

Heading: **Rehana & Mamadou Sadio** (both languages). Section title: "Registry" / "Liste de cadeaux".

Blurb (three paragraphs):

EN:
> Your presence, prayers and well wishes are already more than enough for us 🤍 This registry is completely optional. But for those of you who are determined to spoil us anyway, we've put together a little wish list.
>
> We thought about a registry full of household things we'd need. The truth is, we don't plan on sitting still anytime soon. In our heart of hearts, we want to spend as much time as we can experiencing everything this life has to offer. That is what we value most.
>
> So every gift here is a future moment: a trip, an adventure, a meal we dream of experiencing together. If you'd like to help make one happen, it would mean the absolute world to us. And when we do it, we'll send you a message and a photo from wherever we are :)

FR:
> Votre présence, vos prières et vos vœux sont déjà largement suffisants pour nous 🤍 Cette liste est entièrement facultative. Mais pour les plus têtus d'entre vous qui souhaitent absolument nous gâter, nous avons préparé une petite liste d'envies.
>
> Nous avons pensé à une liste remplie d'objets pour la maison. La vérité, c'est que nous n'avons pas l'intention de nous poser de sitôt. Au fond de nos cœurs, nous voulons passer autant de temps que possible à découvrir tout ce que la vie a à offrir. C'est ce qui compte le plus pour nous.
>
> Alors chaque cadeau ici est un moment à venir : un voyage, une aventure, un repas que nous rêvons de vivre ensemble. Si vous souhaitez nous aider à en réaliser un, cela nous toucherait énormément. Et le jour venu, nous vous enverrons un message et une photo, où que nous soyons :)

UI strings:

| key | EN | FR |
|---|---|---|
| `toggle` (label shows the *other* language) | Voir en français | View in English |
| `sortBy` | Sort by: | Trier par : |
| `sortAsc` | Price: low to high | Prix croissant |
| `sortDesc` | Price: high to low | Prix décroissant |
| `giftButton` | Gift this experience | Offrir cette expérience |
| `gifted` | Gifted 🤍 | Offert 🤍 |
| `from` | from {name} | de la part de {name} |
| `euroNote` | — | Les prix en euros sont approximatifs. Le paiement est effectué en dollars américains. |
| `thanks` | Thank you so much! 🤍 Check your inbox for a little note from us. | Merci infiniment ! 🤍 Un petit mot de notre part vous attend dans votre boîte mail. |
| `photoCredits` | Photo credits | Crédits photo |

## Checkout fields (Stripe custom fields)

| key | type | label (≤50 chars) | rules |
|---|---|---|---|
| `guestname` | text | Your name / Votre nom | **required**, max 60 |
| `guestnote` | text | Please leave us a note / Laissez-nous un mot | **required**, max 255 |
| `display` | dropdown | Show on the registry? / Afficher ? | required; options `namenote` "Name & note / Nom et mot", `nameonly` "Name only / Nom seulement", `private` "Keep private / Rester privé" |

After payment Stripe redirects to `https://sadio.me/marrying_rehana/?gifted=<id>`, which shows the thank-you banner.
Inactive-link message: "This gift has already been given. Thank you! 🤍 / Ce cadeau a déjà été offert. Merci ! 🤍"

## Thank-you email (default text — Mamadou edits it in the script)

EN — Subject: `Thank you for your gift 🤍`
```
Hi {{name}},

Thank you so much for gifting us "{{gift}}". It truly means the world to us.
When we finally do it, we'll send you a message and a photo from wherever we are.

With love,
Mamadou & Rehana
```
FR — Subject: `Merci pour votre cadeau 🤍`
```
Bonjour {{name}},

Merci infiniment de nous avoir offert « {{gift}} ». Cela nous touche énormément.
Le jour venu, nous vous enverrons un message et une photo, où que nous soyons.

Avec tout notre amour,
Mamadou & Rehana
```
`{{name}}` = name entered at checkout, else the cardholder name, else "friend" / "à vous".

## Out of scope

Partial or custom-amount contributions, quantities, a cart, admin UI (the Google Sheet is the admin view), live exchange rates.

## Notes for Mamadou

- Coachella is in Indio, California (desert near Palm Springs), not Los Angeles; the copy says "California desert".
- Stripe is built for businesses; sign up as an individual/sole proprietor and describe the use honestly ("wedding registry for travel experiences"). If Stripe ever pushes back, PayPal is the fallback.
