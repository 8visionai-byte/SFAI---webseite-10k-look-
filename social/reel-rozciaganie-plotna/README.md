# Rolka: rozciąganie płótna reklamowego (drone reveal) — v2

Pionowa rolka 9:16, 10,8 s. Widok z drona na bulwar w złotej godzinie. Wąski, złożony pas płótna trzymają dwa rzędy ludzi. Ludzie odchodzą na boki i rozciągają płótno, odsłaniając gigantyczny plakat SimpleFast.ai.

Wzór: reel @productive_emezeey. Klip „2026 BU:NET FORUM”: pas płótna rozciągany na boki przez ludzi.

## Pliki (biblioteka Higgsfield)

- **Finał MP4** (1080×1920, 24 fps, AAC 48 kHz, -13,6 LUFS): https://d2ol7oe51mr4n9.cloudfront.net/user_310akJlk1DZj68uM7PeydmU57ss/5d6e9a79-ac16-4e71-bd1f-9cbee7ad1201.mp4
- **Plakat PNG** 1200×1800: https://d2ol7oe51mr4n9.cloudfront.net/user_310akJlk1DZj68uM7PeydmU57ss/25d49d3f-bf13-4057-94a8-e2ec3419690b.png
- **Szablon plakatu:** `poster.html` (instrukcja zależności w nagłówku pliku)

## Branding: wyłącznie z oficjalnej strony www.simplefast.ai

- **Znak:** `https://www.simplefast.ai/brand/mark-t.png` (metalowe „SF” z cyrklem).
- **Wordmark na ciemnym tle:** biały „SimpleFast” + „.ai” w gradiencie `linear-gradient(90deg,#70b0ff,#e438ff 50%,#29ff77)`.
- **Tło:** `#05050c`.
- **Kolory neonowe:**
  - cyan `#00d8ff` / CTA `#00f0ff`
  - magenta `#ff00e5`
  - zieleń `#29ff77`
- **Nagłówki:** Plus Jakarta Sans 800, gradient niebieski `#007bff` → fiolet → zieleń `#63f000`.
- **Body:** Inter.
- **Etykiety:** JetBrains Mono 700, uppercase, odstęp 0,28 em.
- **Grafika:** neonowy pierścień z hero strony (canvas „Zapytaj AI”), w środku znak SF.

## Tekst na plakacie

- **Logo:** SimpleFast.ai
- **Etykieta:** ZEWNĘTRZNY DZIAŁ AI DLA FIRM
- **Pytanie:** Szukasz firmy do wdrożenia AI w firmie?
- **Hasło:** Wynajmij nas jako zewnętrzny dział AI
- **Chipy:** Chatboty AI · Voiceboty · Automatyzacje
- **CTA:** simplefast.ai →

## Proces (OpenMontage + Higgsfield)

1. **Plakat:** HTML → PNG (Playwright).
2. **Klatka końcowa:** `gpt_image_2_5`, quality high, 2K, 9:16, plakat jako referencja.
   - Bulwar w złotej godzinie, płótno rozciągnięte na płasko, ok. 24 osoby trzymają krawędzie.
   - Tekst wyszedł 1:1, bez potrzeby kompozycji.
3. **Klatka startowa:** edycja klatki końcowej w `gpt_image_2_5`.
   - Ta sama scena, płótno złożone wzdłuż w wąski pas, ludzie w dwóch rzędach przy pasie.
4. **Ruch:** `kling3_0` pro, 10 s, bez dźwięku, `start_image` + `end_image`.
   - Z dwóch wariantów wybrany ten, w którym płótno fizycznie rozkłada się od środkowego zagięcia.
5. **Montaż** (ffmpeg + OpenMontage `video_stitch`):
   - 0–3,2 s przyspieszone 1,6× (2,0 s),
   - 3,2–10 s w tempie 1×,
   - 2 s stopklatki z najazdem 1,00→1,04.
6. **Audio** (OpenMontage `audio_mixer` full_mix, loudnorm -14 LUFS):
   - Mixkit „Uplifting Bass” (#726) od 12,1 s, drop w 2,2 s rolki (start rozciągania),
   - pod spodem cichy ambient miasta.

### Prompt ruchu (Kling 3.0)

```
Static top-down aerial drone shot, golden hour, city boulevard. A long narrow folded advertising canvas lies in the centre, held by two rows of people standing on both sides. On cue, all the people walk backwards outward in sync, the left row to the left and the right row to the right, pulling the canvas open sideways; the fabric unfolds and stretches wider and wider, ripples and then pulls taut and flat, revealing the giant printed poster. People at the ends hold the top and bottom edges. The camera stays perfectly still. The final poster and all its text look exactly as in the end frame. Photorealistic, natural fabric physics, smooth continuous motion, no cuts.
```

## Muzyka

„Uplifting Bass”, Mixkit Stock Music Free License: użycie komercyjne w social media bez przypisania. Alternatywa: trendujący dźwięk z biblioteki Instagrama przy publikacji.

## Koszt v2

Higgsfield: 35,5 kr.

- 2 × obraz GPT Image 2.5 high 2K = 5,5
- 2 × Kling 3.0 pro 10 s = 30
