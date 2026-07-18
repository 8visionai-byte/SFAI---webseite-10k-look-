# SimpleFast.ai — strona firmowa

Responsywna, wielopodstronowa strona SimpleFast.ai z narracją sterowaną przewijaniem, interaktywną sceną Three.js i Agentem AI.

## Uruchomienie lokalne

```powershell
npm.cmd install
npm.cmd run dev
```

Następnie otwórz `http://localhost:4321`.

## Build produkcyjny

```powershell
npm.cmd run build
npm.cmd run preview
```

Wynik statyczny powstaje w katalogu `dist/`. Każda usługa ma osobny dokument HTML, tytuł, opis i dane strukturalne.

## Agent AI i rozmowa głosowa

Interfejs Agenta działa od razu w trybie lokalnej wiedzy. Pełne odpowiedzi generowane przez model i rozmowa głosowa wymagają funkcji serwerowych z katalogu `api/` oraz bezpiecznej zmiennej środowiskowej na hostingu.

1. Skopiuj nazwy zmiennych z `.env.example` do ustawień hostingu.
2. Ustaw `OPENAI_API_KEY` wyłącznie jako sekret po stronie serwera. Nie dodawaj klucza do repozytorium ani kodu przeglądarki.
3. Opcjonalnie ustaw `OPENAI_VECTOR_STORE_ID`, aby Agent korzystał z zatwierdzonych dokumentów firmy przez File Search.
4. Wdróż projekt na hostingu obsługującym funkcje zgodne z katalogiem `api/` (np. Vercel). Przy innym hostingu trzeba dopasować jedynie wejścia dwóch funkcji: `api/chat.mjs` i `api/realtime-session.mjs`.

Bez `OPENAI_VECTOR_STORE_ID` Agent korzysta z kontrolowanej wiedzy zapisanej w `api/_knowledge.mjs`. Mikrofon jest uruchamiany dopiero po wyraźnym kliknięciu użytkownika.

## Zakres

- strona główna z kinetyczną narracją i interaktywnym obiektem Three.js,
- siedem podstron usług,
- strony: realizacje, jak pracujemy, wiedza, o nas i kontakt,
- pełnoekranowe menu mobilne oraz przejścia między podstronami,
- czat AI i rozmowa głosowa WebRTC,
- lokalne fonty i autorskie obrazy,
- wariant `prefers-reduced-motion`,
- statyczny HTML przyjazny SEO.

Formularz kontaktowy pozostaje demonstracyjny. Przed finalną publikacją należy podłączyć CRM lub kalendarz, dodać docelową politykę prywatności, analitykę i zatwierdzone treści artykułów.
