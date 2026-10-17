# Mali — zajedničke lekcije (Firebase, pilot)

Ovo **NIJE AI servis**. Firebase pohranjuje ljudske oznake boja; Python na laptopu trenira naš vlastiti model.

## Što trenutno radi
- Sva učenja ostaju u localStorage i mogu se izvesti kao JSON.
- Izbor oznake automatski prikazuje novu lopticu nakon 650 ms.
- Ako nema Firebase konfiguracije, online zapis je **isključen**, a igra radi lokalno.
- Nakon pravilnog spajanja: anonimni korisnik sprema samo svoje lekcije u Realtime Database; zapis je `create-only`, drugi korisnici ne mogu čitati tuđe lekcije.
- Već prikupljene lokalne lekcije pokušavamo poslati kada Firebase bude povezan. Uspješni zapisi označeni su lokalno, a neposlane lekcije ostaju lokalne.

## Povezivanje (treba učiniti vlasnik projekta u Firebase konzoli)
1. Napravi **NOVI projekt** Firebase, ne koristi bazu ribolovne stanice.
2. Project settings → Your apps → Web app; kopiraj **javni web config** (`apiKey`, `authDomain`, `projectId`, `appId`, `databaseURL`).
3. Authentication → Sign-in method → omogući **Anonymous**; provjeri autorizirane domene (`malipesek.netlify.app`, poslije `mali.com.hr`).
4. Realtime Database → Create database (Spark, ako odgovara ograničenjima); postavi pravila iz `firebase.rules.json` u **Rules** i isprobaj ih u emulatoru/rules simulatoru prije javnog upisa.
5. U `firebase-config.js` zamijeni `null` javnim config objektom i objavi jednu kontroliranu izmjenu.
6. Otvori sa dva različita uređaja, uči po jednu boju, provjeri da se upis pojavljuje samo u pripadajućoj `colorLessons/v1/<uid>/...` grani i da se lekcije i dalje mogu izvesti lokalno.

**Ne stavljaj service-account, JSON privatne ključeve ili adminke podatke u web ni GitHub.** Firebase Web apiKey je javni identifikator projekta, ne administratorska tajna.

## Preuzimanje na laptop radi treniranja
```bat
py -m pip install firebase-admin
py tools/export_firebase_lessons.py --service-account "C:\\privatno\\mali-admin.json" --database-url "https://YOUR-DB.firebasedatabase.app"
```
Skript kreira `lekcije/mali-zajednicke-lekcije.json`. Kreni s provjerom učestalosti boja i duplikata prije puštanja naučenog modela online.

## Ograničenja prototipa
- **Treniranje je i dalje ručno na laptopu**; Firebase služi samo spremanju lekcija.
- Još nema zajedničkih korisničkih profila niti sinkronizacije osobnog psića.
- Sigurnosna pravila provjeravaju format i vlasništvo nad podacima, **ali ne mogu jamčiti da je osoba točno imenovala boju**, niti potpuno spriječiti spam anonimnih računa.
- **Prije šire javne objave** treba testirati pravila, dodati zaštitu od zloporaba (App Check i/ili serverski rate limiting), pravila privatnosti i postupak za roditeljski pristanak gdje je potreban. Ne stavljati slobodni tekst, osobne podatke ili imena djece u lekcije.
- Pratiti besplatne kvote baze i autentikacije.
