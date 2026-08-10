# Sobix Class Dashboard

Öffentliches WoW-Retail-Dashboard für 13 Charaktere auf **EU–Eredar**.

## Einrichtung auf GitHub

1. Den kompletten Inhalt dieses Ordners in das Repository `sobixgaming/sobix-class-dashboard` hochladen.
2. Im [Battle.net Developer Portal](https://develop.battle.net/access/clients) einen API-Client anlegen.
3. Unter **Settings → Secrets and variables → Actions** zwei Repository-Secrets anlegen:
   - `BLIZZARD_CLIENT_ID`
   - `BLIZZARD_CLIENT_SECRET`
4. Unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** auswählen.
5. Unter **Actions → Update and deploy dashboard → Run workflow** die erste Aktualisierung starten.

Die Zugangsdaten werden nie an die Website ausgeliefert.

## Berechnung

- Klassen und aktive Spezialisierungen sowie Charakterstufen stammen aus der Blizzard Profile API.
- M+-Score und Raidfortschritt stammen aus Raider.IO.
- M+-Prozentwerte sind Anteile am gesamten M+-Score, keine Spielzeitanteile.
- Raid-Spielanteile nach Klasse/Spezialisierung sind ohne Warcraft Logs nicht zuverlässig verfügbar und werden daher nicht erfunden.
- Saisonbestwerte werden in `data/dashboard.json` fortgeschrieben.

## Lokale Vorschau

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

