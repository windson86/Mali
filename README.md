# MALI 🐶

**Born to learn. Raised by you.**

Mali je eksperimentalna web igra i mali vlastiti AI projekt. Svaki igrač će imati svojeg virtualnog psića, a svi će u budućnosti doprinositi učenju jednog zajedničkog AI modela.

## Trenutna verzija — prototip v0.2

- Interaktivna soba: kućica, posuda za hranu, lopta, šetnja i trening.
- Jednostavni SVG crteži bez vanjskih biblioteka.
- Prikaz prilagođen mobitelima i računalima.
- Trenutačne vrijednosti i napredak spremaju se **lokalno u pregledniku** (localStorage).
- **Još nema** servera, zajedničkih profila, baze podataka ni stvarnog AI učenja.

## Plan daljnjeg razvoja

1. Doraditi izgled i interakcije u web igri.
2. Napraviti anonimni identitet i zasebno stanje za svakog psića.
3. Bilježiti ljudske lekcije: prepoznavanje boja i kretanje kroz prostor.
4. Iz tih primjera trenirati naš mali, vlastiti Python AI — bez vanjskih AI servisa.
5. Uvesti zajedničku verziju mozga, testove napretka i nagrade za korisnike.
6. Kao moguće nagrade: promjene boje ogrlice, uha, krova kućice i drugih detalja.

## Pokretanje lokalno

Otvori `index.html` u pregledniku. Za ovu verziju nisu potrebni instalacija, npm ni build proces.

## Netlify

Poveži repozitorij **`windson86/Mali`** s Netlifyjem:

- Production branch: `main`
- Base directory: prazno
- Build command: prazno
- Publish directory: `.` (korijen repozitorija)

Datoteka `netlify.toml` već ima odgovarajuću postavku za objavu.

Domena `mali.com.hr` povezat će se kada bude aktivna.

> **Napomena:** v0.2 je demonstracija. Ne predstavlja gotov AI i ne dijeli podatke između posjetitelja.
