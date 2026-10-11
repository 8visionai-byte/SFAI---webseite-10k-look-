# Rolka: rozwijany baner (drone reveal)

Pionowa rolka 9:16, 11 s. Widok z drona na plac miejski o złotej godzinie. Ekipa w kamizelkach wnosi dwie rolki i rozwija je do środka. Odsłania się gigantyczny plakat SimpleFast.ai: „Zewnętrzny dział AI / Szukasz firmy do wdrożenia AI w firmie? Wynajmij nas. / simplefast.ai”.

Wzór: reel @productive_emezeey (Google Flow, model „Omni 1.1 Flash”, tryb Ingredients, 9:16, 720p, 10 s).

## Pliki (biblioteka Higgsfield)

- Finał MP4 (1080×1920, 24 fps, AAC, -13 LUFS): https://d2ol7oe51mr4n9.cloudfront.net/user_310akJlk1DZj68uM7PeydmU57ss/09018e7f-13e1-4285-818e-b0dbcc11aa89.mp4
- Plakat PNG 1200×1800: https://d2ol7oe51mr4n9.cloudfront.net/user_310akJlk1DZj68uM7PeydmU57ss/99780a22-2d79-4cae-a29d-b4a819aa2b48.png
- `poster.html` — szablon plakatu (fonty marki z `node_modules`, grafika `flow-core.png`). W rolce użyto wariantu grafiki wygenerowanego promptem z `ASSETS.md` (`gpt_image_2_5`).

## Proces (OpenMontage + Higgsfield)

1. **Plakat**: HTML → PNG (Playwright, 1200×1800).
2. **Ujęcie bazowe**: `gemini_omni_flash_1_1`, `reference-to-video`, plakat jako `image_references`, 9:16, 1080p, 10 s. Ruch dobry, ale model gubi drobny tekst plakatu, więc posłużyło tylko jako klatka startowa i końcowa.
3. **Dokładna klatka końcowa**: ostatnia klatka ujęcia bazowego, krawędzie banera wykryte gradientem, plakat nałożony perspektywicznie (homografia), czerń winylu i światło przeniesione z oryginału, ziarno.
4. **Właściwe wideo**: `kling3_0` (pro, 10 s, bez dźwięku), `start_image` = 1. klatka bazowa, `end_image` = dokładna klatka końcowa. Tekst jest poprawny przez całe odsłonięcie.
5. **Montaż** (ffmpeg + OpenMontage `video_stitch`):
   - 0–4 s ujęcia przyspieszone 1,6× (2,5 s),
   - 4–10 s w tempie 1×,
   - 2,5 s stopklatki z najazdem 1,00→1,045.
6. **Audio** (OpenMontage `audio_mixer` full_mix, loudnorm -14 LUFS):
   - Mixkit „Uplifting Bass” (#726) od 11,35 s, drop w 3,0 s rolki (moment odsłonięcia),
   - pod spodem ambient placu z ujęcia bazowego.

### Prompt (Kling 3.0, start/end frame)

```
Single continuous aerial drone shot at golden hour over a city plaza. Workers in lime high-visibility vests and white hard hats carry two long rolled black banners up the plaza, set them down, then unroll the giant vinyl banner across the paving in sync; it unfurls smoothly and flattens, revealing the printed poster. The camera slowly descends and pushes in, then settles on the fully revealed, perfectly flat poster with the workers along its edges. Poster artwork and text exactly as in the end frame. Photorealistic, natural fabric physics, no cuts.
```

## Muzyka i licencja

„Uplifting Bass”, Mixkit (https://mixkit.co/free-stock-music/), Mixkit Stock Music Free License. Wolno używać komercyjnie w social media bez przypisania. Nie wolno dystrybuować samego utworu. Alternatywa: przy publikacji podmienić na trendujący dźwięk z biblioteki Instagrama.

## Koszt

Higgsfield: 120,25 kr.

- 2 × Gemini Omni 1080p 10 s = 90
- 2 × Kling 3.0 pro 10 s = 30
- grafika = 0,25

Jedno zlecenie Gemini odrzucił filtr bezpieczeństwa; kredyty nie zostały pobrane.
