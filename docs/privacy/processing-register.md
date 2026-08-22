# Behandlingsprotokoll – utkast

Behandlingsansvarlig: HANSEN GROUP AS, org.nr. 938 162 379, Kvelvahaugen 1, 9440 Evenskjer.

| Aktivitet | Registrerte/data | Formål | Grunnlag | Mottakere | Lagring |
|---|---|---|---|---|---|
| Pia-chat | Voksne brukere; chattekst og mulig tannhelseinformasjon | Svare og finne klinikker/priser | Uttrykkelig samtykke, GDPR art. 6(1)(a) og 9(2)(a) | OpenAI, Supabase | Chat i nettleserøkten; serverlogger må kartlegges |
| Posisjonssøk | Koordinater etter aktivt knappetrykk | Finne nærliggende klinikker | Samtykke | Google/Supabase-funksjon | Ikke i localStorage; serverlogger må kartlegges |
| Kontaktforespørsel | Ikke aktivert i offentlig lansering | Fremtidig funksjon | Krever ny vurdering og uttrykkelig samtykke | Ingen i dagens løsning | Ingen nye henvisninger |
| Klinikk- og prissøk | Søkeord, sted, behandlingsvalg | Levere søkeresultat | Avtale/berettiget interesse, vurderes | Google og klinikknettsider | Cache-/avtalevilkår må dokumenteres |
| Sikkerhetslogging | IP/tekniske metadata kan forekomme | Sikker drift og feilsøking | Berettiget interesse | Hostinger, Supabase | Må fastsettes og minimeres |

Systemeiere, datalokasjoner, konkrete loggfrister og databehandleravtaler må fylles ut før godkjenning.
