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