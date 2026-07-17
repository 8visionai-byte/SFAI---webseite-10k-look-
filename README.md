# SimpleFast.ai — kierunek projektowy

Responsywny, wielopodstronowy prototyp nowej strony SimpleFast.ai. Projekt wykorzystuje Astro, GSAP i autorską scenę Three.js.

## Uruchomienie

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

## Zakres prototypu

- strona główna z narracją scrollową i obiektem Three.js,
- siedem podstron usług,
- strony: realizacje, jak pracujemy, wiedza, o nas, kontakt,
- pełnoekranowe menu mobilne i przejścia między podstronami,
- lokalne fonty i autorskie obrazy,
- wariant `prefers-reduced-motion`,
- statyczny HTML przyjazny SEO.

Formularz kontaktowy jest celowo demonstracyjny i nie wysyła danych. Przed publikacją trzeba podłączyć CRM/kalendarz, dodać finalną politykę prywatności, analitykę oraz prawdziwe treści artykułów.
