# Pocket Dentist – personvern- og lanseringssjekkliste

Status: utkast 2026-08-22. Dette er et arbeidsdokument, ikke juridisk rådgivning.

## Må være ferdig før produksjon

- [x] Juridisk identitet er oppgitt som HANSEN GROUP AS, org.nr. 938 162 379, Kvelvahaugen 1, 9440 Evenskjer.
- [x] Lanseringstjenesten er begrenset til personer som er 18 år eller eldre.
- [x] Offentlig Pia samler ikke inn navn/telefonnummer og oppretter ikke henvisninger.
- [ ] Kjør og dokumenter DPIA for KI-chat, tannhelseopplysninger og posisjon.
- [ ] Signer/kontroller databehandleravtaler med Supabase, OpenAI og Hostinger.
- [ ] Dokumenter Supabase- og Hostinger-region, og behandlingsgrunnlag/garanti for alle overføringer utenfor EØS.
- [ ] Deploy sikkerhetsmigrasjonen `20260822193000_secure_patient_data.sql` før frontend som kan lagre henvendelser.
- [ ] Deploy oppdatert `create-referral` Edge Function etter migrasjonen.
- [ ] Sett opp daglig kall til `purge_expired_patient_data()` med service role og overvåk at sletting lykkes.
- [ ] Test at anon-nøkkel ikke kan lese, opprette, endre eller slette samtaler, meldinger eller henvisninger direkte.
- [ ] Bekreft at personvernlenker og samtykkeflyt fungerer på mobil og desktop.
- [ ] Verifiser tilgjengelighet: tastatur, fokus, etiketter, kontrast, 200 % zoom og redusert bevegelse.
- [ ] Gjennomgå bruk og lagring av Google Places-innhold mot gjeldende avtale; lagre primært Place ID og egeninnhentede klinikk-/prisdata.
- [ ] Utfør produksjons-backup, deploy kjent commit og smoke-test før trafikk slippes på.

## Analyse og markedsføring

- Ingen Google Analytics eller Meta Pixel er aktivert i dagens kode.
- Ikke legg inn slike skript uten en samtykkeløsning som blokkerer dem før opt-in, gir like tydelige Godta/Avslå-valg, granulære formål og enkel tilbaketrekking.
- Ikke bruk Meta Pixel eller markedsføringssporing i Pia-chat, behandlingsvalg eller sider som kan avsløre helseinteresse.

## Hendelser og rettigheter

- Dokumenter prosess for innsyn, retting, sletting, begrensning, dataportabilitet og tilbaketrekking av samtykke.
- Dokumenter avvikshåndtering og vurdering av 72-timers varslingsfrist til Datatilsynet.
- Oppgi ansvarlig person og e-post for personvernforespørsler.
