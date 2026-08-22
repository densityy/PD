# DPIA – arbeidsutkast for Pia

## Hvorfor DPIA kreves

Løsningen kombinerer KI, potensielle helseopplysninger, posisjon og profilering av behov for klinikksøk. Dette gir høy risiko og skal vurderes før produksjon.

## Planlagt behandling

Pia mottar fritekst fra brukere som bekrefter at de er 18 år eller eldre, tolker tannhelsebehov og søker norske klinikker/priser. Offentlig lansering samler ikke inn navn eller telefonnummer og sender ikke henvisninger. Brukeren kontakter selv klinikken og kan velge manuelt sted i stedet for GPS.

## Hovedrisikoer og tiltak

- Feil eller overdrevent medisinsk råd: tydelig KI-merking, ingen diagnose, akuttmelding og avgrenset systemprompt.
- Uautorisert tilgang: RLS uten anon-policy, service-role kun i Edge Function, ingen hemmeligheter i klienten.
- For lang lagring: ingen offentlig henvisningsinnsamling; beskyttede resttabeller har 30-dagers utløp og slettemekanisme.
- Ugyldig samtykke: separate avkryssinger for 18+ og uttrykkelig helsesamtykke.
- Unødvendig posisjon: bare ved knappetrykk, ingen vedvarende nettleserlagring, manuelt alternativ.
- Tredjelandsoverføring: dokumenter leverandørregion, DPA, SCC og transfer impact assessment der relevant.
- Sporingslekkasje: ingen markedsføringspiksler i helseflyten; analyse blokkert til gyldig samtykke.
- Feil pris/klinikkstatus: vis kilde/dato, merk ubekreftet informasjon og krev bekreftelse hos klinikken.

## Gjenstående beslutninger

- Juridisk behandlingsansvarlig og personvernkontakt.
- Leverandørregioner og kontraktsdokumentasjon.
- Endelig datakartlegging av OpenAI- og Supabase-logger.
- Prosedyre for registrertes rettigheter, avvik og menneskelig oppfølging.
- Ny juridisk og sikkerhetsmessig vurdering før henvisningsfunksjonen eventuelt aktiveres.
- Formell risikoeier, godkjenner og dato.
