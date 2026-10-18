# MALI 🐶 — Born to learn. Raised by you.

Eksperimentalni Tamagotchi s malim **vlastitim AI modelom** koji će učiti iz lekcija korisnika. Bez gotovog AI API-ja i bez pretreniranih modela.

## Trenutno: v0.3 — škola boja (početni eksperiment)

- Interaktivna soba: kućica, zdjelica, šetnja, maženje i trening smjerova.
- Na loptici se otvara **Uči me** i **Pokaži što znaš**.
- Loptice imaju nasumične RGB vrijednosti, **bez unaprijed zadanih točnih odgovora**.
- Svaku lekciju boje označava korisnik. Ako boja nije jedna od ponuđene četiri, preskoči je.
- Lekcije se zasad spremaju samo u `localStorage` korisnikova preglednika (maksimalno 1800 lekcija na uređaju).
- Gumb **Izvezi moje lekcije (.json)** sprema ih na korisnikov uređaj radi kasnijeg treniranja.
- `brain/active.json` je namjerno **neistreniran**. Prije prvog stvarnog treniranja Mali ne zna boje.
- Trenutno nema centralne baze, razmjene lekcija između korisnika, automatskog treniranja ni zajedničkog AI modela na serveru.

## Lokalno pokretanje

```bash
python -m http.server 8000
```

Otvoriti `http://localhost:8000`. Ne trebaju npm ni build proces. Netlify automatski objavljuje `main` granu (`netlify.toml` objavljuje korijen repozitorija).

## Stvarno treniranje vlastitog mozga (Python + NumPy)

1. Skupiti i izvesti korisničke lekcije iz web igre. Lekcije moraju biti stvarno označene od ljudi; nemojte generirati lažne unaprijed označene primjere i prikazivati ih kao ljudske.
2. Instalirati Python 3 i ovisnosti: `python -m pip install -r requirements.txt`.
3. Iz korijena repozitorija pokrenuti:

```bash
python tools/train_colors.py --input mali-lekcije-1.json mali-lekcije-2.json --output brain/active.json
```

Skripta trenira malu neuronsku mrežu **3 RGB ulaza → 16 neurona (`tanh`) → 4 boje**. Nema color lookup tablicu i ne koristi nijedan vanjski AI servis. Minimalno treba osam različitih ljudskih primjera po boji. Neodgovarajuće ili kontradiktorne oznake istog RGB-a odbacuje. Odvaja dio primjera za provjeru na neviđenim bojama, ispisuje točnost i sprema težine u JSON.

**Prije objave:** pogledati rezultate i provjeriti model na stvarno novim primjerima. Sačuvati staru verziju modela. Nova verzija `brain/active.json` može se poslati na GitHub nakon provjere; Netlify je potom automatski objavljuje. Samo prebacivanje lekcija ili generiranje modela ne znači automatski da je novi model bolji.

## Značajke koje dolaze kasnije

- Jedinstveni anonimni identitet i napredak za svakog psića, dostupan i na više uređaja.
- Zajednička baza ljudskih lekcija i sprječavanje spama te manipulacije primjerima.
- Povijest naučenih verzija mozga i javna, ponovljiva mjerenja napretka.
- Učenje kretanja pomoću ljudskih demonstracija, odvojeno od programirane simulacije hodanja.
- Samostalni Python backend i PostgreSQL baza na našem VPS-u kad to zatreba.

Privremena web adresa: https://malipesek.netlify.app . Domena `mali.com.hr` bit će povezana nakon aktivacije.
## Priprema za zajedničko učenje — web v0.4

- Sitne UI dorade: precizniji dodir psića, zdjelica ostaje vidljiva i automatski nova loptica.
- Datoteke `firebase-config.js`, `firebase-sync.js`, `firebase.rules.json`, `tools/export_firebase_lessons.py` pripremaju zajedničku bazu.
- **Cloud upis je trenutno isključen** dok se ne postavi zaseban Firebase projekt, Anonymous Auth i pravila; postojeće lekcije ostaju lokalno.
- Upute: [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Labirint 8 × 8 — učenje kretanja

- Klikom na **Labirint 🧩** otvara se mreža 8 × 8 s jednom lopticom i 8–9 nasumičnih blokiranih polja (12,5–14,1%).
- Svaki labirint ima prohodan put do loptice; algoritam provjerava prohodnost, ali **ne vodi Malog**.
- Mali prepoznaje prepreke najviše dva polja udaljenosti (po mrežnoj udaljenosti), uključujući iza drugih prepreka, i pamti otkrivene prepreke tijekom pokušaja.
- **Korisnik vodi Malog** strelicama na ekranu ili tipkovnici. Bilježe se koraci, neuspjeli pokušaji i ono što je Mali znao u trenutku poteza.
- Na cilju se ljudska ruta sprema u **localStorage** i može se preuzeti gumbom **Izvezi rute** (JSON, `mali-navigation-lessons-v1`).
- Rute **još ne idu u Firebase** i Python **još ne trenira navigaciju**; povezivanje s bazom i učenje prostora slijede kasnije. Postojeća škola boja nije mijenjana.
- Dok Mali spava ne može započeti labirint. Dovršena ruta donosi +8 XP; najkraći put prikazuje se tek na kraju kao usporedba.

## Stabilizacija sučelja, kalendarski dani i provjera naučenih boja

- **DAN** se računa po lokalnim kalendarskim datumima od izvornog `born` trenutka u `localStorage`, bez poništavanja starog napretka. Svaki preglednik ima zaseban napredak do buduće prijave korisnika.
- Labirint je 8 × 8 s 8 ili 9 blokiranih polja. Polja imaju 8 fiksnih redaka i stupaca; tijekom kretanja mijenja se samo prikaz polja, bez ponovnog otvaranja modalnog prozora.
- Umjesto emojija teniske loptice, cilj labirinta je obična obojena kružna loptica iz **istog RGB generatora** koji koristi učenje boja. Boja je spremljena kao `ball_rgb` u lokalnoj, izvezenoj ruti. U labirintu se još ne prepoznaje boja niti radi autonomna navigacija.
- Kad je **stvarno istreniran model** objavljen u `brain/active.json`, način **Pokaži što znaš** prvo pokazuje Malijevu pretpostavku. **Bravo!** prihvaća pretpostavku, a **Nije, nego…** otvara četiri ljudske oznake za ispravak; obje spremaju jednu potvrđenu lekciju (`source: verification`) u postojeću lokalnu pohranu i Firebase kad je dostupan, pa automatski slijedi nova loptica.
- **Ne znam** i **Druga loptica** preskaču uzorak bez XP-a i bez spremanja. Dok je model neistreniran, škola boja ostaje u režimu ljudskog podučavanja, bez lažne pretpostavke i bez gumba Bravo.
- Model se **ne trenira u Netlifyju**; mora nastati na korisničkom laptopu. Trenutna `brain/active.json` ima `trained: false`; nemoj je zamijeniti lažnim podacima ili administratorskim Firebase ključem. U GitHub javno ide samo trenirani `brain/active.json`, nikako service-account JSON.


## Firebase Control Center → Netlify (konfiguracija revizije 1+)

- Lokalna konzola `MALI Control Center` piše konfiguraciju na `gameConfig/public` i čuva stare verzije pod `adminHistory/config`. Admin SDK ključ **ostaje isključivo na laptopu**.
- `game-config.js` na Netlifyju javno čita samo `gameConfig/public`. Provjerava strukturu (`schema_version:1`, boje i labirint), pamti posljednju valjanu verziju u pregledniku i koristi sigurne zadane postavke kada Firebase nije dostupan.
- **Jednokratan ručni korak u Firebase Console → Realtime Database → Rules:** zalijepiti i objaviti cijelu datoteku `firebase.rules.json` iz GitHuba. Do te objave pristup javnoj konfiguraciji bit će odbijen; igra će nastaviti koristiti zadane ili zadnje uspješno spremljene postavke.
- Pravila omogućuju čitanje **samo** `gameConfig/public`, ostavljaju `adminHistory` privatnim te i dalje ograničavaju korisničke upise na vlastiti anonimni Firebase UID.
- Konzola može promijeniti nijanse, učestalost, uključene boje, veličinu labirinta (8×8, 12×12, 16×16), postotak prepreka (5–30%), domet vida (1–5 polja) te 1–3 loptice. Svaki generirani labirint provjerava prohodnost za sve ciljeve, redom.
- Web podržava dinamički popis oznaka boja. **„Nijedna od ponuđenih”** bilježi RGB kao `colorFeedback/v1/${uid}/${id}`, zasebno od lekcija za treniranje. „Ne znam” samo preskače. Za promjenu broja klasa mora se nadograditi i Python trener te objaviti kompatibilan naučeni model.
- Trenutno `brain/active.json` i dalje dolazi s Netlifyja: objava novog mozga kroz lokalnu konzolu/Firebase slijedi u zasebnom koraku.
- Za promjene koje web već zna obraditi ne treba novi deploy: igra povremeno osvježava postavke; promjene labirinta primjenjuju se pri izradi sljedeće mape nakon uspješnog osvježenja. Osvježi stranicu želiš li odmah učitati posljednju reviziju.

## Navigacijske lekcije u Firebaseu

- Nakon što korisnik dovrši sve loptice u labirintu, potpuna demonstracija se **prvo čuva lokalno** kao i prije, a zatim se stavlja u red za Firebase `navigationLessons/v1/{anonymousUid}/{routeId}`.
- Web nakon prvog učitavanja automatski pronalazi i **ranije dovršene rute** iz `mali-navigation-lessons-v1` u pregledniku te ih pokušava poslati. Poslane ID-ove pamti pod zasebnim ključem `mali-uploaded-navigation-lessons-v1` kako se ne bi slale ponovno. Ne briše lokalne kopije.
- Firebase prima samo normalizirane zapise: veličinu mreže, početak, redoslijed ciljeva, prepreke, slijed poteza, viđene prepreke u trenutku poteza, aktualni cilj i metapodatke. Boje loptica nisu potrebne za treniranje navigacije i ne šalju se u tu zbirku.
- Zapisi su ograničeni na 800 poteza i 185.000 znakova radi zaštite besplatnih Firebase resursa. Prevelike rute ostaju lokalno i mogu se izvesti kao JSON.
- Nove **Firebase Realtime Database Rules** uključuju `navigationLessons/v1` kao kreiraj-samo, po anonimnom korisniku, sa zabranom javnog čitanja. Potrebno je **ručno objaviti novu cjelovitu datoteku `firebase.rules.json`** u Firebase Console → Realtime Database → Rules, jer GitHub commit ne mijenja aktivna Firebase pravila. Ostala pravila ostaju sačuvana.
- Labirint prikazuje broj ruta koje čekaju slanje ili broj potvrđeno poslanih ruta. Ako veza ili pravila ne rade, lokalni podaci ostaju sačuvani i pokušaj se ponavlja pri novom otvaranju weba.
- Ovaj korak **samo prikuplja demonstracije**. Mali još nema trenirani navigacijski model niti samostalno odabire smjer. Python trening na rutama radi se u idućoj fazi.


## Navigacijski mozak v0.2 — samostalni pokušaji, petlje i ljudska pomoć

- Web učitava **samo istrenirani model** iz Firebase `brain/navigation/active`, kojeg vlasnik prethodno objavljuje iz lokalnog **MALI Control Center v0.2**. Nikad ne objavljivati privatni Firebase Admin ključ. Neistrenirani ili odsutni model blokira opciju `🧠 Probaj sam` uz jasnu poruku.
- `navigation-brain.js` računa isti vektor od 18 značajki kao lokalni Python trener (trenutačni položaj i cilj, samo otkrivene prepreke, broj ranijih posjeta, prethodni smjer, dimenzija i indeks loptice). Ne koristi skriveni BFS ni informacije o neotkrivenim preprekama za odlučivanje; igra samo filtrira već poznate zidove.
- U labirintu `🧠 Probaj sam` pokreće model, `⏹ Zaustavi` prekida. Nakon `loop_repeats` identičnih obilazaka (zadano 4, podesivo na 2–6 iz konzole) Mali prekida i pita `🐾 Pomozi mi`. Ciklus se smatra istim samo ako se ponovi isti uređeni niz polja za isti cilj.
- Svaka petlja sprema se lokalno te se neovisno sinkronizira u `navigationIncidents/v1/$uid/$incidentId`. Nakon što čovjek preuzme strelice i stigne do aktualnog cilja, ta **isključivo ljudska korekcija** sprema se u `navigationCorrections/v1/$uid/$incidentId`.
- **Važno:** potezi Malijevog autonomnog modela **ne ulaze u `navigationLessons`** i ne smiju biti tretirani kao ljudsko učenje. Novi Python trener v0.2 uči na ljudskim dovršenim rutama i potvrđenim korekcijama. Nikada ne trenira na vlastitim pokušajima modela.
- `firebase.rules.json` dobiva tri sigurno odvojena nova čvora: javno čitanje objavljenog modela bez klijentskog pisanja te prijavu incidenata i korekcija samo pod osobnim anonimnim UID-om. Za rad potrebno je **ručno zamijeniti i objaviti sva pravila u Firebase Console → Realtime Database → Rules**. GitHub promjene same ne primjenjuju Firebase pravila.
- Lokalni Control Center v0.2 ima karticu Navigacija: broj petlji, broj riješenih korekcija, skicu labirinta po incidentu, objavu istreniranog `brain/navigation-active.json`, te izbor `loop_repeats` u kartici Labirint. Postojeći lokalni servisni ključ kopira se samo na korisnikov laptop; ne nalazi se u GitHubu niti u ZIP-u.
- Model treba prvo istrenirati lokalnim Python alatom (v0.2), zatim **objaviti u konzoli**. Bez ovog koraka web ne može predviđati smjerove. Stari modeli boja i stare rute ostaju netaknuti.
