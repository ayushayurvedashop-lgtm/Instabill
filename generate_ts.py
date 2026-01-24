import json
import re

data = """
Apparel – ASCLEPIUS T SHIRT (S) – MRP: 2559 – DP: 1828 – SP: 4
Apparel – ASCLEPIUS WOMEN SAREE CRAPE – MRP: 2099 – DP: 1499 – SP: 4
Apparel – ASCLEPIUS WOMEN SUITS – MRP: 2099 – DP: 1499 – SP: 4
Apparel – ASCLEPIUS TIE BLACK – MRP: 559 – DP: 399 – SP: 1
Apparel – ASCLEPIUS WOMEN T-SHIRT (XS) – MRP: 2295 – DP: 1640 – SP: 4

Sniss Fragrances – SNISS ORELLA PERFUME (75ml) – MRP: 1073 – DP: 715 – SP: 3
Sniss Fragrances – SNISS NEBEL PERFUME (75ml) – MRP: 1073 – DP: 715 – SP: 3
Sniss Fragrances – SNISS LONDON XI (150ml) – MRP: 406 – DP: 290 – SP: 1
Sniss Fragrances – SNISS REVOQUE (150ml) – MRP: 406 – DP: 290 – SP: 1

Wellroot – SHIITAKE SHAKE (Rabdi Falooda) (225g) – MRP: 678 – DP: 503 – SP: 2
Wellroot – CURCIDOC DROP (50ml) – MRP: 983 – DP: 727 – SP: 3
Wellroot – CURCIDOC TABLET (30) – MRP: 1639 – DP: 1212 – SP: 6
Wellroot – COW C DOC TABLET (30) – MRP: 1353 – DP: 1078 – SP: 6
Wellroot – MASSDOC POWDER (1000g) – MRP: 4982 – DP: 3558 – SP: 20
Wellroot – FENNELDOC DROP (50ml) – MRP: 314 – DP: 224 – SP: 1
Wellroot – FITDOC POWDER (100g) – MRP: 2559 – DP: 400 – SP: 2
Wellroot – DIGIDOC POWDER (100g) – MRP: 298 – DP: 213 – SP: 1
Wellroot – GILOY TABLET (30) – MRP: 303 – DP: 233 – SP: 1
Wellroot – ASHWAGANDHA TABLET (60) – MRP: 1311 – DP: 937 – SP: 5
Wellroot – GINSENG TABLET (60) – MRP: 1265 – DP: 904 – SP: 5
Wellroot – TESTOFAST TABLET (60) – MRP: 2727 – DP: 1948 – SP: 12
Wellroot – WAKECHA LEMON LIME (50g) – MRP: 559 – DP: 400 – SP: 2
Wellroot – ACTIVE FIBER COMPLEX (200g) – MRP: 2490 – DP: 1779 – SP: 9
Wellroot – PROTEINDOC POWDER (200g) – MRP: 1432 – DP: 1023 – SP: 5
Wellroot – NONIDOC JUICE (500ml) – MRP: 1149 – DP: 992 – SP: 6
Wellroot – BERRYDOC JUICE (1000ml) – MRP: 2742 – DP: 2027 – SP: 11
Wellroot – SEABUCKDOC JUICE (500ml) – MRP: 1254 – DP: 1082 – SP: 7
Wellroot – OMEGADOC CAPSULE (30) – MRP: 1212 – DP: 964 – SP: 6
Wellroot – VITADOC TABLET (30) – MRP: 1912 – DP: 1414 – SP: 8
Wellroot – HEIGHTDOC POWDER (500g) – MRP: 4359 – DP: 3114 – SP: 17
Wellroot – MORIDOC TABLET (60) – MRP: 1279 – DP: 984 – SP: 6
Wellroot – STEVIADOC DROP (50ml) – MRP: 2454 – DP: 350 – SP: 2
Wellroot – SPIRADOC TABLET (60) – MRP: 1289 – DP: 991 – SP: 6
Wellroot – EXE IMMUNITY DROP (50ml) – MRP: 247 – DP: 190 – SP: 1
Wellroot – ZINC TABLET (60) – MRP: 396 – DP: 305 – SP: 2
Wellroot – VITAMIN B12 TABLET (60) – MRP: 2619 – DP: 476 – SP: 3
Wellroot – VITAMIN D2 TABLET (60) – MRP: 801 – DP: 617 – SP: 4
Wellroot – CALCIUM TABLET (60) – MRP: 636 – DP: 489 – SP: 3
Wellroot – WOMEN WELLNESS TABLET (60) – MRP: 1397 – DP: 1075 – SP: 7
Wellroot – FENUGREEK EXTRACT TABLET (60) – MRP: 1120 – DP: 861 – SP: 5
Wellroot – ARJUN EXTRACT TABLET (60) – MRP: 1244 – DP: 957 – SP: 6
Wellroot – KESAR ELAICHI MILK MATE (500g) – MRP: 1668 – DP: 1191 – SP: 5
Wellroot – BRAHMI EXTRACT TABLET (60) – MRP: 547 – DP: 421 – SP: 2
Wellroot – NEEM EXTRACT TABLET (60) – MRP: 873 – DP: 672 – SP: 4
Wellroot – VITAMIN K2 TABLET (60) – MRP: 694 – DP: 534 – SP: 3
Wellroot – DAYLIFT TABLET (60) – MRP: 1231 – DP: 947 – SP: 6
Wellroot – IRON TABLET (60) – MRP: 673 – DP: 518 – SP: 3
Wellroot – SLIMDOC POWDER (Rich Chocolate) (500g) – MRP: 2366 – DP: 1690 – SP: 8
Wellroot – SLIMDOC POWDER (Real Mango) (500g) – MRP: 2366 – DP: 1690 – SP: 8
Wellroot – SLIMDOC POWDER (Juicy Strawberry) (500g) – MRP: 2366 – DP: 1690 – SP: 8
Wellroot – SLIMDOC POWDER (Creamy Banana) (500g) – MRP: 2366 – DP: 1690 – SP: 8

Veterinary – VETDOC CALCIUM SUSPENSION (5000ml) – MRP: 2306 – DP: 1774 – SP: 8
Veterinary – VETDOC FAT BOOSTER POWDER (1500g) – MRP: 1501 – DP: 1155 – SP: 5

Sniss Herbal – HAIRDOC OIL (100ml) – MRP: 229 – DP: 204 – SP: 1
Sniss Herbal – HAIR SHINE OINT CONDITIONER (100ml) – MRP: 363 – DP: 259 – SP: 1
Sniss Herbal – ALMOND OLIVE HAIR OIL (100ml) – MRP: 111 – DP: 79 – SP: 0.05
Sniss Herbal – AMLA HAIR OIL (100ml) – MRP: 105 – DP: 76 – SP: 0.05
Sniss Herbal – AYUCOCO HAIR OIL (100ml) – MRP: 115 – DP: 75 – SP: 0.05
Sniss Herbal – ALOEVERA CUCUMBER CREAM (50g) – MRP: 314 – DP: 224 – SP: 1
Sniss Herbal – COOL OIL (100ml) – MRP: 115 – DP: 83 – SP: 0.05
Sniss Herbal – FACE SCRUB CREAM (50g) – MRP: 328 – DP: 234 – SP: 1
Sniss Herbal – DAILY CARE SHAMPOO (100ml) – MRP: 111 – DP: 79 – SP: 0.15
Sniss Herbal – DAY CREAM (50g) – MRP: 358 – DP: 256 – SP: 1
Sniss Herbal – ULTRA SMOOTHING SHAMPOO (100ml) – MRP: 123 – DP: 88 – SP: 0.15
Sniss Herbal – V SPLASH (100ml) – MRP: 310 – DP: 222 – SP: 1
Sniss Herbal – NIGHT CREAM WOMENS (50g) – MRP: 377 – DP: 269 – SP: 1
Sniss Herbal – DAMAGE REPAIR SHAMPOO (100ml) – MRP: 2148 – DP: 106 – SP: 0.15
Sniss Herbal – ROOT & SHINE SHAMPOO (100ml) – MRP: 136 – DP: 97 – SP: 0.15
Sniss Herbal – ALL DAY GLOW CREAM (50g) – MRP: 372 – DP: 266 – SP: 1
Sniss Herbal – MOISTURISING CREAM (50g) – MRP: 258 – DP: 184 – SP: 0.5
Sniss Herbal – ULTRA SMOOTHING SERUM (50ml) – MRP: 279 – DP: 199 – SP: 0.5
Sniss Herbal – HERBAL FACE WASH (100g) – MRP: 335 – DP: 239 – SP: 1
Sniss Herbal – STRAWBERRY FACE WASH (100g) – MRP: 237 – DP: 169 – SP: 0.5
Sniss Herbal – LIP BALM (10g) – MRP: 269 – DP: 49 – SP: 0.1
Sniss Herbal – BODY LOTION (200ml) – MRP: 433 – DP: 309 – SP: 1
Sniss Herbal – ALOEVERA SAFFRON OINT GEL (50g) – MRP: 337 – DP: 241 – SP: 1
Sniss Herbal – FACE PACK CREAM (50g) – MRP: 335 – DP: 239 – SP: 1
Sniss Herbal – HEAL DOC CREAM (50g) – MRP: 327 – DP: 233 – SP: 1
Sniss Herbal – PEEL OFF FACE MASK (100g) – MRP: 251 – DP: 179 – SP: 0.5
Sniss Herbal – ALOEVERA ORANGE SHOWER GEL (250ml) – MRP: 321 – DP: 229 – SP: 0.5
Sniss Herbal – ALOEVERA SHOWER GEL (250ml) – MRP: 357 – DP: 255 – SP: 0.5
Sniss Herbal – TALCUM POWDER (100g) – MRP: 156 – DP: 112 – SP: 0.25
Sniss Herbal – MOSQUITO REPELLENT CREAM (100g) – MRP: 181 – DP: 129 – SP: 0.25
Sniss Herbal – SHAVING CREAM FOR MEN (75g) – MRP: 123 – DP: 88 – SP: 0.15
Sniss Herbal – B-TON OINT (100g) – MRP: 808 – DP: 578 – SP: 3
Sniss Herbal – HAIR CLEANSER SHAMPOO (100ml) – MRP: 224 – DP: 199 – SP: 1
Sniss Herbal – HAIRDOC OIL (200ml) – MRP: 431 – DP: 359 – SP: 2

Sniss Elite – CHARCOAL FACE WASH (100ml) – MRP: 419 – DP: 299 – SP: 1
Sniss Elite – VITAMIN C FACE WASH (100ml) – MRP: 357 – DP: 255 – SP: 1
Sniss Elite – HYDRATING FACE WASH (100ml) – MRP: 357 – DP: 255 – SP: 1
Sniss Elite – ALOEVERA CUCUMBER GEL (300ml) – MRP: 371 – DP: 265 – SP: 1
Sniss Elite – ALOEVERA TURMERIC GEL (300ml) – MRP: 371 – DP: 265 – SP: 1
Sniss Elite – ALOEVERA PINK GEL (300ml) – MRP: 371 – DP: 265 – SP: 1
Sniss Elite – HYALURONIC ACID FACE MOISTURIZER (50g) – MRP: 2770 – DP: 550 – SP: 2
Sniss Elite – 24K GOLD FACE MOISTURIZER (50g) – MRP: 770 – DP: 550 – SP: 2
Sniss Elite – UNDER EYE CREAM (15g) – MRP: 699 – DP: 499 – SP: 2
Sniss Elite – VITAMIN C FACE TONER (100ml) – MRP: 629 – DP: 449 – SP: 2
Sniss Elite – HYALURONIC ACID + SNAIL MUCIN (30ml) – MRP: 699 – DP: 499 – SP: 2
Sniss Elite – VITAMIN C FACE SERUM (30ml) – MRP: 749 – DP: 535 – SP: 2
Sniss Elite – NIACINAMIDE FACE SERUM (30ml) – MRP: 699 – DP: 499 – SP: 2
Sniss Elite – 24K GOLD FACE SERUM (30ml) – MRP: 769 – DP: 549 – SP: 2
Sniss Elite – HAIR GROWTH SERUM (30ml) – MRP: 699 – DP: 499 – SP: 2
Sniss Elite – SALICYLIC ACID FACE SHEET MASK (20ml) – MRP: 315 – DP: 225 – SP: 1
Sniss Elite – AHA + BHA FACE SHEET MASK (20ml) – MRP: 315 – DP: 225 – SP: 1
Sniss Elite – KOJIC ACID FACE SHEET MASK (20ml) – MRP: 315 – DP: 225 – SP: 1
Sniss Elite – COLLAGEN + PEPTIDE FACE SHEET MASK (20ml) – MRP: 315 – DP: 225 – SP: 1
Sniss Elite – DE-TAN FACIAL SHEET MASK (20ml) – MRP: 315 – DP: 225 – SP: 1
Sniss Elite – HANDWASH (250ml) – MRP: 175 – DP: 125 – SP: 0.25
Sniss Elite – HANDWASH REFILL (1000ml) – MRP: 388 – DP: 277 – SP: 0.25
Sniss Elite – SUNSCREEN SPF50 PA++++ GEL (50g) – MRP: 405 – DP: 289 – SP: 1
Sniss Elite – LAVENDER SUNSCREEN STICK (20g) – MRP: 769 – DP: 549 – SP: 2

Sniss Cosmetic – PREP-IT PRIMER (30ml) – MRP: 1329 – DP: 949 – SP: 4
Sniss Cosmetic – LIFT & SCULPT CONCEALER IVORY (4ml) – MRP: 909 – DP: 649 – SP: 3
Sniss Cosmetic – ULTRA SMOOTH FOUNDATION (30ml) – MRP: 1049 – DP: 749 – SP: 3
Sniss Cosmetic – COLOR DREW BLUSH STICK (4ml) – MRP: 559 – DP: 399 – SP: 1.5
Sniss Cosmetic – BLURR LOOSE POWDER (15g) – MRP: 1245 – DP: 889 – SP: 4
Sniss Cosmetic – LUMITOUCH COMPACT POWDER (9g) – MRP: 979 – DP: 699 – SP: 3
Sniss Cosmetic – POWDER BLUSH (3.5g) – MRP: 909 – DP: 649 – SP: 3
Sniss Cosmetic – EYELINER HOLOGRAPHIC (1ml) – MRP: 279 – DP: 199 – SP: 0.5
Sniss Cosmetic – EYELINER METALLIC ROSE GOLD (3.5ml) – MRP: 979 – DP: 699 – SP: 3
Sniss Cosmetic – MATT EYE LINER BLACK (3.5ml) – MRP: 867 – DP: 619 – SP: 3
Sniss Cosmetic – KAJAL RETRACTABLE (0.3g) – MRP: 349 – DP: 249 – SP: 1
Sniss Cosmetic – FLICK & LIFT MASCARA (5ml) – MRP: 699 – DP: 499 – SP: 2
Sniss Cosmetic – ALL DAY LUXE CREAM LIPSTICK (3.5g) – MRP: 699 – DP: 499 – SP: 2
Sniss Cosmetic – LUXE MATTE LIQUID LIPSTICK (3.5ml) – MRP: 517 – DP: 369 – SP: 1.5
Sniss Cosmetic – JUICY LIP BALM (4g) – MRP: 406 – DP: 290 – SP: 1
Sniss Cosmetic – SKIN TINT LUMINOUS VEIL (30ml) – MRP: 1399 – DP: 999 – SP: 4
Sniss Cosmetic – LUXE LIPS DEFINER (1.5g) – MRP: 979 – DP: 699 – SP: 3
Sniss Cosmetic – STROBE CREAM (25ml) – MRP: 1399 – DP: 999 – SP: 4
Sniss Cosmetic – SILK SHEIN LUXE LIP GLOSS (2ml) – MRP: 391 – DP: 279 – SP: 1
Sniss Cosmetic – SINDOOR RED (5ml) – MRP: 141 – DP: 101 – SP: 0.25
Sniss Cosmetic – COLOR CORRECTOR GREEN (4ml) – MRP: 629 – DP: 449 – SP: 2

Others – AWPL DIARY 2025 – MRP: 299 – DP: 299 – SP: 0
Others – BACK PACK – MRP: 1679 – DP: 1199 – SP: 3

Oral Care – DENTODOC CREAM (100g) – MRP: 232 – DP: 206 – SP: 1

Jeeveda Spices – RICE BRAN OIL (2L) – MRP: 605 – DP: 465 – SP: 1
Jeeveda Spices – RICE BRAN OIL (5L) – MRP: 1512 – DP: 1163 – SP: 2.5
Jeeveda Spices – CHHOLE CHANA MASALA (100g) – MRP: 139 – DP: 99 – SP: 0.2
Jeeveda Spices – CHICKEN MASALA (100g) – MRP: 147 – DP: 105 – SP: 0.1
Jeeveda Spices – DAL MAKHANI MASALA (100g) – MRP: 161 – DP: 115 – SP: 0.1
Jeeveda Spices – FISH MASALA (100g) – MRP: 153 – DP: 109 – SP: 0.1
Jeeveda Spices – GARAM MASALA (100g) – MRP: 167 – DP: 119 – SP: 0.1
Jeeveda Spices – KITCHEN KING (100g) – MRP: 139 – DP: 99 – SP: 0.15
Jeeveda Spices – MUTTON MASALA (100g) – MRP: 167 – DP: 119 – SP: 0.1
Jeeveda Spices – PAV BHAJI MASALA (100g) – MRP: 139 – DP: 99 – SP: 0.15
Jeeveda Spices – RAJMA MASALA (100g) – MRP: 139 – DP: 99 – SP: 0.15
Jeeveda Spices – SHAHI PANEER MASALA (100g) – MRP: 153 – DP: 109 – SP: 0.15
Jeeveda Spices – SAMBHAR MASALA (100g) – MRP: 125 – DP: 89 – SP: 0.1
Jeeveda Spices – TANDOORI CHICKEN MASALA (100g) – MRP: 139 – DP: 99 – SP: 0.2
Jeeveda Spices – CAROM SEEDS (50g) – MRP: 83 – DP: 59 – SP: 0.15
Jeeveda Spices – BLACK PEPPER (50g) – MRP: 139 – DP: 99 – SP: 0.15
Jeeveda Spices – BLACK CARDAMOM (50g) – MRP: 321 – DP: 229 – SP: 0.2
Jeeveda Spices – GREEN CARDAMOM (25g) – MRP: 251 – DP: 179 – SP: 0.15
Jeeveda Spices – CUMIN SEEDS (100g) – MRP: 125 – DP: 89 – SP: 0.15
Jeeveda Spices – NIGELLA SEEDS (50g) – MRP: 277 – DP: 55 – SP: 0.15
Jeeveda Spices – FENUGREEK SEEDS (100g) – MRP: 69 – DP: 49 – SP: 0.15
Jeeveda Spices – MUSTARD SEEDS (100g) – MRP: 55 – DP: 39 – SP: 0.15
Jeeveda Spices – CLOVE (50g) – MRP: 167 – DP: 119 – SP: 0.15
Jeeveda Spices – CINNAMON STICKS (50g) – MRP: 111 – DP: 79 – SP: 0.15
Jeeveda Spices – BAY LEAF (25g) – MRP: 60 – DP: 43 – SP: 0.15
Jeeveda Spices – KASOORI METHI (50g) – MRP: 88 – DP: 63 – SP: 0.15
Jeeveda Spices – CHILLI POWDER (100g) – MRP: 79 – DP: 56 – SP: 0.1
Jeeveda Spices – TURMERIC POWDER (100g) – MRP: 56 – DP: 40 – SP: 0.1
Jeeveda Spices – CORIANDER POWDER (100g) – MRP: 55 – DP: 39 – SP: 0.1

Home Care – BATHVEDA FRESH LIME BAR SOAP (375g) – MRP: 234 – DP: 168 – SP: 0.25
Home Care – BATHVEDA MYSORE SANDAL (375g) – MRP: 261 – DP: 187 – SP: 0.25
Home Care – BATHVEDA NEEM TULSI BAR (375g) – MRP: 216 – DP: 165 – SP: 0.25
Home Care – BATHVEDA BEAUTY CREAM BAR (375g) – MRP: 216 – DP: 165 – SP: 0.25
Home Care – BATHVEDA GOAT MILK BAR (375g) – MRP: 384 – DP: 275 – SP: 0.5
Home Care – BATHVEDA GLYCERIN NATURAL OIL BAR (375g) – MRP: 216 – DP: 165 – SP: 0.25
Home Care – TOSHINE LIQUID WASH (1000ml) – MRP: 271 – DP: 193 – SP: 0.5
Home Care – LIMFRESH DISH WASH (500ml) – MRP: 133 – DP: 95 – SP: 0.25
Home Care – TOSHINE DETERGENT POWDER (1000g) – MRP: 198 – DP: 141 – SP: 0.25
Home Care – EASY SWEEP SURFACE CLEANER (500ml) – MRP: 133 – DP: 95 – SP: 0.25
Home Care – POWER FLUSH TOILET CLEANER (500ml) – MRP: 125 – DP: 89 – SP: 0.25
Home Care – TOSHINE WINTERWEAR LIQUID WASH (1000ml) – MRP: 266 – DP: 190 – SP: 0.25
Home Care – TOSHINE DETERGENT BAR (3 Pieces) – MRP: 120 – DP: 93 – SP: 0.2
Home Care – LIMFRESH DISH WASH BAR (3 Pieces) – MRP: 129 – DP: 92 – SP: 0.2
Home Care – ROOM FRESHENER MUSK (200ml) – MRP: 325 – DP: 232 – SP: 0.75

Food Product – ECO AROGYAM MULTIFLORA HONEY (500g) – MRP: 531 – DP: 379 – SP: 1
Food Product – ECO AROGYAM COFFEE (50g) – MRP: 313 – DP: 261 – SP: 1
Food Product – ECO AROGYAM TEA (250g) – MRP: 197 – DP: 151 – SP: 0.25

Baby Care – LITTLE PIE BABY SHAMPOO (100ml) – MRP: 155 – DP: 111 – SP: 0.2
Baby Care – LITTLE PIE SOOTHING BABY SOAP (75g) – MRP: 258 – DP: 184 – SP: 0.2
Baby Care – LITTLE PIE BABY LOTION (100ml) – MRP: 245 – DP: 175 – SP: 0.5
Baby Care – LITTLE PIE KIDS PROTEIN POWDER (200g) – MRP: 1618 – DP: 1156 – SP: 6

Wellness – EXE PANCH TULSI OIL (25ml) – MRP: 404 – DP: 349 – SP: 2
Wellness – ADIDOC PRAVAHI KWATH (25ml) – MRP: 444 – DP: 383 – SP: 2
Wellness – EXE TRIPHALA KWATH (500ml) – MRP: 448 – DP: 387 – SP: 2
Wellness – PRODOC POWDER (200g) – MRP: 713 – DP: 568 – SP: 3
Wellness – KIDGDOC RAS (250ml) – MRP: 794 – DP: 685 – SP: 4
Wellness – EXE ALOEVERA SYRUP (1000ml) – MRP: 949 – DP: 819 – SP: 5
Wellness – ALRGYDOC KWATH (500ml) – MRP: 1255 – DP: 1083 – SP: 7
Wellness – EYEDOC DROP (45ml) – MRP: 1305 – DP: 1128 – SP: 7
Wellness – BRAINDOC KWATH (500ml) – MRP: 1330 – DP: 1148 – SP: 7
Wellness – GYNEDOC RAS (500ml) – MRP: 1442 – DP: 1244 – SP: 8
Wellness – DIABODOC RAS (1000ml) – MRP: 1460 – DP: 1259 – SP: 8
Wellness – LIVODOC RAS (500ml) – MRP: 1494 – DP: 1289 – SP: 8
Wellness – IMMUNODOC RAS (1000ml) – MRP: 2073 – DP: 1789 – SP: 12
Wellness – THUNDERBLAST RAS (500ml) – MRP: 2248 – DP: 1939 – SP: 13
Wellness – THYDOC KWATH (1000ml) – MRP: 2435 – DP: 2101 – SP: 13
Wellness – CARDIODOC RAS (1000ml) – MRP: 2253 – DP: 1945 – SP: 13
Wellness – PILODOC RAS (1000ml) – MRP: 2403 – DP: 2074 – SP: 13
Wellness – CHLORODOC KWATH (1000ml) – MRP: 2421 – DP: 2089 – SP: 13
Wellness – ORTHODOC KWATH (1000ml) – MRP: 2250 – DP: 1941 – SP: 13
Wellness – STONDOC RAS (1000ml) – MRP: 2507 – DP: 2163 – SP: 14
Wellness – OBEODOC RAS (1000ml) – MRP: 2541 – DP: 2192 – SP: 15
Wellness – EXE PUNARNAVA KWATH (500ml) – MRP: 1144 – DP: 960 – SP: 5
Wellness – ASCLEPIUS CHYAWANPRASH (500g) – MRP: 498 – DP: 365 – SP: 1
Wellness – EXE HERBAL TEA (100g) – MRP: 526 – DP: 404 – SP: 2
Wellness – FEVODOC KWATH (1000ml) – MRP: 2477 – DP: 1973 – SP: 12
Wellness – COUGHDOC KWATH (200ml) – MRP: 543 – DP: 433 – SP: 2
Wellness – EXE JC OINT (50g) – MRP: 475 – DP: 366 – SP: 2
Wellness – EXE VEINDOC OIL (25ml) – MRP: 287 – DP: 221 – SP: 1
Wellness – VIRALDOC KWATH (500ml) – MRP: 779 – DP: 599 – SP: 3
Wellness – EXE HERBAL MEHANDI POWDER (200g) – MRP: 558 – DP: 429 – SP: 2
Wellness – AYUSH KWATH POWDER (100g) – MRP: 315 – DP: 242 – SP: 1
Wellness – PRASSDOC (500g) – MRP: 1285 – DP: 988 – SP: 6
Wellness – EXE WHEAT GRASS POWDER (100g) – MRP: 696 – DP: 535 – SP: 3
Wellness – EXE C COMFORT OIL (10ml) – MRP: 125 – DP: 96 – SP: 0.5
Wellness – SHUDDH SHILAJIT CAPSULE (60) – MRP: 1785 – DP: 1422 – SP: 8
Wellness – GASDOC CAPSULE (60) – MRP: 1088 – DP: 866 – SP: 4
Wellness – KABZDOC GRANULES (100g) – MRP: 189 – DP: 150 – SP: 0.5
Wellness – HIIMODOC SYRUP (500ml) – MRP: 1547 – DP: 1232 – SP: 7
Wellness – ASTHMDOC SYRUP (500ml) – MRP: 1803 – DP: 1436 – SP: 8
Wellness – METAADOC SYRUP (500ml) – MRP: 1380 – DP: 1099 – SP: 6
Wellness – RAAKTDOC SYRUP (500ml) – MRP: 1845 – DP: 1469 – SP: 8
Wellness – FREE YOU ANION SANITARY PAD (280mm, 10pc) – MRP: 223 – DP: 159 – SP: 0.5
Wellness – FREE YOU ANION SANITARY PAD (330mm, 10pc) – MRP: 237 – DP: 169 – SP: 0.5
Wellness – ASCLEPIUS SHUDH SHILAJIT (25g) – MRP: 2218 – DP: 1640 – SP: 10
Wellness – JOINT CURATOR OIL (50ml) – MRP: 385 – DP: 333 – SP: 2
"""

products = []
lines = data.strip().split('\n')
for line in lines:
    line = line.strip()
    if not line: continue
    
    match = re.match(r'^(.*?) [–-] (.*?) [–-] MRP: ([\d\.]+) [–-] DP: ([\d\.]+) [–-] SP: ([\d\.]+)', line)
    
    if match:
        category = match.group(1).strip()
        name = match.group(2).strip()
        mrp = float(match.group(3))
        dp = float(match.group(4))
        sp = float(match.group(5))
        
        products.append({
            'name': name,
            'category': category,
            'mrp': mrp,
            'dp': dp,
            'sp': sp,
            'stock': 50
        })

ts_content = "import { Product } from './types';\n\n// Comprehensive Asclepius Wellness Product Catalog\n// Sourced from official price list provided by user\n\nexport const ASCLEPIUS_CATALOG: Omit<Product, 'id'>[] = " + json.dumps(products, indent=2) + ";\n"

with open('asclepiusData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)
