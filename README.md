# Veintiuno · Training Log

PWA estática para seguir el plan de las medias maratones de Valencia y Sevilla 2026.

## Funciones

- Plan completo de 86 entradas.
- Vista del entrenamiento del día y de la semana.
- Registro de resultados, esfuerzo y sensaciones.
- Progreso semanal.
- Datos guardados exclusivamente en el navegador mediante `localStorage`.
- Funcionamiento sin conexión después de la primera visita.

## Desarrollo local

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
```

La compilación de producción se genera con:

```bash
npm run build
```

## Publicación en GitHub Pages

El flujo `.github/workflows/deploy-pages.yml` compila y publica automáticamente la PWA al enviar cambios a la rama `main`.

En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación.
